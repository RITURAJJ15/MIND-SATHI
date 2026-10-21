import * as crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

function getAdminSecret(): string {
  return (
    process.env.ADMIN_JWT_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.ADMIN_PASSWORD ||
    ''
  );
}

export function signAdminToken(adminId: string, ttlHours = 8): string {
  const secret = getAdminSecret();
  if (!secret) {
    throw new Error('ADMIN_SECRET is not configured on the server');
  }

  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub: adminId,
      role: 'admin',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + ttlHours * 3600,
    })
  ).toString('base64url');

  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64url');

  return `${header}.${payload}.${signature}`;
}

export function verifyAdminToken(token: string): { valid: boolean; adminId?: string; error?: string } {
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

export async function verifyCallerIsAdmin(
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

export default async function handler(req: any, res: any) {
  return res?.status?.(404)?.json?.({ success: false, error: 'Not an endpoint' });
}
