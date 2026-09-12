-- ============================================================================
-- MIGRATION: 20260912_create_daily_patient_plans.sql
-- DESCRIPTION: Personalized 7-Day Rotating Daily Plan table with RLS
-- IDEMPOTENT: Safe to run multiple times in Supabase SQL Editor.
-- ============================================================================

-- 1. Create table public.daily_patient_plans
CREATE TABLE IF NOT EXISTS public.daily_patient_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_date DATE NOT NULL,
  day_of_week TEXT NOT NULL,
  focus_area TEXT NOT NULL,
  difficulty TEXT NOT NULL DEFAULT 'saral',
  estimated_duration INTEGER NOT NULL DEFAULT 15,
  ai_reason TEXT,
  recommended_games JSONB NOT NULL DEFAULT '[]'::jsonb,
  tasks JSONB NOT NULL DEFAULT '[]'::jsonb,
  completed_task_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  earned_xp INTEGER NOT NULL DEFAULT 0,
  is_all_completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_patient_plan_date UNIQUE (patient_id, plan_date)
);

-- 2. Indexes for efficient lookup
CREATE INDEX IF NOT EXISTS idx_daily_plans_patient_date ON public.daily_patient_plans(patient_id, plan_date);
CREATE INDEX IF NOT EXISTS idx_daily_plans_date ON public.daily_patient_plans(plan_date);

-- 3. Row Level Security
ALTER TABLE public.daily_patient_plans ENABLE ROW LEVEL SECURITY;

-- Patients can view, insert, and update their own daily plans
DROP POLICY IF EXISTS "Patients can view their own daily plans" ON public.daily_patient_plans;
CREATE POLICY "Patients can view their own daily plans"
  ON public.daily_patient_plans FOR SELECT
  TO authenticated
  USING (patient_id = auth.uid());

DROP POLICY IF EXISTS "Patients can insert their own daily plans" ON public.daily_patient_plans;
CREATE POLICY "Patients can insert their own daily plans"
  ON public.daily_patient_plans FOR INSERT
  TO authenticated
  WITH CHECK (patient_id = auth.uid());

DROP POLICY IF EXISTS "Patients can update their own daily plans" ON public.daily_patient_plans;
CREATE POLICY "Patients can update their own daily plans"
  ON public.daily_patient_plans FOR UPDATE
  TO authenticated
  USING (patient_id = auth.uid())
  WITH CHECK (patient_id = auth.uid());

-- Caregivers can view daily plans for authorized connected patients
DROP POLICY IF EXISTS "Caregivers can view connected patient daily plans" ON public.daily_patient_plans;
CREATE POLICY "Caregivers can view connected patient daily plans"
  ON public.daily_patient_plans FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.caregiver_patient cp
      WHERE cp.caregiver_id = auth.uid()
        AND cp.patient_id = public.daily_patient_plans.patient_id
    )
  );

-- 4. Enable Supabase Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'daily_patient_plans'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_patient_plans;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END;
$$;

ALTER TABLE public.daily_patient_plans REPLICA IDENTITY FULL;
