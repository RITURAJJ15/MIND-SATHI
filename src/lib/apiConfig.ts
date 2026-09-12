import { Capacitor } from '@capacitor/core';

export const PRODUCTION_WEB_URL = 'https://www.riturajfx.site';

/**
 * Returns the base URL for backend API requests.
 * - On Web (Production): returns window.location.origin (e.g. https://www.riturajfx.site)
 * - On Web (Local Dev): returns window.location.origin (e.g. http://localhost:3000)
 * - On Native Mobile (Capacitor Android/iOS): returns https://www.riturajfx.site
 *   so native requests hit the deployed Vercel serverless API routes.
 */
export function getApiBaseUrl(): string {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL.replace(/\/+$/, '');
  }

  if (Capacitor.isNativePlatform()) {
    return PRODUCTION_WEB_URL;
  }

  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    // Keep relative requests on web or use origin
    return '';
  }

  return PRODUCTION_WEB_URL;
}

/**
 * Transforms any `/api/...` path to an absolute production endpoint on mobile native,
 * while leaving it relative or origin-based on web.
 *
 * Example:
 * - Web: resolveApiUrl('/api/gemini/assistant') -> '/api/gemini/assistant'
 * - Native: resolveApiUrl('/api/gemini/assistant') -> 'https://www.riturajfx.site/api/gemini/assistant'
 */
export function resolveApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const base = getApiBaseUrl();
  return base ? `${base}${cleanPath}` : cleanPath;
}
