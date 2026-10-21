import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const FALLBACK_SUPABASE_URL = 'https://tlyeuyflanjsowiqwrxo.supabase.co';
const FALLBACK_SUPABASE_KEY = 'sb_publishable_gMWdqSThmv4s1E_lCM0iww_Calt7pJ0';

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  FALLBACK_SUPABASE_URL;

const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  FALLBACK_SUPABASE_KEY;

const supabase = (SUPABASE_URL && SUPABASE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

export type BookingAssistanceType = 'find_page' | 'find_phone' | 'booking_steps' | 'all';

export interface BookingAssistantResult {
  providerName: string;
  sourceUrl: string;
  officialBookingUrl: string | null;
  appointmentPhone: string | null;
  bookingSteps: string[];
  sourceUrls: string[];
  statusSummary: string;
  hasVerifiedBookingUrl: boolean;
  hasVerifiedPhone: boolean;
  hasBookingSteps: boolean;
  detailsFound: boolean;
  checkedAt: string;
}

export interface BookingAssistantResponse {
  success: boolean;
  configured: boolean;
  providerName: string;
  sourceUrl: string;
  assistanceType: BookingAssistanceType;
  result?: BookingAssistantResult;
  error?: string;
  message?: string;
  timestamp: string;
}

// ── In-Memory Rate Limiter (10 requests / 60 seconds per user) ───────────────
interface RateLimitRecord {
  count: number;
  resetAt: number;
}
const rateLimitMap = new Map<string, RateLimitRecord>();

function checkRateLimit(key: string, limit = 10, windowMs = 60000): boolean {
  const now = Date.now();
  // Lazily clean up stale records when map size exceeds threshold
  if (rateLimitMap.size > 500) {
    rateLimitMap.forEach((record, k) => {
      if (now > record.resetAt) {
        rateLimitMap.delete(k);
      }
    });
  }

  const record = rateLimitMap.get(key);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (record.count >= limit) {
    return false;
  }

  record.count += 1;
  return true;
}

// ── SSRF & URL Safety Validation ─────────────────────────────────────────────
const PRIVATE_IP_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  /^169\.254\./, // Cloud metadata
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
];

export function isSafeHttpsUrl(rawUrl: string): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== 'https:') return false;

    const hostname = parsed.hostname.toLowerCase();
    if (!hostname || !hostname.includes('.')) return false;

    for (const pattern of PRIVATE_IP_PATTERNS) {
      if (pattern.test(hostname)) return false;
    }

    return true;
  } catch {
    return false;
  }
}

export function sanitizeText(input: any, maxLen = 300): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/<[^>]*>?/gm, '') // Strip HTML tags
    .replace(/javascript:/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

export function sanitizePhone(rawPhone: any): string | null {
  if (typeof rawPhone !== 'string') return null;
  const cleaned = rawPhone.replace(/<[^>]*>?/gm, '').trim();
  // Valid phone pattern: optional +, digits, spaces, hyphens, parentheses
  const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{5,20}$/;
  if (!phoneRegex.test(cleaned)) {
    return null;
  }
  return cleaned.slice(0, 25);
}

// ── Safe Goal Generation (Strictly Read-Only, Zero PII) ───────────────────────
function buildAgentGoal(assistanceType: BookingAssistanceType, providerName: string): string {
  const baseRules =
    'CRITICAL MANDATES: Read-only assistance only. DO NOT fill in or submit any forms. DO NOT make reservations, bookings, or appointments. DO NOT enter personal data or credentials. DO NOT commit payments.';

  switch (assistanceType) {
    case 'find_page':
      return `Find the official appointment booking or OPD registration webpage for "${providerName}". Extract the direct URL. ${baseRules}`;
    case 'find_phone':
      return `Find the official appointment or hospital reception/OPD booking phone number for "${providerName}". ${baseRules}`;
    case 'booking_steps':
      return `Find and summarize the official step-by-step instructions for booking an appointment or OPD consultation at "${providerName}". ${baseRules}`;
    case 'all':
    default:
      return `Find the official appointment booking URL, official appointment phone number, and step-by-step booking instructions for "${providerName}". ${baseRules}`;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' });
  }

  // ── 1. Authentication & Role Enforcement ───────────────────────────────────
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      configured: true,
      error: 'UNAUTHORIZED',
      message: 'Authentication required. Missing Bearer token.',
    });
  }

  const token = authHeader.replace('Bearer ', '').trim();

  if (!supabase) {
    return res.status(503).json({
      success: false,
      configured: true,
      error: 'DB_UNAVAILABLE',
      message: 'Database authentication client is not configured.',
    });
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) {
    return res.status(401).json({
      success: false,
      configured: true,
      error: 'INVALID_TOKEN',
      message: 'Invalid or expired session token.',
    });
  }

  const callerUser = userData.user;

  // Verify that the caller is an authorized caregiver or admin
  const userClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
  });

  const { data: profile } = await userClient
    .from('profiles')
    .select('role')
    .eq('id', callerUser.id)
    .maybeSingle();

  const userRole = profile?.role || callerUser.user_metadata?.role;
  const isCaregiver = userRole === 'caregiver' || userRole === 'admin';

  if (!isCaregiver) {
    return res.status(403).json({
      success: false,
      configured: true,
      error: 'FORBIDDEN',
      message: 'Forbidden: Access to Booking Assistance is restricted to verified caregivers and administrators.',
    });
  }

  // ── 2. Rate Limiting Check ─────────────────────────────────────────────────
  if (!checkRateLimit(`user:${callerUser.id}`)) {
    return res.status(429).json({
      success: false,
      configured: true,
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many booking assistance requests. Please wait a minute before requesting another lookup.',
    });
  }

  // ── 3. Request Input Validation & Sanitization ──────────────────────────────
  const body = req.body || {};
  const rawProviderUrl = typeof body.providerUrl === 'string' ? body.providerUrl.trim() : '';
  const rawProviderName = typeof body.providerName === 'string' ? body.providerName.trim() : 'Hospital / Clinic';
  const rawAssistanceType = typeof body.assistanceType === 'string' ? body.assistanceType : 'all';

  const validTypes: BookingAssistanceType[] = ['find_page', 'find_phone', 'booking_steps', 'all'];
  const assistanceType: BookingAssistanceType = validTypes.includes(rawAssistanceType as BookingAssistanceType)
    ? (rawAssistanceType as BookingAssistanceType)
    : 'all';

  if (!rawProviderUrl || !isSafeHttpsUrl(rawProviderUrl)) {
    return res.status(400).json({
      success: false,
      configured: true,
      providerName: rawProviderName,
      sourceUrl: rawProviderUrl,
      assistanceType,
      error: 'INVALID_PROVIDER_URL',
      message: 'A valid public https:// provider URL is required to inspect booking options.',
      timestamp: new Date().toISOString(),
    });
  }

  const sanitizedProviderName = sanitizeText(rawProviderName, 120);

  // ── 4. TinyFish Configuration Verification ────────────────────────────────
  const tinyfishApiKey = (process.env.TINYFISH_API_KEY || '').trim();
  const isPlaceholderOrEmpty = !tinyfishApiKey || tinyfishApiKey === 'your_tinyfish_api_key_here';

  if (isPlaceholderOrEmpty) {
    return res.status(200).json({
      success: false,
      configured: false,
      providerName: sanitizedProviderName,
      sourceUrl: rawProviderUrl,
      assistanceType,
      error: 'CONFIG_REQUIRED',
      message: 'TinyFish API key is not configured. Please add TINYFISH_API_KEY to your environment variables to enable live agent booking assistance.',
      timestamp: new Date().toISOString(),
    });
  }

  // ── 5. Prepare Read-Only TinyFish Agent Execution ──────────────────────────
  const agentGoal = buildAgentGoal(assistanceType, sanitizedProviderName);
  const tinyfishEndpoint = 'https://agent.tinyfish.ai/v1/automation/run';

  const payload = {
    url: rawProviderUrl,
    goal: agentGoal,
    output_schema: {
      type: 'object',
      properties: {
        provider_name: { type: 'string' },
        booking_url: { type: 'string' },
        phone_number: { type: 'string' },
        booking_steps: {
          type: 'array',
          items: { type: 'string' },
        },
        source_urls: {
          type: 'array',
          items: { type: 'string' },
        },
        status_summary: { type: 'string' },
      },
      required: ['provider_name', 'status_summary'],
    },
    browser_profile: 'lite',
    agent_config: {
      max_steps: 20,
      max_duration_seconds: 25,
    },
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s safety ceiling

  try {
    const upstreamRes = await fetch(tinyfishEndpoint, {
      method: 'POST',
      headers: {
        'X-API-Key': tinyfishApiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!upstreamRes.ok) {
      const status = upstreamRes.status;
      if (status === 401) {
        return res.status(502).json({
          success: false,
          configured: false,
          providerName: sanitizedProviderName,
          sourceUrl: rawProviderUrl,
          assistanceType,
          error: 'UPSTREAM_AUTH_ERROR',
          message: 'TinyFish authentication failed. Please verify your TINYFISH_API_KEY.',
          timestamp: new Date().toISOString(),
        });
      }

      if (status === 429) {
        return res.status(429).json({
          success: false,
          configured: true,
          providerName: sanitizedProviderName,
          sourceUrl: rawProviderUrl,
          assistanceType,
          error: 'RATE_LIMIT_EXCEEDED',
          message: 'TinyFish Agent rate limit reached. Please retry in a few moments.',
          timestamp: new Date().toISOString(),
        });
      }

      const errText = await upstreamRes.text().catch(() => '');
      console.warn(`[BookingAssistant] TinyFish agent error (HTTP ${status}):`, errText.slice(0, 200));

      return res.status(502).json({
        success: false,
        configured: true,
        providerName: sanitizedProviderName,
        sourceUrl: rawProviderUrl,
        assistanceType,
        error: 'UPSTREAM_ERROR',
        message: 'TinyFish Agent service returned an error while inspecting the provider website.',
        timestamp: new Date().toISOString(),
      });
    }

    const runData = await upstreamRes.json();
    const rawResult = runData?.result || {};

    // ── 6. Untrusted Data Validation & Strict Sanitization ───────────────────
    const checkedAt = new Date().toISOString();

    // Validate booking URL (must be valid https)
    const rawBookingUrl = typeof rawResult.booking_url === 'string' ? rawResult.booking_url.trim() : '';
    const safeBookingUrl = isSafeHttpsUrl(rawBookingUrl) ? rawBookingUrl : null;

    // Validate phone number
    const safePhone = sanitizePhone(rawResult.phone_number);

    // Validate and sanitize booking steps
    const rawSteps = Array.isArray(rawResult.booking_steps) ? rawResult.booking_steps : [];
    const safeSteps: string[] = rawSteps
      .map((step: any) => sanitizeText(step, 200))
      .filter((step: string) => step.length > 0)
      .slice(0, 8);

    // Validate source URLs
    const rawSources = Array.isArray(rawResult.source_urls) ? rawResult.source_urls : [];
    const safeSources: string[] = rawSources
      .filter((s: any) => typeof s === 'string' && isSafeHttpsUrl(s))
      .slice(0, 5);

    if (safeSources.length === 0 && isSafeHttpsUrl(rawProviderUrl)) {
      safeSources.push(rawProviderUrl);
    }

    const statusSummary = sanitizeText(
      rawResult.status_summary || 'Information retrieved from official provider website.',
      250
    );

    const hasVerifiedBookingUrl = Boolean(safeBookingUrl);
    const hasVerifiedPhone = Boolean(safePhone);
    const hasBookingSteps = safeSteps.length > 0;
    const detailsFound = hasVerifiedBookingUrl || hasVerifiedPhone || hasBookingSteps;

    const result: BookingAssistantResult = {
      providerName: sanitizedProviderName,
      sourceUrl: rawProviderUrl,
      officialBookingUrl: safeBookingUrl,
      appointmentPhone: safePhone,
      bookingSteps: safeSteps,
      sourceUrls: safeSources,
      statusSummary,
      hasVerifiedBookingUrl,
      hasVerifiedPhone,
      hasBookingSteps,
      detailsFound,
      checkedAt,
    };

    return res.status(200).json({
      success: true,
      configured: true,
      providerName: sanitizedProviderName,
      sourceUrl: rawProviderUrl,
      assistanceType,
      result,
      timestamp: checkedAt,
    });
  } catch (err: any) {
    clearTimeout(timeoutId);

    if (err.name === 'AbortError') {
      return res.status(504).json({
        success: false,
        configured: true,
        providerName: sanitizedProviderName,
        sourceUrl: rawProviderUrl,
        assistanceType,
        error: 'TIMEOUT',
        message: 'The booking assistance lookup timed out after 25 seconds. Please try again or visit the provider directly.',
        timestamp: new Date().toISOString(),
      });
    }

    console.error('[BookingAssistant] Unexpected internal error:', err.message);
    return res.status(500).json({
      success: false,
      configured: true,
      providerName: sanitizedProviderName,
      sourceUrl: rawProviderUrl,
      assistanceType,
      error: 'INTERNAL_ERROR',
      message: 'Failed to inspect provider booking options.',
      timestamp: new Date().toISOString(),
    });
  }
}
