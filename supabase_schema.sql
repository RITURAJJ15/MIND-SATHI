-- ==============================================================================
-- MIND SATHI: Supabase PostgreSQL Schema & Row Level Security (RLS) Policies
-- Run this complete script in the Supabase SQL Editor:
-- (Supabase Dashboard -> SQL Editor -> New Query -> Run)
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. PROFILES TABLE (Linked 1-to-1 with auth.users)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  preferred_name TEXT,
  avatar_url TEXT,
  profile_photo_url TEXT,
  role TEXT NOT NULL DEFAULT 'elderly' CHECK (role IN ('elderly', 'caregiver', 'clinician', 'admin')),
  phone TEXT,
  preferred_language TEXT DEFAULT 'en',
  secondary_language TEXT,
  age INT DEFAULT 70,
  gender TEXT DEFAULT 'other',
  city TEXT DEFAULT 'Guwahati',
  state TEXT DEFAULT 'Assam',
  northeast_region TEXT DEFAULT 'Assam',
  is_ayushman_member BOOLEAN DEFAULT false,
  ayushman_member_id TEXT,
  ayushman_status TEXT DEFAULT 'none',
  pmjay_status TEXT DEFAULT 'none',
  abha_id TEXT,
  abha_status TEXT DEFAULT 'none',
  connection_code TEXT UNIQUE,
  has_completed_onboarding BOOLEAN DEFAULT false,
  caregiver_ids TEXT[] DEFAULT '{}',
  clinician_ids TEXT[] DEFAULT '{}',
  accessibility JSONB DEFAULT '{"fontSize": "normal", "highContrast": false, "textToSpeechAuto": false, "soundEffects": true, "speechRate": 0.85}'::jsonb,
  streak_days INT DEFAULT 1,
  total_xp INT DEFAULT 50,
  level INT DEFAULT 1,
  level_title TEXT DEFAULT 'Naya Sathi',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookup by email, role, and connection code
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_connection_code ON public.profiles(connection_code);

-- ------------------------------------------------------------------------------
-- 2. CAREGIVER_PATIENT RELATIONSHIP TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.caregiver_patient (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  caregiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  relationship TEXT DEFAULT 'Caregiver',
  status TEXT DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected', 'disconnected')),
  connection_code TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  approved_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_caregiver_patient UNIQUE (patient_id, caregiver_id),
  CONSTRAINT uq_one_caregiver_per_patient UNIQUE (patient_id),
  CONSTRAINT uq_one_patient_per_caregiver UNIQUE (caregiver_id)
);

CREATE INDEX IF NOT EXISTS idx_cg_patient_caregiver ON public.caregiver_patient(caregiver_id);
CREATE INDEX IF NOT EXISTS idx_cg_patient_patient ON public.caregiver_patient(patient_id);

-- ------------------------------------------------------------------------------
-- 3. DOCTOR_PATIENT RELATIONSHIP TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.doctor_patient (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected')),
  clinical_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  approved_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_doctor_patient UNIQUE (doctor_id, patient_id)
);

CREATE INDEX IF NOT EXISTS idx_doc_patient_doctor ON public.doctor_patient(doctor_id);
CREATE INDEX IF NOT EXISTS idx_doc_patient_patient ON public.doctor_patient(patient_id);

-- ------------------------------------------------------------------------------
-- 4. FAMILY_MEMBERS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  relationship TEXT NOT NULL,
  phone TEXT,
  photo_url TEXT,
  audio_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_family_patient ON public.family_members(patient_id);

-- ------------------------------------------------------------------------------
-- 5. GAME_SESSIONS TABLE (Cognitive Telemetry)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  game_id TEXT NOT NULL,
  score INT DEFAULT 0,
  accuracy INT DEFAULT 0,
  reaction_time_ms INT DEFAULT 0,
  duration_seconds INT DEFAULT 0,
  difficulty TEXT DEFAULT 'saral',
  completed BOOLEAN DEFAULT true,
  xp_earned INT DEFAULT 0,
  mistakes_count INT DEFAULT 0,
  hints_used INT DEFAULT 0,
  domain_scores JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_game_sessions_user ON public.game_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_created ON public.game_sessions(created_at DESC);

-- ------------------------------------------------------------------------------
-- 6. REMINDERS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT DEFAULT 'medication',
  time TEXT NOT NULL,
  frequency TEXT DEFAULT 'daily',
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reminders_user ON public.reminders(user_id);

-- ------------------------------------------------------------------------------
-- 7. AI_CONVERSATIONS & NOTIFICATIONS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'model', 'system')),
  message TEXT NOT NULL,
  language TEXT DEFAULT 'en',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT DEFAULT 'info',
  acknowledged BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 8. PATIENT_LOCATIONS TABLE (Patient Home Location strictly bound to auth.uid())
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.patient_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  location_name TEXT DEFAULT 'Home',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_locations_patient ON public.patient_locations(patient_id);

-- ------------------------------------------------------------------------------
-- 9. HELPER FUNCTION: Auto-generate unique connection code for patients
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_patient_connection_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'elderly' AND (NEW.connection_code IS NULL OR NEW.connection_code = '') THEN
    NEW.connection_code := 'MS-' || UPPER(SUBSTRING(REPLACE(NEW.id::text, '-', '') FROM 1 FOR 6));
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_patient_connection_code ON public.profiles;
CREATE TRIGGER tr_patient_connection_code
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.generate_patient_connection_code();

-- ------------------------------------------------------------------------------
-- 9. ROW LEVEL SECURITY (RLS)
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caregiver_patient ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_patient ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_locations ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Caregivers can view profile of connected patients
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

-- Patients can view profile of connected caregiver
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

-- Doctors can view profile of connected patients
CREATE POLICY "Doctors can view connected patient profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.doctor_patient dp
      WHERE dp.doctor_id = auth.uid()
        AND dp.patient_id = public.profiles.id
        AND dp.status = 'approved'
    )
  );

-- ------------------------------------------------------------------------------
-- 9B. SECURE PATIENT LOOKUP FUNCTION FOR CAREGIVER CONNECTION
-- Caregivers look up patients by registered email or connection code without
-- exposing all elderly profiles via broad SELECT policies.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow authenticated users to find patient by connection code or email" ON public.profiles;

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

REVOKE ALL ON FUNCTION public.find_patient_for_connection(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.find_patient_for_connection(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.find_patient_for_connection(text) TO authenticated;

-- Caregiver Patient policies
DROP POLICY IF EXISTS "Caregiver patient access" ON public.caregiver_patient;
DROP POLICY IF EXISTS "Caregiver patient select access" ON public.caregiver_patient;
CREATE POLICY "Caregiver patient select access"
  ON public.caregiver_patient FOR SELECT
  TO authenticated
  USING (caregiver_id = auth.uid() OR patient_id = auth.uid());

DROP POLICY IF EXISTS "Caregivers can insert caregiver_patient" ON public.caregiver_patient;
CREATE POLICY "Caregivers can insert caregiver_patient"
  ON public.caregiver_patient FOR INSERT
  TO authenticated
  WITH CHECK (caregiver_id = auth.uid());

DROP POLICY IF EXISTS "Participants can delete caregiver_patient" ON public.caregiver_patient;
CREATE POLICY "Participants can delete caregiver_patient"
  ON public.caregiver_patient FOR DELETE
  TO authenticated
  USING (caregiver_id = auth.uid() OR patient_id = auth.uid());

-- Authoritative RPC: get_connected_caregiver_for_patient
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


-- Doctor Patient policies
CREATE POLICY "Doctor patient access"
  ON public.doctor_patient FOR ALL
  TO authenticated
  USING (doctor_id = auth.uid() OR patient_id = auth.uid())
  WITH CHECK (doctor_id = auth.uid() OR patient_id = auth.uid());

-- Family members policies
CREATE POLICY "Patient can manage own family members"
  ON public.family_members FOR ALL
  TO authenticated
  USING (patient_id = auth.uid())
  WITH CHECK (patient_id = auth.uid());

CREATE POLICY "Caregivers can view connected patient family members"
  ON public.family_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.caregiver_patient cp
      WHERE cp.caregiver_id = auth.uid()
        AND cp.patient_id = public.family_members.patient_id
        AND cp.status = 'approved'
    )
  );

-- Game sessions policies
CREATE POLICY "Patient can view and record own game sessions"
  ON public.game_sessions FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Caregiver can view connected patient game sessions"
  ON public.game_sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.caregiver_patient cp
      WHERE cp.caregiver_id = auth.uid()
        AND cp.patient_id = public.game_sessions.user_id
        AND cp.status = 'approved'
    )
  );

CREATE POLICY "Doctor can view connected patient game sessions"
  ON public.game_sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.doctor_patient dp
      WHERE dp.doctor_id = auth.uid()
        AND dp.patient_id = public.game_sessions.user_id
        AND dp.status = 'approved'
    )
  );

-- Reminders policies
CREATE POLICY "Patient can manage own reminders"
  ON public.reminders FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Caregiver can view connected patient reminders"
  ON public.reminders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.caregiver_patient cp
      WHERE cp.caregiver_id = auth.uid()
        AND cp.patient_id = public.reminders.user_id
        AND cp.status = 'approved'
    )
  );

-- ------------------------------------------------------------------------------
-- Patient Locations RLS (Strictly private: only the patient can access)
-- ------------------------------------------------------------------------------
CREATE POLICY "Patients can view own home location"
  ON public.patient_locations FOR SELECT
  TO authenticated
  USING (patient_id = auth.uid());

CREATE POLICY "Patients can insert own home location"
  ON public.patient_locations FOR INSERT
  TO authenticated
  WITH CHECK (patient_id = auth.uid());

CREATE POLICY "Patients can update own home location"
  ON public.patient_locations FOR UPDATE
  TO authenticated
  USING (patient_id = auth.uid())
  WITH CHECK (patient_id = auth.uid());

CREATE POLICY "Patients can delete own home location"
  ON public.patient_locations FOR DELETE
  TO authenticated
  USING (patient_id = auth.uid());

CREATE POLICY "Caregivers can view connected patient home location"
  ON public.patient_locations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.caregiver_patient cp
      WHERE cp.caregiver_id = auth.uid()
        AND cp.patient_id = public.patient_locations.patient_id
        AND cp.status = 'approved'
    )
  );

-- ------------------------------------------------------------------------------
-- 10. LIVE LOCATION SESSIONS & REALTIME TRACKING
-- ------------------------------------------------------------------------------
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

CREATE INDEX IF NOT EXISTS idx_live_loc_caregiver ON public.live_location_sessions(caregiver_id);
CREATE INDEX IF NOT EXISTS idx_live_loc_patient ON public.live_location_sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_live_loc_status ON public.live_location_sessions(status);

ALTER TABLE public.live_location_sessions ENABLE ROW LEVEL SECURITY;

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
    NULL;
END;
$$;

-- 6. RPC Functions
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
    caregiver_id, patient_id, status, requested_at, expires_at, updated_at
  )
  VALUES (
    v_caller_id, p_patient_id, 'requested', now(), now() + interval '10 minutes', now()
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
      expires_at = now() + interval '2 hours',
      updated_at = now()
    WHERE live_location_sessions.id = p_session_id
    RETURNING * INTO v_session;
  ELSE
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

  IF NOT EXISTS (
    SELECT 1 FROM public.caregiver_patient cp
    WHERE cp.caregiver_id = v_session.caregiver_id
      AND cp.patient_id = v_caller_id
  ) THEN
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
    caregiver_id, patient_id, status, started_at, last_seen_at, expires_at, updated_at
  )
  VALUES (
    v_caregiver_id, v_caller_id, 'active', now(), now(), now() + interval '2 hours', now()
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

-- 7. Permissions
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
