import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { verifyCallerIsAdmin } from './_auth';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

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

  if (!supabase) {
    return res.status(503).json({
      success: false,
      error: 'Database connection is not configured on the server',
    });
  }

  // Enforce strict administrator authentication and authorization
  const authResult = await verifyCallerIsAdmin(req.headers.authorization, supabase);
  if (!authResult.authorized) {
    return res.status(403).json({
      success: false,
      error: authResult.reason || 'Forbidden: Administrator authorization required.',
    });
  }

  try {
    const [profilesRes, sessionsRes, linksRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, preferred_name, role, age, gender, city, state, northeast_region, is_ayushman_member, ayushman_status, pmjay_status, abha_status, has_completed_onboarding, streak_days, total_xp, level, level_title, created_at').limit(500),
      supabase.from('game_sessions').select('*').order('created_at', { ascending: false }).limit(500),
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
