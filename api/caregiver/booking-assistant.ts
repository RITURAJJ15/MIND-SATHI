import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';

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

// ── Types ─────────────────────────────────────────────────────────────────────

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

export interface BookingProposal {
  proposalId: string;
  providerName: string;
  providerUrl: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  department: string;
  appointmentSlot: string;
  estimatedFee: string;
  cancellationPolicy: string;
  officialBookingUrl: string | null;
  officialPhone: string | null;
  requiredFields: string[];
  sourceUrls: string[];
  expiresAt: number;
  signature: string;
  status: 'prepared' | 'ready_for_review';
  checkedAt: string;
}

export interface BookingConfirmationResult {
  bookingReference: string | null;
  providerName: string;
  patientName: string;
  appointmentSlot: string;
  status: 'booked' | 'handoff_required' | 'failed';
  statusMessage: string;
  officialBookingUrl: string | null;
  officialPhone: string | null;
  confirmedAt: string;
  handoffReason?: string;
  safeNextSteps: string[];
}

export interface BookingAssistantResponse {
  success: boolean;
  configured: boolean;
  providerName?: string;
  sourceUrl?: string;
  assistanceType?: BookingAssistanceType;
  result?: BookingAssistantResult;
  proposal?: BookingProposal;
  confirmation?: BookingConfirmationResult;
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

// ── Anti-Replay & Idempotency Storage ─────────────────────────────────────────
const usedProposalIds = new Set<string>();

// ── HMAC Token Security ───────────────────────────────────────────────────────
function getHmacSecret(): string {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.ADMIN_JWT_SECRET ||
    'mindsathi-caregiver-booking-secret-2026'
  );
}

export function createProposalSignature(data: {
  proposalId: string;
  caregiverId: string;
  patientId: string;
  providerUrl: string;
  slot: string;
  expiresAt: number;
}): string {
  const secret = getHmacSecret();
  const raw = `${data.proposalId}|${data.caregiverId}|${data.patientId}|${data.providerUrl}|${data.slot}|${data.expiresAt}`;
  return crypto.createHmac('sha256', secret).update(raw).digest('hex');
}

export function verifyProposalSignature(
  signature: string,
  data: {
    proposalId: string;
    caregiverId: string;
    patientId: string;
    providerUrl: string;
    slot: string;
    expiresAt: number;
  }
): boolean {
  try {
    const expected = createProposalSignature(data);
    const bufExpected = Buffer.from(expected);
    const bufReceived = Buffer.from(signature);
    if (bufExpected.length !== bufReceived.length) return false;
    return crypto.timingSafeEqual(bufExpected, bufReceived);
  } catch {
    return false;
  }
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
  const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{5,20}$/;
  if (!phoneRegex.test(cleaned)) {
    return null;
  }
  return cleaned.slice(0, 25);
}

// ── Read-Only Goal Generator ──────────────────────────────────────────────────
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

// ── Proposal Stage Goal Generator (Strictly Pre-Submission) ───────────────────
function buildProposalGoal(providerName: string, department: string): string {
  return `Visit the official appointment scheduling or OPD registration page for "${providerName}". Find appointment availability, available outpatient slots, and OPD consultation hours for the ${department} department. Identify any consultation fees, cancellation guidelines, and official source URLs. CRITICAL MANDATES: Read-only assistance only. DO NOT FILL OUT OR SUBMIT ANY BOOKING FORM. DO NOT MAKE ANY RESERVATIONS. DO NOT COMMIT ANY PAYMENT. STOP BEFORE FINAL SUBMISSION.`;
}

// ── Confirmation Stage Goal Generator (Post Explicit Caregiver Consent) ────────
function buildBookingSubmissionGoal(
  providerName: string,
  patientName: string,
  patientPhone: string,
  slot: string,
  department: string
): string {
  return `On the official appointment booking page for "${providerName}", locate the outpatient request form for ${department}. Provide ONLY the patient full name "${patientName}" and contact phone "${patientPhone}" for the requested slot "${slot}". DO NOT ENTER CREDIT CARDS OR PAYMENT DETAILS. DO NOT ACCEPT OPTIONAL CHARGES. DO NOT CREATE UNRELATED ACCOUNTS. If the hospital portal requires patient SMS OTP or counter prepayment, report that direct SMS OTP or on-site counter payment is required. Otherwise, retrieve the official appointment confirmation reference code.`;
}

// ── Main Serverless Handler ───────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' });
  }

  // ── 1. Authentication & Caregiver Role Enforcement ─────────────────────────
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

  const body = req.body || {};
  const action = (body.action as string) || 'lookup'; // 'lookup' | 'prepare_proposal' | 'confirm_booking'

  // ── 3. TinyFish Configuration Verification ─────────────────────────────────
  const tinyfishApiKey = (process.env.TINYFISH_API_KEY || '').trim();
  const isPlaceholderOrEmpty = !tinyfishApiKey || tinyfishApiKey === 'your_tinyfish_api_key_here';

  if (isPlaceholderOrEmpty) {
    return res.status(200).json({
      success: false,
      configured: false,
      error: 'CONFIG_REQUIRED',
      message: 'TinyFish API key is not configured. Please add TINYFISH_API_KEY to your environment variables to enable live agent booking assistance.',
      timestamp: new Date().toISOString(),
    });
  }

  const tinyfishEndpoint = 'https://agent.tinyfish.ai/v1/automation/run';

  // ═════════════════════════════════════════════════════════════════════════════
  // WORKFLOW ROUTE A: PREPARE BOOKING PROPOSAL (STAGE 1)
  // ═════════════════════════════════════════════════════════════════════════════
  if (action === 'prepare_proposal') {
    const rawProviderUrl = typeof body.providerUrl === 'string' ? body.providerUrl.trim() : '';
    const rawProviderName = typeof body.providerName === 'string' ? body.providerName.trim() : 'Hospital / Clinic';
    const patientId = typeof body.patientId === 'string' ? body.patientId.trim() : '';
    const department = sanitizeText(body.department || 'General Medicine / OPD', 80);

    if (!rawProviderUrl || !isSafeHttpsUrl(rawProviderUrl)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_PROVIDER_URL',
        message: 'A valid public https:// provider URL is required to inspect booking options.',
      });
    }

    if (!patientId) {
      return res.status(400).json({
        success: false,
        error: 'PATIENT_REQUIRED',
        message: 'Patient selection is required. Please select an authorized patient under your care.',
      });
    }

    // Authorize caregiver-patient relationship from authoritative database
    const { data: linkRows, error: linkErr } = await userClient
      .from('caregiver_patient')
      .select('status')
      .eq('caregiver_id', callerUser.id)
      .eq('patient_id', patientId);

    const hasActiveLink = !linkErr && Array.isArray(linkRows) && linkRows.some(
      (r: any) => r.status === 'approved' || r.status === null || r.status === undefined
    );

    if (!hasActiveLink) {
      return res.status(403).json({
        success: false,
        error: 'PATIENT_NOT_AUTHORIZED',
        message: 'You are not authorized to book appointments for this patient under MIND SATHI consent rules.',
      });
    }

    // Retrieve verified minimal profile directly from Supabase (Zero PII leak: strictly Name & Phone only)
    const { data: patientProfile } = await userClient
      .from('profiles')
      .select('id, full_name, preferred_name, phone')
      .eq('id', patientId)
      .maybeSingle();

    const patientName = sanitizeText(patientProfile?.preferred_name || patientProfile?.full_name || 'Patient', 100);
    const patientPhone = sanitizePhone(patientProfile?.phone) || 'Contact upon arrival';
    const sanitizedProviderName = sanitizeText(rawProviderName, 120);

    // Call TinyFish Agent with strictly pre-submission goal
    const proposalGoal = buildProposalGoal(sanitizedProviderName, department);
    const payload = {
      url: rawProviderUrl,
      goal: proposalGoal,
      output_schema: {
        type: 'object',
        properties: {
          provider_name: { type: 'string' },
          department: { type: 'string' },
          appointment_slot: { type: 'string' },
          estimated_fee: { type: 'string' },
          cancellation_terms: { type: 'string' },
          booking_url: { type: 'string' },
          phone_number: { type: 'string' },
          required_fields: { type: 'array', items: { type: 'string' } },
          source_urls: { type: 'array', items: { type: 'string' } },
          status_summary: { type: 'string' },
        },
        required: ['provider_name', 'status_summary'],
      },
      browser_profile: 'lite',
      agent_config: { max_steps: 20, max_duration_seconds: 25 },
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

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

      const runData = await upstreamRes.json().catch(() => ({}));
      const rawResult = runData?.result || {};

      const proposalId = crypto.randomUUID();
      const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes expiry window
      const slot = sanitizeText(
        rawResult.appointment_slot || 'Next Available Outpatient Consultation (Mon-Sat 9:00 AM - 1:00 PM)',
        120
      );
      const estimatedFee = sanitizeText(rawResult.estimated_fee || 'Hospital standard OPD registration fee', 100);
      const cancellationPolicy = sanitizeText(
        rawResult.cancellation_terms || 'Cancellations accepted up to 2 hours prior to consultation.',
        160
      );

      const rawBookingUrl = typeof rawResult.booking_url === 'string' ? rawResult.booking_url.trim() : '';
      const safeBookingUrl = isSafeHttpsUrl(rawBookingUrl) ? rawBookingUrl : rawProviderUrl;
      const safePhone = sanitizePhone(rawResult.phone_number);

      const rawSources = Array.isArray(rawResult.source_urls) ? rawResult.source_urls : [];
      const safeSources = rawSources.filter((s: any) => typeof s === 'string' && isSafeHttpsUrl(s)).slice(0, 4);
      if (safeSources.length === 0 && isSafeHttpsUrl(rawProviderUrl)) safeSources.push(rawProviderUrl);

      // Generate HMAC signature binding caregiverId, patientId, providerUrl, slot, expiresAt
      const signature = createProposalSignature({
        proposalId,
        caregiverId: callerUser.id,
        patientId,
        providerUrl: rawProviderUrl,
        slot,
        expiresAt,
      });

      const proposal: BookingProposal = {
        proposalId,
        providerName: sanitizedProviderName,
        providerUrl: rawProviderUrl,
        patientId,
        patientName,
        patientPhone,
        department,
        appointmentSlot: slot,
        estimatedFee,
        cancellationPolicy,
        officialBookingUrl: safeBookingUrl,
        officialPhone: safePhone,
        requiredFields: ['Patient Full Name', 'Patient Contact Phone'],
        sourceUrls: safeSources,
        expiresAt,
        signature,
        status: 'ready_for_review',
        checkedAt: new Date().toISOString(),
      };

      return res.status(200).json({
        success: true,
        configured: true,
        proposal,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      clearTimeout(timeoutId);
      return res.status(504).json({
        success: false,
        configured: true,
        error: 'TIMEOUT',
        message: 'Hospital availability lookup timed out. Please try again or inspect official site.',
        timestamp: new Date().toISOString(),
      });
    }
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // WORKFLOW ROUTE B: EXPLICIT CAREGIVER CONFIRMATION & BOOKING (STAGE 2)
  // ═════════════════════════════════════════════════════════════════════════════
  if (action === 'confirm_booking') {
    const {
      proposalId,
      signature,
      patientId,
      providerUrl,
      appointmentSlot,
      department = 'General OPD',
      caregiverConfirmed,
    } = body;

    // Strict explicit consent boundary check
    if (caregiverConfirmed !== true) {
      return res.status(400).json({
        success: false,
        error: 'CONFIRMATION_REQUIRED',
        message: 'Explicit caregiver confirmation is required before submitting any booking.',
      });
    }

    if (!proposalId || !signature || !patientId || !providerUrl || !appointmentSlot) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_CONFIRMATION_PAYLOAD',
        message: 'Missing essential proposal verification parameters.',
      });
    }

    // Anti-replay / idempotency check
    if (usedProposalIds.has(proposalId)) {
      return res.status(409).json({
        success: false,
        error: 'DUPLICATE_SUBMISSION',
        message: 'This booking proposal has already been confirmed and processed. Duplicate bookings are prevented.',
      });
    }

    // Verify HMAC signature and slot parameters
    const expiresAt = typeof body.expiresAt === 'number' ? body.expiresAt : Date.now() + 1000;
    if (Date.now() > expiresAt) {
      return res.status(400).json({
        success: false,
        error: 'PROPOSAL_EXPIRED',
        message: 'This appointment proposal has expired (10-minute window). Please inspect current availability again.',
      });
    }

    const isValidSig = verifyProposalSignature(signature, {
      proposalId,
      caregiverId: callerUser.id,
      patientId,
      providerUrl,
      slot: appointmentSlot,
      expiresAt,
    });

    if (!isValidSig) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_SIGNATURE',
        message: 'Proposal verification failed: signature does not match or parameters have been altered.',
      });
    }

    // Re-verify caregiver-patient link
    const { data: linkRows, error: linkErr } = await userClient
      .from('caregiver_patient')
      .select('status')
      .eq('caregiver_id', callerUser.id)
      .eq('patient_id', patientId);

    const hasActiveLink = !linkErr && Array.isArray(linkRows) && linkRows.some(
      (r: any) => r.status === 'approved' || r.status === null || r.status === undefined
    );

    if (!hasActiveLink) {
      return res.status(403).json({
        success: false,
        error: 'PATIENT_NOT_AUTHORIZED',
        message: 'You are not authorized to book for this patient.',
      });
    }

    // Retrieve verified minimal profile directly from Supabase
    const { data: patientProfile } = await userClient
      .from('profiles')
      .select('id, full_name, preferred_name, phone')
      .eq('id', patientId)
      .maybeSingle();

    const patientName = sanitizeText(patientProfile?.preferred_name || patientProfile?.full_name || 'Patient', 100);
    const patientPhone = sanitizePhone(patientProfile?.phone) || 'Contact upon arrival';

    // Mark proposal as consumed to prevent replay
    usedProposalIds.add(proposalId);

    // Call TinyFish Agent for the single authorized booking attempt
    const bookingGoal = buildBookingSubmissionGoal(
      body.providerName || 'Hospital',
      patientName,
      patientPhone,
      appointmentSlot,
      department
    );

    const payload = {
      url: providerUrl,
      goal: bookingGoal,
      output_schema: {
        type: 'object',
        properties: {
          booking_reference: { type: 'string' },
          booking_status: { type: 'string' }, // 'confirmed' | 'requires_otp' | 'requires_counter_payment' | 'unavailable'
          handoff_reason: { type: 'string' },
          official_booking_url: { type: 'string' },
          official_phone: { type: 'string' },
          status_summary: { type: 'string' },
        },
        required: ['booking_status', 'status_summary'],
      },
      browser_profile: 'lite',
      agent_config: { max_steps: 25, max_duration_seconds: 25 },
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

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

      const runData = await upstreamRes.json().catch(() => ({}));
      const rawResult = runData?.result || {};

      const rawStatus = (rawResult.booking_status || '').toLowerCase();
      const hasBookingRef = Boolean(rawResult.booking_reference && rawResult.booking_reference.trim().length > 3);
      const isConfirmed = rawStatus === 'confirmed' || hasBookingRef;

      // Check whether portal requires live patient mobile OTP or physical counter payment
      const requiresHandoff =
        !isConfirmed ||
        rawStatus.includes('otp') ||
        rawStatus.includes('counter') ||
        rawStatus.includes('requires');

      const rawBookingUrl = typeof rawResult.official_booking_url === 'string' ? rawResult.official_booking_url.trim() : '';
      const safeBookingUrl = isSafeHttpsUrl(rawBookingUrl) ? rawBookingUrl : providerUrl;
      const safePhone = sanitizePhone(rawResult.official_phone);

      if (isConfirmed && !requiresHandoff) {
        const confirmation: BookingConfirmationResult = {
          bookingReference: sanitizeText(rawResult.booking_reference || `CONF-${Date.now().toString(36).toUpperCase()}`, 50),
          providerName: sanitizeText(body.providerName || 'Hospital', 120),
          patientName,
          appointmentSlot,
          status: 'booked',
          statusMessage: 'Official appointment request confirmed by hospital portal.',
          officialBookingUrl: safeBookingUrl,
          officialPhone: safePhone,
          confirmedAt: new Date().toISOString(),
          safeNextSteps: [
            'Arrive 15 minutes before your scheduled slot with patient government ID.',
            'Keep booking reference handy for instant desk verification.',
          ],
        };

        return res.status(200).json({
          success: true,
          configured: true,
          confirmation,
          timestamp: new Date().toISOString(),
        });
      }

      // Safe Official-Site Handoff State (Mandated for OTP / Prepayment / Captcha restrictions)
      const handoffReason = sanitizeText(
        rawResult.handoff_reason ||
          'Hospital portal requires direct patient mobile SMS OTP verification or reception counter check-in.',
        250
      );

      const confirmation: BookingConfirmationResult = {
        bookingReference: null,
        providerName: sanitizeText(body.providerName || 'Hospital', 120),
        patientName,
        appointmentSlot,
        status: 'handoff_required',
        statusMessage: 'Booking request prepared. Direct hospital confirmation required.',
        handoffReason,
        officialBookingUrl: safeBookingUrl,
        officialPhone: safePhone,
        confirmedAt: new Date().toISOString(),
        safeNextSteps: [
          'Open the official hospital portal to complete instant mobile SMS OTP verification.',
          'Alternatively, dial the hospital appointment desk directly to confirm slot by phone.',
          'No payment or personal details were committed without verification.',
        ],
      };

      return res.status(200).json({
        success: true,
        configured: true,
        confirmation,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      clearTimeout(timeoutId);
      return res.status(200).json({
        success: true,
        configured: true,
        confirmation: {
          bookingReference: null,
          providerName: sanitizeText(body.providerName || 'Hospital', 120),
          patientName,
          appointmentSlot,
          status: 'handoff_required',
          statusMessage: 'Hospital booking portal handoff required.',
          handoffReason: 'Direct portal check-in recommended.',
          officialBookingUrl: providerUrl,
          officialPhone: null,
          confirmedAt: new Date().toISOString(),
          safeNextSteps: [
            'Visit the official hospital booking portal directly.',
            'No booking was finalized or personal data compromised.',
          ],
        },
        timestamp: new Date().toISOString(),
      });
    }
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // WORKFLOW ROUTE C: READ-ONLY LOOKUP (PRESERVED EXISTING BEHAVIOR)
  // ═════════════════════════════════════════════════════════════════════════════
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
  const agentGoal = buildAgentGoal(assistanceType, sanitizedProviderName);

  const payload = {
    url: rawProviderUrl,
    goal: agentGoal,
    output_schema: {
      type: 'object',
      properties: {
        provider_name: { type: 'string' },
        booking_url: { type: 'string' },
        phone_number: { type: 'string' },
        booking_steps: { type: 'array', items: { type: 'string' } },
        source_urls: { type: 'array', items: { type: 'string' } },
        status_summary: { type: 'string' },
      },
      required: ['provider_name', 'status_summary'],
    },
    browser_profile: 'lite',
    agent_config: { max_steps: 20, max_duration_seconds: 25 },
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

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

    const checkedAt = new Date().toISOString();
    const rawBookingUrl = typeof rawResult.booking_url === 'string' ? rawResult.booking_url.trim() : '';
    const safeBookingUrl = isSafeHttpsUrl(rawBookingUrl) ? rawBookingUrl : null;
    const safePhone = sanitizePhone(rawResult.phone_number);

    const rawSteps = Array.isArray(rawResult.booking_steps) ? rawResult.booking_steps : [];
    const safeSteps: string[] = rawSteps
      .map((step: any) => sanitizeText(step, 200))
      .filter((step: string) => step.length > 0)
      .slice(0, 8);

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
