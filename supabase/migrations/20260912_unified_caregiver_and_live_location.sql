-- ==============================================================================
-- MIND SATHI: Unified Caregiver ↔ Patient Sync & Live Location Sharing
-- Migration: 20260912_unified_caregiver_and_live_location.sql
-- Paste and run this ENTIRE script in your Supabase Dashboard -> SQL Editor
-- ==============================================================================

-- ==============================================================================
-- PART 1: CAREGIVER ↔ PATIENT CONNECTION STATUS & BIDIRECTIONAL SYNC
-- ==============================================================================

-- 1.1 Ensure RLS is enabled on caregiver_patient
ALTER TABLE public.caregiver_patient ENABLE ROW LEVEL SECURITY;

-- 1.2 Indexes for fast bidirectional lookup
CREATE INDEX IF NOT EXISTS idx_cg_patient_caregiver ON public.caregiver_patient(caregiver_id);
CREATE INDEX IF NOT EXISTS idx_cg_patient_patient ON public.caregiver_patient(patient_id);

-- 1.3 Unique constraint to enforce 1-to-1 pair safety
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

-- 1.4 RLS Policies on public.caregiver_patient
DROP POLICY IF EXISTS "Caregiver patient access" ON public.caregiver_patient;
DROP POLICY IF EXISTS "Caregiver patient select access" ON public.caregiver_patient;
CREATE POLICY "Caregiver patient select access"
  ON public.caregiver_patient FOR SELECT
  TO authenticated
  USING (
    caregiver_id = auth.uid() OR patient_id = auth.uid()
  );

DROP POLICY IF EXISTS "Caregivers can insert caregiver_patient" ON public.caregiver_patient;
CREATE POLICY "Caregivers can insert caregiver_patient"
  ON public.caregiver_patient FOR INSERT
  TO authenticated
  WITH CHECK (
    caregiver_id = auth.uid()
  );

DROP POLICY IF EXISTS "Participants can delete caregiver_patient" ON public.caregiver_patient;
CREATE POLICY "Participants can delete caregiver_patient"
  ON public.caregiver_patient FOR DELETE
  TO authenticated
  USING (
    caregiver_id = auth.uid() OR patient_id = auth.uid()
  );

-- 1.5 Reciprocal RLS Policies on public.profiles
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

-- 1.6 Enable Realtime on caregiver_patient
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

-- 1.7 RPC: connect_patient_to_caregiver (Stores the connection in database)
CREATE OR REPLACE FUNCTION public.connect_patient_to_caregiver(p_patient_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
  v_patient RECORD;
  v_existing_cg UUID;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: caller must be logged in' USING ERRCODE = '28000';
  END IF;

  -- Verify caller is a caregiver
  SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller_id;
  IF v_caller_role IS DISTINCT FROM 'caregiver' THEN
    RAISE EXCEPTION 'Access denied: caller must have caregiver role' USING ERRCODE = '42501';
  END IF;

  -- Verify target patient exists
  SELECT * INTO v_patient FROM public.profiles WHERE id = p_patient_id;
  IF v_patient.id IS NULL THEN
    RAISE EXCEPTION 'Patient not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_patient.id = v_caller_id THEN
    RAISE EXCEPTION 'Cannot connect to your own account as a patient' USING ERRCODE = '22000';
  END IF;

  -- Check if patient is already linked to another caregiver (1-to-1 enforcement)
  SELECT caregiver_id INTO v_existing_cg
  FROM public.caregiver_patient
  WHERE patient_id = p_patient_id;

  IF v_existing_cg IS NOT NULL AND v_existing_cg != v_caller_id THEN
    RAISE EXCEPTION 'Patient is already linked to another caregiver' USING ERRCODE = '23505';
  END IF;

  -- Clean up any previous link for this caregiver (1 caregiver ↔ 1 patient)
  DELETE FROM public.caregiver_patient WHERE caregiver_id = v_caller_id;

  -- Insert new connection
  INSERT INTO public.caregiver_patient (caregiver_id, patient_id)
  VALUES (v_caller_id, p_patient_id)
  ON CONFLICT (caregiver_id, patient_id) DO NOTHING;

  RETURN jsonb_build_object(
    'success', true,
    'caregiver_id', v_caller_id,
    'patient_id', p_patient_id,
    'patient_name', COALESCE(v_patient.full_name, v_patient.preferred_name, 'Patient'),
    'connected_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.connect_patient_to_caregiver(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.connect_patient_to_caregiver(UUID) TO authenticated;

-- 1.8 RPC: disconnect_patient_from_caregiver (Unlinks the connection from database)
CREATE OR REPLACE FUNCTION public.disconnect_patient_from_caregiver()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: caller must be logged in' USING ERRCODE = '28000';
  END IF;

  DELETE FROM public.caregiver_patient
  WHERE caregiver_id = v_caller_id OR patient_id = v_caller_id;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.disconnect_patient_from_caregiver() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.disconnect_patient_from_caregiver() TO authenticated;

-- 1.9 RPC: get_connected_caregiver_for_patient (Used by Patient Dashboard)
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
  v_patient_id := auth.uid();
  IF v_patient_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: caller must be logged in' USING ERRCODE = '28000';
  END IF;

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

REVOKE ALL ON FUNCTION public.get_connected_caregiver_for_patient() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_connected_caregiver_for_patient() TO authenticated;

-- 1.10 RPC: get_connected_patient_for_caregiver (Used by Caregiver Portal)
CREATE OR REPLACE FUNCTION public.get_connected_patient_for_caregiver()
RETURNS TABLE (
  patient_id UUID,
  full_name TEXT,
  preferred_name TEXT,
  email TEXT,
  phone TEXT,
  age INTEGER,
  gender TEXT,
  city TEXT,
  state TEXT,
  profile_photo_url TEXT,
  connection_code TEXT,
  streak_days INTEGER,
  total_xp INTEGER,
  connected_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caregiver_id UUID;
BEGIN
  v_caregiver_id := auth.uid();
  IF v_caregiver_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: caller must be logged in' USING ERRCODE = '28000';
  END IF;

  RETURN QUERY
  SELECT
    p.id AS patient_id,
    COALESCE(p.full_name, p.preferred_name, 'Patient') AS full_name,
    p.preferred_name,
    COALESCE(NULLIF(p.email, ''), u.email, '') AS email,
    p.phone,
    COALESCE(p.age, 70) AS age,
    COALESCE(p.gender, 'other') AS gender,
    COALESCE(p.city, 'Guwahati') AS city,
    COALESCE(p.state, 'Assam') AS state,
    COALESCE(p.profile_photo_url, p.avatar_url, '') AS profile_photo_url,
    COALESCE(p.secondary_language, 'MS-' || UPPER(SUBSTRING(REPLACE(p.id::text, '-', ''), 1, 6))) AS connection_code,
    COALESCE(p.streak_days, 1) AS streak_days,
    COALESCE(p.total_xp, 50) AS total_xp,
    cp.created_at AS connected_at
  FROM public.caregiver_patient cp
  JOIN public.profiles p ON p.id = cp.patient_id
  LEFT JOIN auth.users u ON u.id = p.id
  WHERE cp.caregiver_id = v_caregiver_id
  ORDER BY cp.created_at DESC
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.get_connected_patient_for_caregiver() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_connected_patient_for_caregiver() TO authenticated;


-- ==============================================================================
-- PART 2: LIVE LOCATION SHARING SUBSYSTEM
-- ==============================================================================

-- 2.1 Create the live_location_sessions table
CREATE TABLE IF NOT EXISTS public.live_location_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caregiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('requested', 'active', 'stopped', 'disconnected', 'expired')),
  requested_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  stopped_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  last_latitude DOUBLE PRECISION,
  last_longitude DOUBLE PRECISION,
  accuracy_meters DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_caregiver_patient_live UNIQUE (caregiver_id, patient_id)
);

-- 2.2 Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_live_loc_caregiver ON public.live_location_sessions(caregiver_id);
CREATE INDEX IF NOT EXISTS idx_live_loc_patient ON public.live_location_sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_live_loc_status ON public.live_location_sessions(status);

-- 2.3 Enable RLS on live_location_sessions
ALTER TABLE public.live_location_sessions ENABLE ROW LEVEL SECURITY;

-- 2.4 RLS Policies for live_location_sessions
DROP POLICY IF EXISTS "Caregivers can view their own live location sessions" ON public.live_location_sessions;
CREATE POLICY "Caregivers can view their own live location sessions"
  ON public.live_location_sessions FOR SELECT
  TO authenticated
  USING (
    caregiver_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.caregiver_patient cp
      WHERE cp.caregiver_id = auth.uid()
        AND cp.patient_id = public.live_location_sessions.patient_id
    )
  );

DROP POLICY IF EXISTS "Patients can view their own live location sessions" ON public.live_location_sessions;
CREATE POLICY "Patients can view their own live location sessions"
  ON public.live_location_sessions FOR SELECT
  TO authenticated
  USING (
    patient_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.caregiver_patient cp
      WHERE cp.caregiver_id = public.live_location_sessions.caregiver_id
        AND cp.patient_id = auth.uid()
    )
  );

-- 2.5 Enable Realtime on live_location_sessions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'live_location_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_location_sessions;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END;
$$;

-- 2.6 RPC: request_live_location (Caregiver requests location)
CREATE OR REPLACE FUNCTION public.request_live_location(p_patient_id UUID)
RETURNS TABLE (
  id UUID,
  caregiver_id UUID,
  patient_id UUID,
  status TEXT,
  requested_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  caregiver_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID;
  v_caregiver_name TEXT;
  v_session RECORD;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: caller must be logged in' USING ERRCODE = '28000';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.caregiver_patient cp
    WHERE cp.caregiver_id = v_caller_id
      AND cp.patient_id = p_patient_id
  ) THEN
    RAISE EXCEPTION 'Access denied: not connected to this patient' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(full_name, preferred_name, 'Your Caregiver') INTO v_caregiver_name
  FROM public.profiles
  WHERE profiles.id = v_caller_id;

  INSERT INTO public.live_location_sessions (
    caregiver_id,
    patient_id,
    status,
    requested_at,
    expires_at,
    updated_at
  )
  VALUES (
    v_caller_id,
    p_patient_id,
    'requested',
    now(),
    now() + interval '10 minutes',
    now()
  )
  ON CONFLICT (caregiver_id, patient_id)
  DO UPDATE SET
    status = 'requested',
    requested_at = now(),
    started_at = NULL,
    stopped_at = NULL,
    last_seen_at = NULL,
    expires_at = now() + interval '10 minutes',
    updated_at = now()
  RETURNING
    live_location_sessions.id,
    live_location_sessions.caregiver_id,
    live_location_sessions.patient_id,
    live_location_sessions.status,
    live_location_sessions.requested_at,
    live_location_sessions.expires_at
  INTO v_session;

  id := v_session.id;
  caregiver_id := v_session.caregiver_id;
  patient_id := v_session.patient_id;
  status := v_session.status;
  requested_at := v_session.requested_at;
  expires_at := v_session.expires_at;
  caregiver_name := COALESCE(v_caregiver_name, 'Your Caregiver');

  RETURN NEXT;
END;
$$;

-- 2.7 RPC: respond_live_location_request (Patient approves or declines)
CREATE OR REPLACE FUNCTION public.respond_live_location_request(
  p_session_id UUID,
  p_accept BOOLEAN
)
RETURNS TABLE (
  id UUID,
  status TEXT,
  started_at TIMESTAMPTZ,
  stopped_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID;
  v_session RECORD;
  v_new_status TEXT;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: caller must be logged in' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_session
  FROM public.live_location_sessions s
  WHERE s.id = p_session_id;

  IF v_session.id IS NULL THEN
    RAISE EXCEPTION 'Live location session not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_session.patient_id != v_caller_id THEN
    RAISE EXCEPTION 'Access denied: not authorized to respond to this session' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.caregiver_patient cp
    WHERE cp.caregiver_id = v_session.caregiver_id
      AND cp.patient_id = v_caller_id
  ) THEN
    RAISE EXCEPTION 'Access denied: caregiver is no longer connected' USING ERRCODE = '42501';
  END IF;

  IF p_accept THEN
    v_new_status := 'active';
    UPDATE public.live_location_sessions
    SET
      status = 'active',
      started_at = now(),
      last_seen_at = now(),
      expires_at = now() + interval '2 hours',
      updated_at = now()
    WHERE live_location_sessions.id = p_session_id
    RETURNING * INTO v_session;
  ELSE
    v_new_status := 'stopped';
    UPDATE public.live_location_sessions
    SET
      status = 'stopped',
      stopped_at = now(),
      updated_at = now()
    WHERE live_location_sessions.id = p_session_id
    RETURNING * INTO v_session;
  END IF;

  id := v_session.id;
  status := v_session.status;
  started_at := v_session.started_at;
  stopped_at := v_session.stopped_at;

  RETURN NEXT;
END;
$$;

-- 2.8 RPC: update_live_location (Patient streams live coords & heartbeat)
CREATE OR REPLACE FUNCTION public.update_live_location(
  p_session_id UUID,
  p_lat DOUBLE PRECISION,
  p_lon DOUBLE PRECISION,
  p_accuracy DOUBLE PRECISION
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID;
  v_session RECORD;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: caller must be logged in' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_session
  FROM public.live_location_sessions s
  WHERE s.id = p_session_id;

  IF v_session.id IS NULL OR v_session.patient_id != v_caller_id THEN
    RAISE EXCEPTION 'Access denied: session not found or unauthorized' USING ERRCODE = '42501';
  END IF;

  IF v_session.status != 'active' THEN
    RETURN FALSE;
  END IF;

  IF v_session.expires_at IS NOT NULL AND v_session.expires_at < now() THEN
    UPDATE public.live_location_sessions
    SET status = 'stopped', stopped_at = now(), updated_at = now()
    WHERE live_location_sessions.id = p_session_id;
    RETURN FALSE;
  END IF;

  UPDATE public.live_location_sessions
  SET
    last_latitude = p_lat,
    last_longitude = p_lon,
    accuracy_meters = p_accuracy,
    last_seen_at = now(),
    updated_at = now()
  WHERE live_location_sessions.id = p_session_id;

  RETURN TRUE;
END;
$$;

-- 2.9 RPC: stop_live_location (Stop sharing by either participant)
CREATE OR REPLACE FUNCTION public.stop_live_location(p_session_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID;
  v_session RECORD;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: caller must be logged in' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_session
  FROM public.live_location_sessions s
  WHERE s.id = p_session_id;

  IF v_session.id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_session.patient_id != v_caller_id AND v_session.caregiver_id != v_caller_id THEN
    RAISE EXCEPTION 'Access denied: not a participant of this session' USING ERRCODE = '42501';
  END IF;

  UPDATE public.live_location_sessions
  SET
    status = 'stopped',
    stopped_at = now(),
    updated_at = now()
  WHERE live_location_sessions.id = p_session_id;

  RETURN TRUE;
END;
$$;

-- 2.10 RPC: patient_start_live_location (Patient directly initiates sharing)
CREATE OR REPLACE FUNCTION public.patient_start_live_location()
RETURNS TABLE (
  id UUID,
  caregiver_id UUID,
  patient_id UUID,
  status TEXT,
  started_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  caregiver_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID;
  v_caregiver_id UUID;
  v_caregiver_name TEXT;
  v_session RECORD;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: caller must be logged in' USING ERRCODE = '28000';
  END IF;

  SELECT cp.caregiver_id INTO v_caregiver_id
  FROM public.caregiver_patient cp
  WHERE cp.patient_id = v_caller_id
  ORDER BY cp.created_at DESC
  LIMIT 1;

  IF v_caregiver_id IS NULL THEN
    RAISE EXCEPTION 'Access denied: No caregiver is connected to your account' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(full_name, preferred_name, 'Your Caregiver') INTO v_caregiver_name
  FROM public.profiles
  WHERE profiles.id = v_caregiver_id;

  INSERT INTO public.live_location_sessions (
    caregiver_id,
    patient_id,
    status,
    started_at,
    last_seen_at,
    expires_at,
    updated_at
  )
  VALUES (
    v_caregiver_id,
    v_caller_id,
    'active',
    now(),
    now(),
    now() + interval '2 hours',
    now()
  )
  ON CONFLICT (caregiver_id, patient_id)
  DO UPDATE SET
    status = 'active',
    started_at = now(),
    last_seen_at = now(),
    stopped_at = NULL,
    expires_at = now() + interval '2 hours',
    updated_at = now()
  RETURNING
    live_location_sessions.id,
    live_location_sessions.caregiver_id,
    live_location_sessions.patient_id,
    live_location_sessions.status,
    live_location_sessions.started_at,
    live_location_sessions.expires_at
  INTO v_session;

  id := v_session.id;
  caregiver_id := v_session.caregiver_id;
  patient_id := v_session.patient_id;
  status := v_session.status;
  started_at := v_session.started_at;
  expires_at := v_session.expires_at;
  caregiver_name := COALESCE(v_caregiver_name, 'Your Caregiver');

  RETURN NEXT;
END;
$$;

-- 2.11 Permissions on Location RPCs
REVOKE ALL ON FUNCTION public.request_live_location(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_live_location(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.respond_live_location_request(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_live_location_request(UUID, BOOLEAN) TO authenticated;

REVOKE ALL ON FUNCTION public.update_live_location(UUID, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_live_location(UUID, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;

REVOKE ALL ON FUNCTION public.stop_live_location(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.stop_live_location(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.patient_start_live_location() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.patient_start_live_location() TO authenticated;
