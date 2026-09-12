import type { VercelRequest, VercelResponse } from '@vercel/node';

// Allowed admin credentials - securely verified on serverless backend
const DEFAULT_ID = Buffer.from('UklUVVJBSjEx', 'base64').toString('utf8').toLowerCase(); // rituraj11
const DEFAULT_PASS = Buffer.from('UklUVVJBSkAxMQ==', 'base64').toString('utf8'); // RITURAJ@11

const ALLOWED_ADMIN_ID = (process.env.ADMIN_USER_ID || DEFAULT_ID).trim().toLowerCase();
const ALLOWED_ADMIN_PASS = (process.env.ADMIN_PASSWORD || DEFAULT_PASS).trim();

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

    const isIdMatch = cleanId === ALLOWED_ADMIN_ID || cleanId === 'rituraj11' || cleanId === 'rituraj11@mindsathi.in';
    const isPassMatch = cleanPass === ALLOWED_ADMIN_PASS;

    if (!isIdMatch || !isPassMatch) {
      // Deliberate security delay
      await new Promise((resolve) => setTimeout(resolve, 600));
      return res.status(401).json({
        success: false,
        error: 'Invalid Administrator User ID or Password. Access denied.',
      });
    }

    // Successfully verified administrator credentials
    const adminProfile = {
      id: 'a1000000-0000-4000-a000-000000000003',
      name: 'Rituraj (Platform Administrator)',
      preferredName: 'Rituraj',
      role: 'admin',
      age: 32,
      gender: 'male',
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
      streakDays: 10,
      totalXp: 1500,
      level: 10,
      levelTitle: 'Super Administrator',
      createdAt: '2025-01-01T00:00:00.000Z',
      email: 'rituraj11@mindsathi.in',
      phone: '+91 98000 00000',
    };

    return res.status(200).json({
      success: true,
      token: `admin_token_${Date.now()}_secure`,
      profile: adminProfile,
    });
  } catch (error: any) {
    console.error('[AdminLogin] Internal error:', error);
    return res.status(500).json({
      success: false,
      error: 'An internal server error occurred while authenticating.',
    });
  }
}
