-- ==============================================================================
-- MIND SATHI: Database Migration
-- 20261017_align_game_sessions_schema.sql
-- ──────────────────────────────────────────────────────────────────────────────
-- PURPOSE:
-- Aligns the `game_sessions` table schema with application query/insert patterns
-- across `gameService.ts`, `syncService.ts`, and `geminiService.ts`.
-- 
-- CHANGES (Additive & Backward-Compatible):
-- 1. Adds `patient_id UUID REFERENCES public.profiles(id)` if not present.
-- 2. Adds `completed_at TIMESTAMPTZ` if not present.
-- 3. Adds `metadata JSONB DEFAULT '{}'::jsonb` if not present.
-- 4. Backfills existing rows: patient_id = user_id, completed_at = created_at.
-- 5. Adds trigger to keep `user_id` and `patient_id` mutually synchronized.
-- 6. Adds trigger to keep `created_at` and `completed_at` mutually synchronized.
-- 7. Updates Row Level Security (RLS) policies to check user_id OR patient_id.
--
-- ROLLBACK INSTRUCTIONS (Provided in comments at bottom of this file):
-- To revert this migration without data loss, follow the steps documented below.
-- ==============================================================================

-- 1. Additive Column Alterations
ALTER TABLE public.game_sessions 
  ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.game_sessions 
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.game_sessions 
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Make user_id nullable if it was strictly NOT NULL, to permit inserts with patient_id
ALTER TABLE public.game_sessions 
  ALTER COLUMN user_id DROP NOT NULL;

-- 2. Backfill existing records
UPDATE public.game_sessions
SET 
  patient_id = COALESCE(patient_id, user_id),
  user_id = COALESCE(user_id, patient_id),
  completed_at = COALESCE(completed_at, created_at, now()),
  created_at = COALESCE(created_at, completed_at, now())
WHERE patient_id IS NULL OR user_id IS NULL OR completed_at IS NULL;

-- 3. Supplementary Performance Indexes
CREATE INDEX IF NOT EXISTS idx_game_sessions_patient ON public.game_sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_completed ON public.game_sessions(completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_sessions_metadata ON public.game_sessions USING gin(metadata);

-- 4. Synchronization Trigger Function
CREATE OR REPLACE FUNCTION public.trg_sync_game_sessions_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Synchronize identifier columns
  IF NEW.patient_id IS NULL AND NEW.user_id IS NOT NULL THEN
    NEW.patient_id := NEW.user_id;
  ELSIF NEW.user_id IS NULL AND NEW.patient_id IS NOT NULL THEN
    NEW.user_id := NEW.patient_id;
  END IF;

  -- Synchronize timestamp columns
  IF NEW.completed_at IS NULL AND NEW.created_at IS NOT NULL THEN
    NEW.completed_at := NEW.created_at;
  ELSIF NEW.created_at IS NULL AND NEW.completed_at IS NOT NULL THEN
    NEW.created_at := NEW.completed_at;
  ELSIF NEW.completed_at IS NULL AND NEW.created_at IS NULL THEN
    NEW.completed_at := now();
    NEW.created_at := now();
  END IF;

  -- Ensure metadata is valid JSONB
  IF NEW.metadata IS NULL THEN
    NEW.metadata := '{}'::jsonb;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_game_sessions_sync ON public.game_sessions;
CREATE TRIGGER trg_game_sessions_sync
  BEFORE INSERT OR UPDATE ON public.game_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_game_sessions_fields();

-- 5. Updated Row Level Security Policies
DROP POLICY IF EXISTS "Patient can view and record own game sessions" ON public.game_sessions;
CREATE POLICY "Patient can view and record own game sessions"
  ON public.game_sessions FOR ALL
  TO authenticated
  USING (user_id = auth.uid() OR patient_id = auth.uid())
  WITH CHECK (user_id = auth.uid() OR patient_id = auth.uid());

DROP POLICY IF EXISTS "Caregiver can view connected patient game sessions" ON public.game_sessions;
CREATE POLICY "Caregiver can view connected patient game sessions"
  ON public.game_sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.caregiver_patient cp
      WHERE cp.caregiver_id = auth.uid()
        AND (cp.patient_id = public.game_sessions.user_id OR cp.patient_id = public.game_sessions.patient_id)
        AND cp.status = 'approved'
    )
  );

DROP POLICY IF EXISTS "Doctor can view connected patient game sessions" ON public.game_sessions;
CREATE POLICY "Doctor can view connected patient game sessions"
  ON public.game_sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.doctor_patient dp
      WHERE dp.doctor_id = auth.uid()
        AND (dp.patient_id = public.game_sessions.user_id OR dp.patient_id = public.game_sessions.patient_id)
        AND dp.status = 'approved'
    )
  );

-- ==============================================================================
-- ROLLBACK SCRIPT (Do not run unless intentionally reverting this migration)
-- ==============================================================================
-- DROP TRIGGER IF EXISTS trg_game_sessions_sync ON public.game_sessions;
-- DROP FUNCTION IF EXISTS public.trg_sync_game_sessions_fields();
-- DROP INDEX IF EXISTS public.idx_game_sessions_patient;
-- DROP INDEX IF EXISTS public.idx_game_sessions_completed;
-- DROP INDEX IF EXISTS public.idx_game_sessions_metadata;
-- DROP POLICY IF EXISTS "Patient can view and record own game sessions" ON public.game_sessions;
-- CREATE POLICY "Patient can view and record own game sessions"
--   ON public.game_sessions FOR ALL TO authenticated
--   USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
-- ALTER TABLE public.game_sessions DROP COLUMN IF EXISTS patient_id;
-- ALTER TABLE public.game_sessions DROP COLUMN IF EXISTS completed_at;
-- ALTER TABLE public.game_sessions DROP COLUMN IF EXISTS metadata;
-- ==============================================================================
