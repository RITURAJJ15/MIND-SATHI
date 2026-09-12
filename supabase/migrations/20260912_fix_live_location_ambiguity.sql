-- ============================================================================
-- MIGRATION: 20260912_fix_live_location_ambiguity.sql
-- DESCRIPTION: Fix ambiguous column reference "caregiver_id" in live location RPCs
--              and optimize live location permission sharing.
-- IDEMPOTENT: Safe to run multiple times in Supabase SQL Editor.
-- ============================================================================

-- 1. Ensure Table and Constraints Exist
CREATE TABLE IF NOT EXISTS public.live_location_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caregiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'active', 'stopped', 'disconnected')),
  last_latitude DOUBLE PRECISION,
  last_longitude DOUBLE PRECISION,
  accuracy_meters DOUBLE PRECISION,
  requested_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  stopped_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_caregiver_patient_live UNIQUE (caregiver_id, patient_id)
);

CREATE INDEX IF NOT EXISTS idx_live_loc_caregiver ON public.live_location_sessions(caregiver_id);
CREATE INDEX IF NOT EXISTS idx_live_loc_patient ON public.live_location_sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_live_loc_status ON public.live_location_sessions(status);

-- 2. Fully Qualified RLS Policies
ALTER TABLE public.live_location_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Caregivers can view their own live location sessions" ON public.live_location_sessions;
CREATE POLICY "Caregivers can view their own live location sessions"
  ON public.live_location_sessions FOR SELECT
  TO authenticated
  USING (
    public.live_location_sessions.caregiver_id = auth.uid()
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
    public.live_location_sessions.patient_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.caregiver_patient cp
      WHERE cp.caregiver_id = public.live_location_sessions.caregiver_id
        AND cp.patient_id = auth.uid()
    )
  );

-- 3. Drop existing RPC functions so return type can be updated safely
DROP FUNCTION IF EXISTS public.request_live_location(UUID);
DROP FUNCTION IF EXISTS public.respond_live_location_request(UUID, BOOLEAN);
DROP FUNCTION IF EXISTS public.patient_start_live_location();

-- 4. RPC: request_live_location (Caregiver requests location)
CREATE OR REPLACE FUNCTION public.request_live_location(p_patient_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
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

  -- If session is already active and not expired, return it without disrupting active streaming
  SELECT * INTO v_session
  FROM public.live_location_sessions
  WHERE live_location_sessions.caregiver_id = v_caller_id
    AND live_location_sessions.patient_id = p_patient_id;

  IF v_session.id IS NOT NULL AND v_session.status = 'active' AND (v_session.expires_at IS NULL OR v_session.expires_at > now()) THEN
    RETURN jsonb_build_object(
      'id', v_session.id,
      'caregiver_id', v_session.caregiver_id,
      'patient_id', v_session.patient_id,
      'status', v_session.status,
      'requested_at', v_session.requested_at,
      'started_at', v_session.started_at,
      'last_seen_at', v_session.last_seen_at,
      'stopped_at', v_session.stopped_at,
      'expires_at', v_session.expires_at,
      'last_latitude', v_session.last_latitude,
      'last_longitude', v_session.last_longitude,
      'accuracy_meters', v_session.accuracy_meters,
      'caregiver_name', COALESCE(v_caregiver_name, 'Your Caregiver'),
      'created_at', v_session.created_at,
      'updated_at', v_session.updated_at
    );
  END IF;

  -- Create or reset session to requested
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
    live_location_sessions.started_at,
    live_location_sessions.last_seen_at,
    live_location_sessions.stopped_at,
    live_location_sessions.expires_at,
    live_location_sessions.last_latitude,
    live_location_sessions.last_longitude,
    live_location_sessions.accuracy_meters,
    live_location_sessions.created_at,
    live_location_sessions.updated_at
  INTO v_session;

  RETURN jsonb_build_object(
    'id', v_session.id,
    'caregiver_id', v_session.caregiver_id,
    'patient_id', v_session.patient_id,
    'status', v_session.status,
    'requested_at', v_session.requested_at,
    'started_at', v_session.started_at,
    'last_seen_at', v_session.last_seen_at,
    'stopped_at', v_session.stopped_at,
    'expires_at', v_session.expires_at,
    'last_latitude', v_session.last_latitude,
    'last_longitude', v_session.last_longitude,
    'accuracy_meters', v_session.accuracy_meters,
    'caregiver_name', COALESCE(v_caregiver_name, 'Your Caregiver'),
    'created_at', v_session.created_at,
    'updated_at', v_session.updated_at
  );
END;
$$;

-- 5. RPC: respond_live_location_request (Patient approves or declines)
CREATE OR REPLACE FUNCTION public.respond_live_location_request(
  p_session_id UUID,
  p_accept BOOLEAN
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  v_caller_id UUID;
  v_session RECORD;
  v_caregiver_name TEXT;
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
    UPDATE public.live_location_sessions
    SET
      status = 'active',
      started_at = now(),
      last_seen_at = now(),
      stopped_at = NULL,
      expires_at = now() + interval '2 hours',
      updated_at = now()
    WHERE live_location_sessions.id = p_session_id
    RETURNING
      live_location_sessions.id,
      live_location_sessions.caregiver_id,
      live_location_sessions.patient_id,
      live_location_sessions.status,
      live_location_sessions.requested_at,
      live_location_sessions.started_at,
      live_location_sessions.last_seen_at,
      live_location_sessions.stopped_at,
      live_location_sessions.expires_at,
      live_location_sessions.last_latitude,
      live_location_sessions.last_longitude,
      live_location_sessions.accuracy_meters,
      live_location_sessions.created_at,
      live_location_sessions.updated_at
    INTO v_session;
  ELSE
    UPDATE public.live_location_sessions
    SET
      status = 'stopped',
      stopped_at = now(),
      updated_at = now()
    WHERE live_location_sessions.id = p_session_id
    RETURNING
      live_location_sessions.id,
      live_location_sessions.caregiver_id,
      live_location_sessions.patient_id,
      live_location_sessions.status,
      live_location_sessions.requested_at,
      live_location_sessions.started_at,
      live_location_sessions.last_seen_at,
      live_location_sessions.stopped_at,
      live_location_sessions.expires_at,
      live_location_sessions.last_latitude,
      live_location_sessions.last_longitude,
      live_location_sessions.accuracy_meters,
      live_location_sessions.created_at,
      live_location_sessions.updated_at
    INTO v_session;
  END IF;

  SELECT COALESCE(full_name, preferred_name, 'Your Caregiver') INTO v_caregiver_name
  FROM public.profiles
  WHERE profiles.id = v_session.caregiver_id;

  RETURN jsonb_build_object(
    'id', v_session.id,
    'caregiver_id', v_session.caregiver_id,
    'patient_id', v_session.patient_id,
    'status', v_session.status,
    'requested_at', v_session.requested_at,
    'started_at', v_session.started_at,
    'last_seen_at', v_session.last_seen_at,
    'stopped_at', v_session.stopped_at,
    'expires_at', v_session.expires_at,
    'last_latitude', v_session.last_latitude,
    'last_longitude', v_session.last_longitude,
    'accuracy_meters', v_session.accuracy_meters,
    'caregiver_name', COALESCE(v_caregiver_name, 'Your Caregiver'),
    'created_at', v_session.created_at,
    'updated_at', v_session.updated_at
  );
END;
$$;

-- 6. RPC: patient_start_live_location (Patient directly initiates sharing)
CREATE OR REPLACE FUNCTION public.patient_start_live_location()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
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
    live_location_sessions.requested_at,
    live_location_sessions.started_at,
    live_location_sessions.last_seen_at,
    live_location_sessions.stopped_at,
    live_location_sessions.expires_at,
    live_location_sessions.last_latitude,
    live_location_sessions.last_longitude,
    live_location_sessions.accuracy_meters,
    live_location_sessions.created_at,
    live_location_sessions.updated_at
  INTO v_session;

  RETURN jsonb_build_object(
    'id', v_session.id,
    'caregiver_id', v_session.caregiver_id,
    'patient_id', v_session.patient_id,
    'status', v_session.status,
    'requested_at', v_session.requested_at,
    'started_at', v_session.started_at,
    'last_seen_at', v_session.last_seen_at,
    'stopped_at', v_session.stopped_at,
    'expires_at', v_session.expires_at,
    'last_latitude', v_session.last_latitude,
    'last_longitude', v_session.last_longitude,
    'accuracy_meters', v_session.accuracy_meters,
    'caregiver_name', COALESCE(v_caregiver_name, 'Your Caregiver'),
    'created_at', v_session.created_at,
    'updated_at', v_session.updated_at
  );
END;
$$;

-- 7. RPC: update_live_location (Patient streams live coords & heartbeat)
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
#variable_conflict use_column
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

-- 8. RPC: stop_live_location (Stop sharing by either participant)
CREATE OR REPLACE FUNCTION public.stop_live_location(p_session_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
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

-- 9. Permissions on Location RPCs
REVOKE ALL ON FUNCTION public.request_live_location(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_live_location(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.respond_live_location_request(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_live_location_request(UUID, BOOLEAN) TO authenticated;

REVOKE ALL ON FUNCTION public.patient_start_live_location() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.patient_start_live_location() TO authenticated;

REVOKE ALL ON FUNCTION public.update_live_location(UUID, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_live_location(UUID, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;

REVOKE ALL ON FUNCTION public.stop_live_location(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.stop_live_location(UUID) TO authenticated;

-- 10. Enable Supabase Realtime & Replica Identity
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

ALTER TABLE public.live_location_sessions REPLICA IDENTITY FULL;
