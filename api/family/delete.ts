import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(204).end();
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  // 1. Authenticate the caller via Supabase JWT
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Authorization bearer token missing.',
    });
  }

  if (!supabase) {
    return res.status(503).json({ success: false, error: 'Database service unavailable' });
  }

  const token = authHeader.substring(7).trim();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired session. Please sign in again.',
    });
  }

  try {
    const { memberId, patientId, name } = req.body || {};

    if (!memberId && !name) {
      return res.status(400).json({ success: false, error: 'Missing memberId or name' });
    }

    // 2. Ownership check: Caller can only delete family members belonging to their own patient account
    const targetPatientId = patientId || user.id;
    if (targetPatientId !== user.id) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You can only delete family members associated with your own account.',
      });
    }

    let deletedCount = 0;

    // 3. Delete by member UUID scoped strictly to the authenticated user's patient_id
    if (memberId && typeof memberId === 'string' && memberId.includes('-') && memberId.length >= 20) {
      const { error, count } = await supabase
        .from('family_members')
        .delete({ count: 'exact' })
        .eq('id', memberId)
        .eq('patient_id', user.id);

      if (!error && count) deletedCount += count;
    }

    // 4. Delete by name scoped strictly to the authenticated user's patient_id
    if (name && typeof name === 'string') {
      const { error, count } = await supabase
        .from('family_members')
        .delete({ count: 'exact' })
        .eq('patient_id', user.id)
        .eq('name', name);

      if (!error && count) deletedCount += count;
    }

    return res.status(200).json({
      success: true,
      message: 'Family member removed successfully.',
      deletedCount,
    });
  } catch (error: any) {
    console.error('[FamilyDelete] Internal error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete family member from database.',
    });
  }
}
