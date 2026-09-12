-- ==============================================================================
-- MIND SATHI: Secure Live Location Sharing Sessions
-- Migration: 20260912_live_location_sharing.sql
-- ==============================================================================

-- 1. Create the live_location_sessions table
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

-- 2. Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_live_loc_caregiver ON public.live_location_sessions(caregiver_id);
CREATE INDEX IF NOT EXISTS idx_live_loc_patient ON public.live_location_sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_live_loc_status ON public.live_location_sessions(status);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.live_location_sessions ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies: Access restricted strictly to authenticated, connected caregiver & patient
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

-- 5. Enable Realtime on live_location_sessions
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
    NULL; -- Ignore if already added or permissions handled by dashboard
END;
$$;

-- ==============================================================================
-- 6. SECURE RPC FUNCTIONS
-- ==============================================================================

-- Function 6.1: Caregiver requests live location from connected patient
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

  -- Verify active connection in caregiver_patient
  IF NOT EXISTS (
    SELECT 1 FROM public.caregiver_patient cp
    WHERE cp.caregiver_id = v_caller_id
      AND cp.patient_id = p_patient_id
  ) THEN
    RAISE EXCEPTION 'Access denied: not connected to this patient' USING ERRCODE = '42501';
  END IF;

  -- Get caregiver display name
  SELECT COALESCE(full_name, preferred_name, 'Your Caregiver') INTO v_caregiver_name
  FROM public.profiles
  WHERE profiles.id = v_caller_id;

  IF v_caregiver_name IS NULL THEN
    v_caregiver_name := 'Your Caregiver';
  END IF;

  -- Upsert session with status = 'requested'
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
  caregiver_name := v_caregiver_name;

  RETURN NEXT;
END;
$$;

-- Function 6.2: Patient responds to live location request (Accept or Decline)
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

  -- Verify session belongs to this patient
  SELECT * INTO v_session
  FROM public.live_location_sessions s
  WHERE s.id = p_session_id;

  IF v_session.id IS NULL THEN
    RAISE EXCEPTION 'Live location session not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_session.patient_id != v_caller_id THEN
    RAISE EXCEPTION 'Access denied: not authorized to respond to this session' USING ERRCODE = '42501';
  END IF;

  -- Verify active connection
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

-- Function 6.3: Patient streams live location & heartbeat
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

  -- Verify active connection
  IF NOT EXISTS (
    SELECT 1 FROM public.caregiver_patient cp
    WHERE cp.caregiver_id = v_session.caregiver_id
      AND cp.patient_id = v_caller_id
  ) THEN
    -- If unlinked, stop immediately
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

-- Function 6.4: Stop live location (callable by patient or caregiver)
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

-- Function 6.5: Patient directly initiates live location sharing with connected caregiver
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

  -- Find the connected caregiver from caregiver_patient
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

-- 7. Permissions: Revoke from public & anon, grant to authenticated
REVOKE ALL ON FUNCTION public.request_live_location(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.request_live_location(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.request_live_location(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.respond_live_location_request(UUID, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.respond_live_location_request(UUID, BOOLEAN) FROM anon;
GRANT EXECUTE ON FUNCTION public.respond_live_location_request(UUID, BOOLEAN) TO authenticated;

REVOKE ALL ON FUNCTION public.update_live_location(UUID, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_live_location(UUID, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_live_location(UUID, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;

REVOKE ALL ON FUNCTION public.stop_live_location(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stop_live_location(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.stop_live_location(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.patient_start_live_location() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.patient_start_live_location() FROM anon;
GRANT EXECUTE ON FUNCTION public.patient_start_live_location() TO authenticated;

