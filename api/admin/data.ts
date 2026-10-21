import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as crypto from 'crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function getAdminSecret(): string {
  return (
    process.env.ADMIN_JWT_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.ADMIN_PASSWORD ||
    ''
  );
}

function verifyAdminToken(token: string): { valid: boolean; adminId?: string; error?: string } {
  const secret = getAdminSecret();
  if (!secret) {
    return { valid: false, error: 'Server authentication secret not configured' };
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false, error: 'Malformed token structure' };
  }

  const [header, payload, signature] = parts;
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64url');

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSig);

  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return { valid: false, error: 'Invalid token signature' };
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!decoded.exp || decoded.exp < Math.floor(Date.now() / 1000)) {
      return { valid: false, error: 'Token has expired' };
    }
    if (decoded.role !== 'admin') {
      return { valid: false, error: 'Insufficient token permissions' };
    }
    return { valid: true, adminId: decoded.sub };
  } catch {
    return { valid: false, error: 'Failed to decode token payload' };
  }
}

async function verifyCallerIsAdmin(
  authHeader: string | undefined,
  supabase: SupabaseClient
): Promise<{ authorized: boolean; reason?: string; adminId?: string }> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { authorized: false, reason: 'Missing or malformed Authorization header' };
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return { authorized: false, reason: 'Empty bearer token' };
  }

  // 1. Verify against server-signed admin token
  const tokenResult = verifyAdminToken(token);
  if (tokenResult.valid) {
    return { authorized: true, adminId: tokenResult.adminId };
  }

  // 2. Verify against Supabase user session token
  try {
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser(token);

    if (user && !userErr) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.role === 'admin' || user.app_metadata?.role === 'admin') {
        return { authorized: true, adminId: user.id };
      }

      return { authorized: false, reason: 'User does not possess administrative role' };
    }
  } catch (err: any) {
    console.warn('[AdminAuth] Supabase token check note:', err?.message || err);
  }

  return { authorized: false, reason: tokenResult.error || 'Invalid authentication token' };
}

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
