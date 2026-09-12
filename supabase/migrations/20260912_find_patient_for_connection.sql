-- ==============================================================================
-- MIND SATHI: Secure Patient Lookup Function for Caregiver Connection
-- Migration: 20260912_find_patient_for_connection.sql
-- ==============================================================================

-- 1. Ensure any overly broad RLS policy that exposes all elderly profiles is removed
DROP POLICY IF EXISTS "Allow authenticated users to find patient by connection code or email" ON public.profiles;

-- 2. Create the SECURITY DEFINER patient lookup function
CREATE OR REPLACE FUNCTION public.find_patient_for_connection(identifier text)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  preferred_name TEXT,
  email TEXT,
  role TEXT,
  connection_code TEXT,
  profile_photo_url TEXT,
  avatar_url TEXT,
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
  v_clean_upper TEXT;
  v_code_no_prefix TEXT;
  v_patient RECORD;
  v_existing_caregiver UUID;
BEGIN
  -- A. Verify caller is authenticated
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: caller must be logged in' USING ERRCODE = '28000';
  END IF;

  -- B. Verify caller has caregiver role in profiles
  SELECT p.role INTO v_caller_role
  FROM public.profiles p
  WHERE p.id = v_caller_id;

  IF v_caller_role IS NULL OR v_caller_role != 'caregiver' THEN
    RAISE EXCEPTION 'Access denied: caller must have caregiver role' USING ERRCODE = '42501';
  END IF;

  -- C. Normalize input identifier
  v_clean_input := lower(trim(COALESCE(identifier, '')));
  IF v_clean_input = '' THEN
    RETURN;
  END IF;

  v_clean_upper := upper(trim(identifier));
  v_code_no_prefix := regexp_replace(v_clean_upper, '^MS-?', '', 'i');

  -- D. Find matching patient profile (minimal safe projection only)
  SELECT
    p.id,
    p.full_name,
    p.preferred_name,
    p.email,
    p.role,
    COALESCE(p.connection_code, p.secondary_language, 'MS-' || upper(substring(replace(p.id::text, '-', '') from 1 for 6))) AS connection_code,
    p.profile_photo_url,
    p.avatar_url
  INTO v_patient
  FROM public.profiles p
  WHERE (p.role = 'elderly' OR p.role = 'patient')
    AND (
      -- Exact email match (case-insensitive)
      lower(p.email) = v_clean_input
      -- Connection code match
      OR (p.connection_code IS NOT NULL AND (
        upper(p.connection_code) = v_clean_upper
        OR upper(p.connection_code) = 'MS-' || v_clean_upper
        OR upper(regexp_replace(p.connection_code, '^MS-?', '', 'i')) = v_code_no_prefix
      ))
      -- Legacy connection code stored in secondary_language
      OR (p.secondary_language IS NOT NULL AND (
        upper(p.secondary_language) = v_clean_upper
        OR upper(p.secondary_language) = 'MS-' || v_clean_upper
        OR upper(regexp_replace(p.secondary_language, '^MS-?', '', 'i')) = v_code_no_prefix
      ))
      -- Exact UUID match if input is UUID
      OR (v_clean_input ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND p.id::text = v_clean_input)
    )
  LIMIT 1;

  -- If no matching elderly patient found, return empty set
  IF v_patient.id IS NULL THEN
    RETURN;
  END IF;

  -- E. Check relationship in caregiver_patient to detect already-linked status
  SELECT cp.caregiver_id INTO v_existing_caregiver
  FROM public.caregiver_patient cp
  WHERE cp.patient_id = v_patient.id
    AND cp.status = 'approved'
  LIMIT 1;

  -- F. Return minimal identity fields and linking flags
  id := v_patient.id;
  full_name := v_patient.full_name;
  preferred_name := v_patient.preferred_name;
  email := v_patient.email;
  role := v_patient.role;
  connection_code := v_patient.connection_code;
  profile_photo_url := v_patient.profile_photo_url;
  avatar_url := v_patient.avatar_url;
  is_already_linked := (v_existing_caregiver IS NOT NULL);
  linked_to_caller := (v_existing_caregiver IS NOT NULL AND v_existing_caregiver = v_caller_id);

  RETURN NEXT;
END;
$$;

-- 3. Restrict permissions: Revoke from public/anon, grant EXECUTE only to authenticated
REVOKE ALL ON FUNCTION public.find_patient_for_connection(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.find_patient_for_connection(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.find_patient_for_connection(text) TO authenticated;
