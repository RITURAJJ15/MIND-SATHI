import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://tlyeuyflanjsowiqwrxo.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_gMWdqSThmv4s1E_lCM0iww_Calt7pJ0';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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

  try {
    const { memberId, patientId, name } = req.body || {};

    if (!memberId && !patientId) {
      return res.status(400).json({ success: false, error: 'Missing memberId or patientId' });
    }

    let deletedCount = 0;

    // 1. Delete by member UUID if valid
    if (memberId && typeof memberId === 'string' && memberId.includes('-') && memberId.length >= 20) {
      const { error, count } = await supabase
        .from('family_members')
        .delete({ count: 'exact' })
        .eq('id', memberId);

      if (!error && count) deletedCount += count;
    }

    // 2. Delete by patientId and member name if provided
    if (patientId && name && typeof patientId === 'string' && typeof name === 'string') {
      const { error, count } = await supabase
        .from('family_members')
        .delete({ count: 'exact' })
        .eq('patient_id', patientId)
        .eq('name', name);

      if (!error && count) deletedCount += count;
    }

    return res.status(200).json({
      success: true,
      message: 'Family member removed successfully from database.',
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
