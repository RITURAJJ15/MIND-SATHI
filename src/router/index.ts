/**
 * router/index.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Lightweight, robust client-side Hash Router for MIND SATHI.
 * 
 * Guarantees distinct URLs:
 * - Landing:              #/
 * - Patient Auth:         #/patient/auth
 * - Caregiver Auth:       #/caregiver/auth
 * - Doctor Auth:          #/doctor/auth
 * - OAuth Callback:       #/auth/callback
 * - Patient Dashboard:    #/patient/dashboard
 * - Caregiver Dashboard:  #/caregiver/dashboard
 * - Doctor Dashboard:     #/doctor/dashboard
 */

import { useState, useEffect } from 'react';

export type AppRoute =
  | '/'
  | '/patient/auth'
  | '/caregiver/auth'
  | '/doctor/auth'
  | '/auth/callback'
  | '/patient/dashboard'
  | '/caregiver/dashboard'
  | '/doctor/dashboard';

export function getCleanHashPath(): string {
  const hash = window.location.hash || '';
  if (!hash || hash === '#' || hash === '#/') {
    return '/';
  }

  // Handle Supabase auth tokens in hash (e.g. #access_token=... or #/auth/callback#access_token=...)
  if (hash.includes('access_token=') || hash.includes('error=')) {
    return '/auth/callback';
  }

  // Remove leading '#'
  let path = hash.startsWith('#') ? hash.slice(1) : hash;

  // Extract path before any query/hash parameters
  const qIdx = path.indexOf('?');
  if (qIdx !== -1) {
    path = path.slice(0, qIdx);
  }

  if (!path.startsWith('/')) {
    path = '/' + path;
  }

  return path;
}

export function navigate(to: string, replace = false): void {
  const targetHash = to.startsWith('/') ? `#${to}` : `#/${to}`;
  if (replace) {
    window.location.replace(targetHash);
  } else {
    window.location.hash = targetHash;
  }
  window.scrollTo({ top: 0, behavior: 'instant' });
}

export function useRouter() {
  const [currentPath, setCurrentPath] = useState<string>(() => getCleanHashPath());

  useEffect(() => {
    const handleHashChange = () => {
      const nextPath = getCleanHashPath();
      setCurrentPath(nextPath);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  return {
    currentPath,
    navigate,
  };
}
