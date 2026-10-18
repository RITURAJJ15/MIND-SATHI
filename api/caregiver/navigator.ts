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

export type NavigatorSection = 'care_finder' | 'medicine' | 'schemes' | 'notices';

export interface NavigatorResultItem {
  id: string;
  title: string;
  snippet: string;
  url: string;
  siteName: string;
  date?: string;
  publisher?: string;
  address?: string;
  contactInfo?: string;
  eligibilityHint?: string;
  sourceDomain: string;
  lastChecked: string;
}

export interface NavigatorResponse {
  success: boolean;
  configured: boolean;
  section: NavigatorSection;
  query: string;
  results: NavigatorResultItem[];
  totalResults: number;
  error?: string;
  message?: string;
  timestamp: string;
}

/**
 * Sanitize query input string to prevent injection or parameter pollution.
 */
function sanitizeInput(input: any): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[<>'"`;(){}[\]\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
}

/**
 * Extract domain name from URL for clean badge display.
 */
function extractDomain(urlStr: string): string {
  try {
    const parsed = new URL(urlStr);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return 'official-source';
  }
}

/**
 * Build target query parameters for TinyFish Search API based on section.
 */
function buildTinyFishParams(section: NavigatorSection, sanitizedQuery: string) {
  const base = new URLSearchParams();
  base.set('location', 'IN');
  base.set('language', 'en');

  switch (section) {
    case 'care_finder': {
      const q = sanitizedQuery
        ? `${sanitizedQuery} hospitals geriatric clinic dementia elder care support India`
        : 'Guwahati Assam hospitals geriatric clinic dementia elder care support India';
      base.set('query', q);
      base.set('purpose', `Find hospitals, geriatric clinics, dementia support, and elder care resources in ${sanitizedQuery || 'Northeast India'}`);
      break;
    }

    case 'medicine': {
      const q = sanitizedQuery
        ? `Pradhan Mantri Bhartiya Janaushadhi Pariyojana Kendra generic medicine store ${sanitizedQuery}`
        : 'Pradhan Mantri Bhartiya Janaushadhi Pariyojana Kendra generic medicine store Assam';
      base.set('query', q);
      base.set('purpose', `Find official Jan Aushadhi Kendras and generic medicine stores in ${sanitizedQuery || 'Assam'}`);
      base.set('include_domains', 'janaushadhi.gov.in,pharmaceuticals.gov.in,mohfw.gov.in,nhp.gov.in');
      break;
    }

    case 'schemes': {
      const q = sanitizedQuery
        ? `senior citizen healthcare financial assistance scheme government India ${sanitizedQuery}`
        : 'senior citizen healthcare financial assistance scheme Ayushman PM-JAY Rashtriya Vayoshri Yojana India';
      base.set('query', q);
      base.set('purpose', 'Search official government websites for senior citizen healthcare and financial assistance schemes in India');
      base.set('include_domains', 'myscheme.gov.in,india.gov.in,socialjustice.gov.in,pmjay.gov.in,nha.gov.in,mohfw.gov.in');
      break;
    }

    case 'notices': {
      const q = sanitizedQuery
        ? `health advisory notice senior citizens elderly health India ${sanitizedQuery}`
        : 'health advisory notice senior citizens elderly healthcare Ministry of Health India';
      base.set('query', q);
      base.set('purpose', 'Official public health advisories and health notices for elderly and senior citizens in India');
      base.set('domain_type', 'news');
      break;
    }
  }

  return base;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  // ── Safe Diagnostics Probe (Exposes NO secret, only boolean configuration status) ──
  const action = req.query?.action as string | undefined;
  if (req.method === 'GET' && action === 'status') {
    const key = (process.env.TINYFISH_API_KEY || '').trim();
    const isConfigured = Boolean(key && key !== 'your_tinyfish_api_key_here');
    return res.status(200).json({
      success: true,
      service: 'TinyFish Care Navigator',
      configured: isConfigured,
      supabase: {
        urlPresent: Boolean(SUPABASE_URL),
        keyPresent: Boolean(SUPABASE_KEY),
        clientInitialized: Boolean(supabase),
      },
      envDiagnostics: {
        hasViteUrl: Boolean(process.env.VITE_SUPABASE_URL),
        hasSupabaseUrl: Boolean(process.env.SUPABASE_URL),
        hasVitePublishableKey: Boolean(process.env.VITE_SUPABASE_PUBLISHABLE_KEY),
        hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
        hasAnonKey: Boolean(process.env.SUPABASE_ANON_KEY),
        hasTinyFishKey: Boolean(process.env.TINYFISH_API_KEY),
      },
      timestamp: new Date().toISOString(),
    });
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
      message: 'Forbidden: Access to Care Navigator is restricted to verified caregivers and administrators.',
    });
  }

  // ── 2. Request Input Validation & Sanitization ──────────────────────────────
  const payload = req.method === 'POST' ? req.body : req.query;
  const rawSection = payload?.section as string;
  const validSections: NavigatorSection[] = ['care_finder', 'medicine', 'schemes', 'notices'];
  const section: NavigatorSection = validSections.includes(rawSection as NavigatorSection)
    ? (rawSection as NavigatorSection)
    : 'care_finder';

  const sanitizedQuery = sanitizeInput(payload?.query || '');

  // ── 3. TinyFish Configuration Verification ────────────────────────────────
  const tinyfishApiKey = (process.env.TINYFISH_API_KEY || '').trim();
  const isPlaceholderOrEmpty = !tinyfishApiKey || tinyfishApiKey === 'your_tinyfish_api_key_here';

  if (isPlaceholderOrEmpty) {
    return res.status(200).json({
      success: false,
      configured: false,
      section,
      query: sanitizedQuery,
      results: [],
      totalResults: 0,
      error: 'CONFIG_REQUIRED',
      message: 'TinyFish API key is not configured. Please add TINYFISH_API_KEY to your environment variables to enable live web retrieval.',
      timestamp: new Date().toISOString(),
    });
  }

  // ── 4. TinyFish Search API Execution ──────────────────────────────────────
  const params = buildTinyFishParams(section, sanitizedQuery);
  const tinyfishEndpoint = `https://api.search.tinyfish.ai?${params.toString()}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15-second safety ceiling

  try {
    const upstreamRes = await fetch(tinyfishEndpoint, {
      method: 'GET',
      headers: {
        'X-API-Key': tinyfishApiKey,
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!upstreamRes.ok) {
      const status = upstreamRes.status;
      if (status === 401) {
        return res.status(502).json({
          success: false,
          configured: false,
          section,
          query: sanitizedQuery,
          results: [],
          totalResults: 0,
          error: 'UPSTREAM_AUTH_ERROR',
          message: 'TinyFish authentication failed. Please verify your TINYFISH_API_KEY.',
          timestamp: new Date().toISOString(),
        });
      }

      if (status === 429) {
        return res.status(429).json({
          success: false,
          configured: true,
          section,
          query: sanitizedQuery,
          results: [],
          totalResults: 0,
          error: 'RATE_LIMIT_EXCEEDED',
          message: 'TinyFish search rate limit reached. Please retry in a few moments.',
          timestamp: new Date().toISOString(),
        });
      }

      const errText = await upstreamRes.text().catch(() => '');
      console.warn(`[CareNavigator] TinyFish search error (HTTP ${status}):`, errText.slice(0, 200));

      return res.status(502).json({
        success: false,
        configured: true,
        section,
        query: sanitizedQuery,
        results: [],
        totalResults: 0,
        error: 'UPSTREAM_ERROR',
        message: 'TinyFish search service returned an error. Please try again.',
        timestamp: new Date().toISOString(),
      });
    }

    const data = await upstreamRes.json();
    const rawResults = Array.isArray(data?.results) ? data.results : [];

    const nowIso = new Date().toISOString();
    const sanitizedResults: NavigatorResultItem[] = rawResults.map((item: any, idx: number) => {
      const url = typeof item.url === 'string' ? item.url : '';
      const domain = extractDomain(url);
      const title = typeof item.title === 'string' ? item.title.trim() : 'Resource Listing';
      const snippet = typeof item.snippet === 'string' ? item.snippet.trim() : '';
      const date = typeof item.date === 'string' ? item.date : undefined;
      const publisher = typeof item.publisher === 'string' ? item.publisher : item.site_name || domain;

      return {
        id: `tf-${section}-${idx}-${Math.abs(hashString(url))}`,
        title,
        snippet,
        url,
        siteName: item.site_name || domain,
        date,
        publisher,
        sourceDomain: domain,
        lastChecked: nowIso,
      };
    });

    return res.status(200).json({
      success: true,
      configured: true,
      section,
      query: sanitizedQuery,
      results: sanitizedResults,
      totalResults: sanitizedResults.length,
      timestamp: nowIso,
    });
  } catch (err: any) {
    clearTimeout(timeoutId);

    if (err.name === 'AbortError') {
      return res.status(504).json({
        success: false,
        configured: true,
        section,
        query: sanitizedQuery,
        results: [],
        totalResults: 0,
        error: 'TIMEOUT',
        message: 'TinyFish search request timed out after 15 seconds. Please try again.',
        timestamp: new Date().toISOString(),
      });
    }

    console.error('[CareNavigator] Unexpected internal error:', err.message);
    return res.status(500).json({
      success: false,
      configured: true,
      section,
      query: sanitizedQuery,
      results: [],
      totalResults: 0,
      error: 'INTERNAL_ERROR',
      message: 'Failed to complete search query.',
      timestamp: new Date().toISOString(),
    });
  }
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}
