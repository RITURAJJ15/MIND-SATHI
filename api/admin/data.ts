import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://tlyeuyflanjsowiqwrxo.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_gMWdqSThmv4s1E_lCM0iww_Calt7pJ0';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(204).end();
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    const [profilesRes, sessionsRes, linksRes] = await Promise.all([
      supabase.from('profiles').select('*').limit(500),
      supabase.from('game_sessions').select('*').order('completed_at', { ascending: false }).limit(500),
      supabase.from('caregiver_patient').select('*').limit(500),
    ]);

    const profiles = profilesRes.data || [];
    const gameSessions = sessionsRes.data || [];
    const links = linksRes.data || [];

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      profiles,
      gameSessions,
      links,
      counts: {
        profiles: profiles.length,
        gameSessions: gameSessions.length,
        links: links.length,
      },
    });
  } catch (error: any) {
    console.error('[AdminData] Fetch error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve admin telemetry data',
    });
  }
}
