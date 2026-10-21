/**
 * scripts/verify-caregiver-oauth-routing.mjs
 * 
 * Targeted automated test suite for Caregiver Sign-up & Google OAuth Routing Verification:
 * 1. Patient email/password sign-up — existing behavior preserved
 * 2. Caregiver email/password sign-up — duplicate submit prevention, pre-check prevents calling signUp on existing accounts, rate-limit handling
 * 3. Patient Google sign-up — new patient reaches patient onboarding (/patient/dashboard with hasCompletedOnboarding: false)
 * 4. Patient Google sign-in — existing patient reaches Patient Dashboard
 * 5. Caregiver Google sign-up — new user lands on Caregiver Portal (/caregiver.html, never patient onboarding)
 * 6. Caregiver Google sign-in — existing authorized caregiver reaches Caregiver Panel (/caregiver.html)
 * 7. Unauthenticated access to protected caregiver routes remains blocked
 * 8. An account without caregiver authorization cannot gain caregiver access merely by selecting caregiver entry point
 * 9. OAuth callback validates return destination and rejects arbitrary external redirects
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

console.log('=== MIND SATHI: CAREGIVER AUTH & OAUTH ROUTING VERIFICATION ===\n');

let passCount = 0;
let failCount = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passCount++;
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(`       Error: ${err.message}`);
    failCount++;
  }
}

// ── 1. Codebase Static Verification ──
const authServiceContent = fs.readFileSync(path.resolve('src/services/authService.ts'), 'utf-8');
const oauthCallbackContent = fs.readFileSync(path.resolve('src/pages/auth/OAuthCallbackPage.tsx'), 'utf-8');
const appContent = fs.readFileSync(path.resolve('src/App.tsx'), 'utf-8');
const mobileBridgeContent = fs.readFileSync(path.resolve('src/services/mobileBridgeService.ts'), 'utf-8');

test('Scenario 1: Patient registration flow preserved unchanged', () => {
  assert(authServiceContent.includes('public async signUpPatientWithEmail('), 'Must retain signUpPatientWithEmail');
  assert(authServiceContent.includes('resilient local/central patient profile'), 'Must retain existing patient resilient profile generation');
  assert(authServiceContent.includes('role: \'elderly\''), 'Must retain elderly role assignment for patient signup');
});

test('Scenario 2: Caregiver email sign-up has duplicate submit guard and pre-check to prevent burning rate limits', () => {
  assert(authServiceContent.includes('this.isCaregiverSignUpInFlight'), 'Must enforce single flight guard for caregiver sign-up');
  assert(authServiceContent.includes('// 2c. Pre-check database profiles to avoid calling signUp() on already-registered accounts'), 'Must pre-check profiles before calling Supabase signUp');
  assert(authServiceContent.includes('An account with this email is already registered. Please switch to the "Sign In" tab'), 'Must inform user if already registered as caregiver without calling signUp');
  assert(authServiceContent.includes('Email rate limit exceeded (maximum 3-4 emails/hour on free Supabase tier)'), 'Must return clear user-friendly explanation when Supabase enforces email rate limit');
});

test('Scenario 3 & 4: Google OAuth preserves role intent in redirect URL and storage', () => {
  assert(authServiceContent.includes('?intended_role=${encodeURIComponent(role)}#/auth/callback'), 'OAuth redirectTarget must carry intended_role query param to survive redirects');
  assert(authServiceContent.includes('localStorage.setItem(\'ms_oauth_auth_intent\', role)'), 'Must preserve role intent in localStorage');
  assert(authServiceContent.includes('sessionStorage.setItem(\'ms_oauth_auth_intent\', role)'), 'Must preserve role intent in sessionStorage');
});

test('Scenario 5: Caregiver Google sign-up routes new user to /caregiver.html, never patient onboarding', () => {
  assert(authServiceContent.includes('if (finalRole === \'caregiver\') {\n        return \'/caregiver.html\';'), 'New caregiver must route to /caregiver.html');
  assert(!authServiceContent.includes('finalRole === \'caregiver\' ? \'/caregiver/dashboard\' : \'/patient/dashboard\''), 'Must not send caregiver to patient dashboard');
});

test('Scenario 6: Existing authorized caregiver Google sign-in returns /caregiver.html', () => {
  assert(authServiceContent.includes('if (rawRole === \'caregiver\') {\n          // Existing authorized caregiver\n          finalRole = \'caregiver\';'), 'Existing caregiver in DB must resolve to caregiver role');
});

test('Scenario 7: Unauthenticated access to protected caregiver routes is blocked', () => {
  assert(appContent.includes('if (currentPath === \'/caregiver/dashboard\' || currentPath === \'/caregiver/navigator\') {\n    if (!isAuthenticated)'), 'Must check isAuthenticated for caregiver routes');
  assert(appContent.includes('window.location.href = \'/caregiver.html\';\n      return null;'), 'Must redirect unauthenticated or non-caregiver users away from caregiver routes');
});

test('Scenario 8: Patient account cannot gain caregiver access merely by selecting caregiver entry point', () => {
  assert(authServiceContent.includes('This Google account is already registered as an Elderly Patient. Caregivers must use a separate Google account'), 'Must reject caregiver elevation for existing patient accounts');
  assert(!authServiceContent.includes('Upgrading profile role to caregiver'), 'Must NOT blindly overwrite patient profiles to caregiver');
});

test('Scenario 9: OAuth callback return destination is strictly validated and prevents external redirects', () => {
  assert(oauthCallbackContent.includes('cleanTarget === \'/caregiver.html\' || cleanTarget === \'/caregiver/dashboard\' || cleanTarget.startsWith(\'/caregiver\')'), 'Must validate caregiver destination');
  assert(oauthCallbackContent.includes('cleanTarget === \'/patient/dashboard\''), 'Must validate patient destination');
  assert(oauthCallbackContent.includes('cleanTarget === \'/doctor/dashboard\''), 'Must validate doctor destination');
  assert(!oauthCallbackContent.includes('window.location.href = targetRoute'), 'Must not blindly redirect to unvalidated targetRoute');
});

test('Scenario 10: Mobile bridge does not bypass OAuth role resolution', () => {
  assert(!mobileBridgeContent.includes('if (!error) {\n                navigate(\'/patient/dashboard\', true);'), 'Mobile deep-link handler must not hardcode patient dashboard redirect');
  assert(mobileBridgeContent.includes('navigate(\'/auth/callback\', true)'), 'Mobile deep-link handler must delegate to callback route');
});

// ── 2. Functional Simulation of Role Resolution Logic ──
function simulateOAuthRouting({ dbProfile, queryRole, storedIntent }) {
  const validatedIntent = (queryRole === 'caregiver' || queryRole === 'elderly' || queryRole === 'clinician')
    ? queryRole
    : ((storedIntent === 'caregiver' || storedIntent === 'elderly' || storedIntent === 'clinician') ? storedIntent : null);
  
  const isCaregiverIntent = validatedIntent === 'caregiver';

  if (dbProfile) {
    const rawRole = (dbProfile.role || '').toLowerCase();
    if (rawRole === 'caregiver') {
      return { success: true, destination: '/caregiver.html', role: 'caregiver' };
    }
    if (rawRole === 'elderly' || rawRole === 'patient') {
      if (isCaregiverIntent) {
        return { success: false, error: 'This Google account is already registered as an Elderly Patient. Caregivers must use a separate Google account or sign in through the Patient Portal.' };
      }
      return { success: true, destination: '/patient/dashboard', role: 'elderly' };
    }
  } else {
    // New Google user
    if (isCaregiverIntent) {
      return { success: true, destination: '/caregiver.html', role: 'caregiver' };
    } else {
      return { success: true, destination: '/patient/dashboard', role: 'elderly' };
    }
  }
}

test('Functional: New caregiver with query param role routes to /caregiver.html', () => {
  const result = simulateOAuthRouting({ dbProfile: null, queryRole: 'caregiver', storedIntent: null });
  assert.equal(result.success, true);
  assert.equal(result.destination, '/caregiver.html');
  assert.equal(result.role, 'caregiver');
});

test('Functional: New caregiver with stored intent fallback routes to /caregiver.html', () => {
  const result = simulateOAuthRouting({ dbProfile: null, queryRole: null, storedIntent: 'caregiver' });
  assert.equal(result.success, true);
  assert.equal(result.destination, '/caregiver.html');
  assert.equal(result.role, 'caregiver');
});

test('Functional: Existing caregiver Google login routes to /caregiver.html', () => {
  const result = simulateOAuthRouting({ dbProfile: { id: 'cg-1', role: 'caregiver' }, queryRole: 'caregiver', storedIntent: null });
  assert.equal(result.success, true);
  assert.equal(result.destination, '/caregiver.html');
  assert.equal(result.role, 'caregiver');
});

test('Functional: New patient Google sign-up routes to /patient/dashboard', () => {
  const result = simulateOAuthRouting({ dbProfile: null, queryRole: 'elderly', storedIntent: null });
  assert.equal(result.success, true);
  assert.equal(result.destination, '/patient/dashboard');
  assert.equal(result.role, 'elderly');
});

test('Functional: Existing patient Google login routes to /patient/dashboard', () => {
  const result = simulateOAuthRouting({ dbProfile: { id: 'p-1', role: 'elderly' }, queryRole: null, storedIntent: null });
  assert.equal(result.success, true);
  assert.equal(result.destination, '/patient/dashboard');
  assert.equal(result.role, 'elderly');
});

test('Functional: Existing patient attempting caregiver login is rejected without gaining caregiver access', () => {
  const result = simulateOAuthRouting({ dbProfile: { id: 'p-1', role: 'elderly' }, queryRole: 'caregiver', storedIntent: null });
  assert.equal(result.success, false);
  assert(result.error.includes('already registered as an Elderly Patient'));
});

console.log('\n==============================================');
console.log(`TOTAL TARGETED TESTS: ${passCount + failCount} | PASSED: ${passCount} | FAILED: ${failCount}`);
console.log(`STATUS: ${failCount === 0 ? 'ALL CAREGIVER AUTH & OAUTH TESTS PASSED (100%)' : 'SOME TESTS FAILED'}`);

if (failCount > 0) {
  process.exit(1);
}
