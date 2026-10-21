import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as crypto from 'crypto';
import { signAdminToken } from './_auth';

function timingSafeMatch(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
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

  const allowedAdminId = (process.env.ADMIN_USER_ID || '').trim().toLowerCase();
  const allowedAdminPass = (process.env.ADMIN_PASSWORD || '').trim();

  // Fail closed if server credentials are not explicitly configured
  if (!allowedAdminId || !allowedAdminPass) {
    console.error('[AdminLogin] ADMIN_USER_ID or ADMIN_PASSWORD environment variable is not configured');
    return res.status(503).json({
      success: false,
      error: 'Administrator authentication is unavailable. Server credentials have not been configured.',
    });
  }

  try {
    const { userId, password } = req.body || {};

    const cleanId = (typeof userId === 'string' ? userId : '').trim().toLowerCase();
    const cleanPass = (typeof password === 'string' ? password : '').trim();

    if (!cleanId || !cleanPass) {
      return res.status(400).json({
        success: false,
        error: 'Administrator User ID and Password are required.',
      });
    }

    const isIdMatch = timingSafeMatch(cleanId, allowedAdminId);
    const isPassMatch = timingSafeMatch(cleanPass, allowedAdminPass);

    if (!isIdMatch || !isPassMatch) {
      // Deliberate security delay to resist brute force
      await new Promise((resolve) => setTimeout(resolve, 600));
      return res.status(401).json({
        success: false,
        error: 'Invalid Administrator User ID or Password. Access denied.',
      });
    }

    // Generate cryptographically signed HMAC admin token
    const token = signAdminToken(cleanId);

    const adminProfile = {
      id: 'a1000000-0000-4000-a000-000000000003',
      name: 'Platform Administrator',
      preferredName: 'Admin',
      role: 'admin',
      age: 35,
      gender: 'other',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&fit=crop&q=80',
      primaryLanguage: 'en',
      city: 'Guwahati',
      state: 'Assam',
      northeastRegion: 'Assam',
      isAyushmanMember: false,
      ayushmanStatus: 'none',
      pmjayStatus: 'none',
      abhaStatus: 'none',
      hasCompletedOnboarding: true,
      familyMemberCount: 0,
      caregiverIds: [],
      clinicianIds: [],
      streakDays: 1,
      totalXp: 1500,
      level: 10,
      levelTitle: 'Platform Administrator',
      createdAt: '2025-01-01T00:00:00.000Z',
      email: cleanId.includes('@') ? cleanId : undefined,
    };

    return res.status(200).json({
      success: true,
      token,
      profile: adminProfile,
    });
  } catch (error: any) {
    console.error('[AdminLogin] Authentication error:', error);
    return res.status(500).json({
      success: false,
      error: 'An internal server error occurred while authenticating.',
    });
  }
}
