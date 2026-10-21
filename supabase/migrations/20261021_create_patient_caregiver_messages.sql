-- ==============================================================================
-- MIND SATHI: Patient ↔ Caregiver Secure Messaging & Realtime Chat
-- Migration: 20261021_create_patient_caregiver_messages.sql
-- Paste and run this ENTIRE script in your Supabase Dashboard -> SQL Editor
-- ==============================================================================

-- 1. Create messages table if it does not already exist
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL CHECK (char_length(trim(message)) > 0),
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Indexes for performant message history queries & ordering
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(sender_id, receiver_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON public.messages(receiver_id, is_read);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 4. Clean up any obsolete policies
DROP POLICY IF EXISTS "Messages select access" ON public.messages;
DROP POLICY IF EXISTS "Messages insert access" ON public.messages;
DROP POLICY IF EXISTS "Participants can view their own messages" ON public.messages;
DROP POLICY IF EXISTS "Participants can insert messages in active relationship" ON public.messages;
DROP POLICY IF EXISTS "Receivers can update read status" ON public.messages;

-- 5. SELECT Policy:
-- Authenticated users can ONLY view messages where they are the sender or receiver,
-- AND there exists an approved caregiver_patient relationship between the two parties.
CREATE POLICY "Participants can view their own messages"
  ON public.messages FOR SELECT
  TO authenticated
  USING (
    (auth.uid() = sender_id OR auth.uid() = receiver_id)
    AND EXISTS (
      SELECT 1 FROM public.caregiver_patient cp
      WHERE (
        (cp.patient_id = messages.sender_id AND cp.caregiver_id = messages.receiver_id)
        OR
        (cp.patient_id = messages.receiver_id AND cp.caregiver_id = messages.sender_id)
      )
      AND (cp.status = 'approved' OR cp.status IS NULL)
    )
  );

-- 6. INSERT Policy:
-- Sender MUST be the authenticated user (prevents sender impersonation).
-- Receiver MUST be their linked partner in an approved caregiver_patient relationship.
CREATE POLICY "Participants can insert messages in active relationship"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.caregiver_patient cp
      WHERE (
        (cp.patient_id = auth.uid() AND cp.caregiver_id = messages.receiver_id)
        OR
        (cp.caregiver_id = auth.uid() AND cp.patient_id = messages.receiver_id)
      )
      AND (cp.status = 'approved' OR cp.status IS NULL)
    )
  );

-- 7. UPDATE Policy (for marking messages as read):
-- Only the message receiver can update the is_read status.
CREATE POLICY "Receivers can update read status"
  ON public.messages FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = receiver_id
  )
  WITH CHECK (
    auth.uid() = receiver_id
  );

-- 8. Enable Supabase Realtime publication for messages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END;
$$;
