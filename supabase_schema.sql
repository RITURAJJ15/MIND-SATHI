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
  USING (
    EXISTS (
      SELECT 1 FROM public.caregiver_patient cp
      WHERE cp.caregiver_id = auth.uid()
        AND cp.patient_id = public.profiles.id
        AND cp.status = 'approved'
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
  -- 1. Verify caller is authenticated
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: caller must be logged in' USING ERRCODE = '28000';
  END IF;

  -- 2. Verify caller has caregiver role in profiles
  SELECT p.role INTO v_caller_role
  FROM public.profiles p
  WHERE p.id = v_caller_id;

  IF v_caller_role IS NULL OR v_caller_role != 'caregiver' THEN
    RAISE EXCEPTION 'Access denied: caller must have caregiver role' USING ERRCODE = '42501';
  END IF;

  -- 3. Normalize search identifier
  v_clean_input := lower(trim(COALESCE(identifier, '')));
  IF v_clean_input = '' THEN
    RETURN;
  END IF;

  v_clean_upper := upper(trim(identifier));
  v_code_no_prefix := regexp_replace(v_clean_upper, '^MS-?', '', 'i');

  -- 4. Locate matching patient profile (minimal safe projection only)
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
      -- Match by exact email (case-insensitive)
      lower(p.email) = v_clean_input
      -- Match by connection_code
      OR (p.connection_code IS NOT NULL AND (
        upper(p.connection_code) = v_clean_upper
        OR upper(p.connection_code) = 'MS-' || v_clean_upper
        OR upper(regexp_replace(p.connection_code, '^MS-?', '', 'i')) = v_code_no_prefix
      ))
      -- Match by legacy connection code in secondary_language
      OR (p.secondary_language IS NOT NULL AND (
        upper(p.secondary_language) = v_clean_upper
        OR upper(p.secondary_language) = 'MS-' || v_clean_upper
        OR upper(regexp_replace(p.secondary_language, '^MS-?', '', 'i')) = v_code_no_prefix
      ))
      -- Match by UUID if input is UUID
      OR (v_clean_input ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND p.id::text = v_clean_input)
    )
  LIMIT 1;

  -- If no matching elderly patient found, return empty set
  IF v_patient.id IS NULL THEN
    RETURN;
  END IF;

  -- 5. Check relationship in caregiver_patient to detect already-linked status
  SELECT cp.caregiver_id INTO v_existing_caregiver
  FROM public.caregiver_patient cp
  WHERE cp.patient_id = v_patient.id
    AND cp.status = 'approved'
  LIMIT 1;

  -- 6. Return minimal identity fields and linking flags
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

REVOKE ALL ON FUNCTION public.find_patient_for_connection(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.find_patient_for_connection(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.find_patient_for_connection(text) TO authenticated;

-- Caregiver Patient policies
CREATE POLICY "Caregiver patient access"
  ON public.caregiver_patient FOR ALL
  TO authenticated
  USING (caregiver_id = auth.uid() OR patient_id = auth.uid())
  WITH CHECK (caregiver_id = auth.uid() OR patient_id = auth.uid());

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
-- 10. LIVE LOCATION SESSIONS & TRACKING TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.live_location_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  caregiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'approved', 'active', 'ended', 'rejected')),
  started_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '1 hour'),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.live_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.live_location_sessions(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy_meters DOUBLE PRECISION,
  recorded_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.live_location_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patient or Caregiver can view their live location sessions"
  ON public.live_location_sessions FOR SELECT
  TO authenticated
  USING (patient_id = auth.uid() OR caregiver_id = auth.uid());

CREATE POLICY "Patient or Caregiver can manage their live location sessions"
  ON public.live_location_sessions FOR ALL
  TO authenticated
  USING (patient_id = auth.uid() OR caregiver_id = auth.uid())
  WITH CHECK (patient_id = auth.uid() OR caregiver_id = auth.uid());

CREATE POLICY "Patient can insert live location coordinates"
  ON public.live_locations FOR INSERT
  TO authenticated
  WITH CHECK (patient_id = auth.uid());

CREATE POLICY "Authorized Caregiver can view patient live locations"
  ON public.live_locations FOR SELECT
  TO authenticated
  USING (
    patient_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.live_location_sessions lls
      WHERE lls.id = public.live_locations.session_id
        AND lls.caregiver_id = auth.uid()
        AND lls.status IN ('approved', 'active')
    )
  );

