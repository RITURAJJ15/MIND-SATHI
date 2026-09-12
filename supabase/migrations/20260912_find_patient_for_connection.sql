-- ==============================================================================
-- MIND SATHI: Secure Patient Lookup Function for Caregiver Connection
-- Migration: 20260912_find_patient_for_connection.sql
-- ==============================================================================

-- 1. DROP POLICY (Clean-up)
-- Drops any obsolete, overly broad public search policy on profiles if previously applied
DROP POLICY IF EXISTS "Allow authenticated users to find patient by connection code or email" ON public.profiles;

-- 2. CREATE OR REPLACE FUNCTION
-- Defines the secure SECURITY DEFINER patient lookup function conforming strictly to verified schema
CREATE OR REPLACE FUNCTION public.find_patient_for_connection(identifier text)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  preferred_name TEXT,
  email TEXT,
  role TEXT,
  profile_photo_url TEXT,
  is_already_linked BOOLEAN,
  linked_to_caller BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
  v_clean_input TEXT;
  v_patient RECORD;
  v_existing_caregiver UUID;
BEGIN
  -- A. Verify caller is authenticated
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: caller must be logged in' USING ERRCODE = '28000';
  END IF;

  -- B. Verify caller has caregiver role in profiles or auth metadata
  SELECT p.role INTO v_caller_role
  FROM public.profiles p
  WHERE p.id = v_caller_id;

  IF v_caller_role IS NULL OR lower(trim(v_caller_role)) != 'caregiver' THEN
    SELECT (raw_user_meta_data->>'role') INTO v_caller_role
    FROM auth.users
    WHERE id = v_caller_id;
  END IF;

  IF v_caller_role IS NULL OR lower(trim(v_caller_role)) != 'caregiver' THEN
    RAISE EXCEPTION 'Access denied: caller must have caregiver role' USING ERRCODE = '42501';
  END IF;

  -- C. Normalize input identifier
  v_clean_input := lower(trim(COALESCE(identifier, '')));
  IF v_clean_input = '' THEN
    RETURN;
  END IF;

  -- D. Find matching patient profile (minimal safe projection only)
  -- Checks public.profiles first, matching on lower(trim(email)) or exact UUID
  SELECT
    p.id,
    p.full_name,
    p.preferred_name,
    COALESCE(NULLIF(p.email, ''), u.email, v_clean_input) AS email,
    p.role,
    p.profile_photo_url
  INTO v_patient
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  WHERE (lower(trim(COALESCE(p.role, u.raw_user_meta_data->>'role', ''))) = 'elderly'
         OR lower(trim(COALESCE(p.role, u.raw_user_meta_data->>'role', ''))) = 'patient')
    AND (
      lower(trim(COALESCE(p.email, ''))) = v_clean_input
      OR lower(trim(COALESCE(u.email, ''))) = v_clean_input
      OR (v_clean_input ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND p.id::text = v_clean_input)
    )
  LIMIT 1;

  -- Fallback: If user registered in auth.users but profiles record is missing/pending
  IF v_patient.id IS NULL THEN
    SELECT
      u.id,
      COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', 'Patient') AS full_name,
      COALESCE(u.raw_user_meta_data->>'preferred_name', u.raw_user_meta_data->>'name', 'Patient') AS preferred_name,
      COALESCE(u.email, v_clean_input) AS email,
      COALESCE(u.raw_user_meta_data->>'role', 'elderly') AS role,
      (u.raw_user_meta_data->>'avatar_url') AS profile_photo_url
    INTO v_patient
    FROM auth.users u
    WHERE lower(trim(COALESCE(u.raw_user_meta_data->>'role', ''))) IN ('elderly', 'patient')
      AND (
        lower(trim(COALESCE(u.email, ''))) = v_clean_input
        OR (v_clean_input ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND u.id::text = v_clean_input)
      )
    LIMIT 1;

    -- If found in auth.users, auto-create minimal profile so foreign keys succeed
    IF v_patient.id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_patient.id) THEN
      INSERT INTO public.profiles (id, email, full_name, role)
      VALUES (v_patient.id, v_patient.email, v_patient.full_name, 'elderly')
      ON CONFLICT (id) DO NOTHING;
    END IF;
  END IF;

  -- If no patient matched, return empty set
  IF v_patient.id IS NULL THEN
    RETURN;
  END IF;

  -- Prevent self-connection
  IF v_patient.id = v_caller_id THEN
    RAISE EXCEPTION 'Cannot connect to your own account' USING ERRCODE = '22000';
  END IF;

  -- E. Check relationship in caregiver_patient (using existing columns: patient_id, caregiver_id)
  SELECT cp.caregiver_id INTO v_existing_caregiver
  FROM public.caregiver_patient cp
  WHERE cp.patient_id = v_patient.id
  LIMIT 1;

  -- F. Return minimal identity fields and linking flags
  id := v_patient.id;
  full_name := v_patient.full_name;
  preferred_name := v_patient.preferred_name;
  email := v_patient.email;
  role := v_patient.role;
  profile_photo_url := v_patient.profile_photo_url;
  is_already_linked := (v_existing_caregiver IS NOT NULL);
  linked_to_caller := (v_existing_caregiver IS NOT NULL AND v_existing_caregiver = v_caller_id);

  RETURN NEXT;
END;
$$;

-- 3. PERMISSIONS / PRIVILEGES
-- Revoke execution from public and anon
REVOKE ALL ON FUNCTION public.find_patient_for_connection(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.find_patient_for_connection(text) FROM anon;

-- Grant execution strictly to authenticated users
GRANT EXECUTE ON FUNCTION public.find_patient_for_connection(text) TO authenticated;
