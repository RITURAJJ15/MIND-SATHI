-- ==============================================================================
-- MIND SATHI: Fix Caregiver ↔ Patient Connection Status & Persistence
-- Migration: 20260912_fix_patient_caregiver_status.sql
-- ==============================================================================

-- 1. Ensure RLS is enabled on caregiver_patient
ALTER TABLE public.caregiver_patient ENABLE ROW LEVEL SECURITY;

-- 2. Indexes for fast bidirectional lookup
CREATE INDEX IF NOT EXISTS idx_cg_patient_caregiver ON public.caregiver_patient(caregiver_id);
CREATE INDEX IF NOT EXISTS idx_cg_patient_patient ON public.caregiver_patient(patient_id);

-- 3. Unique constraint to enforce 1-to-1 pair safety
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_caregiver_patient_pair'
  ) THEN
    ALTER TABLE public.caregiver_patient
    ADD CONSTRAINT uq_caregiver_patient_pair UNIQUE (caregiver_id, patient_id);
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END;
$$;

-- 4. RLS Policies on public.caregiver_patient
-- 4.1 SELECT: Caregiver can see their patient, patient can see their caregiver
DROP POLICY IF EXISTS "Caregiver patient access" ON public.caregiver_patient;
DROP POLICY IF EXISTS "Caregiver patient select access" ON public.caregiver_patient;
CREATE POLICY "Caregiver patient select access"
  ON public.caregiver_patient FOR SELECT
  TO authenticated
  USING (
    caregiver_id = auth.uid() OR patient_id = auth.uid()
  );

-- 4.2 INSERT: Caregiver can connect to patient
DROP POLICY IF EXISTS "Caregivers can insert caregiver_patient" ON public.caregiver_patient;
CREATE POLICY "Caregivers can insert caregiver_patient"
  ON public.caregiver_patient FOR INSERT
  TO authenticated
  WITH CHECK (
    caregiver_id = auth.uid()
  );

-- 4.3 DELETE: Either participant can unlink the connection
DROP POLICY IF EXISTS "Participants can delete caregiver_patient" ON public.caregiver_patient;
CREATE POLICY "Participants can delete caregiver_patient"
  ON public.caregiver_patient FOR DELETE
  TO authenticated
  USING (
    caregiver_id = auth.uid() OR patient_id = auth.uid()
  );

-- 5. Reciprocal RLS Policies on public.profiles
-- 5.1 Caregivers can view connected patient profiles (without non-existent status column)
DROP POLICY IF EXISTS "Caregivers can view connected patient profiles" ON public.profiles;
CREATE POLICY "Caregivers can view connected patient profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.caregiver_patient cp
      WHERE cp.caregiver_id = auth.uid()
        AND cp.patient_id = public.profiles.id
    )
  );

-- 5.2 Patients can view connected caregiver profiles (CRITICAL FIX FOR PATIENT DASHBOARD)
DROP POLICY IF EXISTS "Patients can view connected caregiver profiles" ON public.profiles;
CREATE POLICY "Patients can view connected caregiver profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.caregiver_patient cp
      WHERE cp.patient_id = auth.uid()
        AND cp.caregiver_id = public.profiles.id
    )
  );

-- 6. Enable Realtime on caregiver_patient for instant dashboard synchronization
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'caregiver_patient'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.caregiver_patient;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END;
$$;

-- 7. Authoritative RPC function: get_connected_caregiver_for_patient
CREATE OR REPLACE FUNCTION public.get_connected_caregiver_for_patient()
RETURNS TABLE (
  caregiver_id UUID,
  name TEXT,
  full_name TEXT,
  preferred_name TEXT,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  role TEXT,
  connected_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_patient_id UUID;
BEGIN
  -- A. Verify caller is authenticated
  v_patient_id := auth.uid();
  IF v_patient_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: caller must be logged in' USING ERRCODE = '28000';
  END IF;

  -- B. Query authoritative relationship joined with caregiver profile
  RETURN QUERY
  SELECT
    p.id AS caregiver_id,
    COALESCE(p.full_name, p.preferred_name, 'Family Caregiver') AS name,
    p.full_name,
    p.preferred_name,
    COALESCE(NULLIF(p.email, ''), u.email, '') AS email,
    p.phone,
    COALESCE(p.profile_photo_url, p.avatar_url, '') AS avatar_url,
    COALESCE(p.role, 'caregiver') AS role,
    cp.created_at AS connected_at
  FROM public.caregiver_patient cp
  JOIN public.profiles p ON p.id = cp.caregiver_id
  LEFT JOIN auth.users u ON u.id = p.id
  WHERE cp.patient_id = v_patient_id
  ORDER BY cp.created_at DESC
  LIMIT 1;
END;
$$;

-- 8. Permissions (Least Privilege Enforcement)
REVOKE ALL ON FUNCTION public.get_connected_caregiver_for_patient() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_connected_caregiver_for_patient() TO authenticated;
