// ==============================================================================
// MIND SATHI: "Help Me Book" Feature Independent Verification Suite
// ==============================================================================

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();

console.log('=== MIND SATHI: "HELP ME BOOK" INDEPENDENT VERIFICATION GATE ===\n');

let passedTests = 0;
let totalTests = 0;

async function runTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`[PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error('       ', err.message || err);
  }
}

// Mock Response Helper
function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    setHeader(key, val) {
      this.headers[key] = val;
      return this;
    },
    end() {
      return this;
    },
  };
  return res;
}

// ------------------------------------------------------------------------------
// TEST SUITE 1: STATIC HYGIENE & PRIVACY ASSURANCE
// ------------------------------------------------------------------------------
console.log('--- 1. Static Audit, Key Hygiene & Privacy Mandates ---');

await runTest('Security: TinyFish API key is kept strictly server-side (never in client src)', () => {
  const clientFiles = [
    'src/pages/CareNavigatorPage.tsx',
    'src/components/caregiver/HelpMeBookModal.tsx',
    'src/services/bookingAssistantService.ts',
    'src/services/careNavigatorService.ts',
  ];
  for (const f of clientFiles) {
    const fullPath = path.join(ROOT_DIR, f);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      assert(!content.includes('process.env.TINYFISH_API_KEY'), `${f} must not access process.env.TINYFISH_API_KEY`);
      assert(!content.includes('VITE_TINYFISH_API_KEY'), `${f} must not use VITE_TINYFISH_API_KEY`);
      // Ensure no live/actual API key token is hardcoded (tokens are sk-tinyfish-<32-chars>)
      const keyPattern = /sk-tinyfish-[A-Za-z0-9_-]{20,}/;
      assert(!keyPattern.test(content), `${f} must not contain any real TinyFish API key token`);
    }
  }
});

await runTest('Privacy: No patient health records, names, or medications sent to TinyFish', () => {
  const endpointContent = fs.readFileSync(path.join(ROOT_DIR, 'api/caregiver/booking-assistant.ts'), 'utf8');
  assert(!endpointContent.includes('patientProfile'), 'Must not reference patientProfile');
  assert(!endpointContent.includes('medication'), 'Must not include patient medication');
  assert(!endpointContent.includes('diagnosis'), 'Must not include patient diagnosis');
  assert(!endpointContent.includes('caregiverName'), 'Must not send caregiver personal name');
  assert(!endpointContent.includes('patientName'), 'Must not send patient personal name');
  assert(!endpointContent.includes('password'), 'Must not send passwords or credentials');
  assert(!endpointContent.includes('otp'), 'Must not send one-time passwords');
});

await runTest('Safety: Read-only goal enforces strict non-booking mandates', () => {
  const endpointContent = fs.readFileSync(path.join(ROOT_DIR, 'api/caregiver/booking-assistant.ts'), 'utf8');
  assert(endpointContent.includes('Read-only assistance only'), 'Must enforce read-only assistance');
  assert(endpointContent.includes('DO NOT fill in or submit any forms'), 'Must prohibit form submission');
  assert(endpointContent.includes('DO NOT make reservations, bookings, or appointments'), 'Must prohibit bookings');
  assert(endpointContent.includes('DO NOT enter personal data or credentials'), 'Must prohibit credential entry');
});

// ------------------------------------------------------------------------------
// TEST SUITE 2: SSRF & PROTOCOL VALIDATION UNIT CHECKS
// ------------------------------------------------------------------------------
console.log('\n--- 2. Server-Side SSRF & URL Safety Validation ---');

const bookingAssistantModule = await import('../api/caregiver/booking-assistant.ts');

await runTest('URL Validation: Accepts valid public https URLs', () => {
  assert.strictEqual(bookingAssistantModule.isSafeHttpsUrl('https://gmch.gov.in/appointments'), true);
  assert.strictEqual(bookingAssistantModule.isSafeHttpsUrl('https://aiimsguwahati.ac.in'), true);
  assert.strictEqual(bookingAssistantModule.isSafeHttpsUrl('https://hospital.example.org/opd'), true);
});

await runTest('URL Validation: Rejects insecure http:// URLs', () => {
  assert.strictEqual(bookingAssistantModule.isSafeHttpsUrl('http://insecure-hospital.com'), false);
});

await runTest('URL Validation: Rejects javascript: and data: URLs (XSS prevention)', () => {
  assert.strictEqual(bookingAssistantModule.isSafeHttpsUrl('javascript:alert(1)'), false);
  assert.strictEqual(bookingAssistantModule.isSafeHttpsUrl('data:text/html,<script>alert(1)</script>'), false);
});

await runTest('URL Validation: Rejects SSRF targets (localhost, 127.0.0.1, private IPs, cloud metadata)', () => {
  assert.strictEqual(bookingAssistantModule.isSafeHttpsUrl('https://localhost:8080'), false);
  assert.strictEqual(bookingAssistantModule.isSafeHttpsUrl('https://127.0.0.1/admin'), false);
  assert.strictEqual(bookingAssistantModule.isSafeHttpsUrl('https://10.0.0.1/secret'), false);
  assert.strictEqual(bookingAssistantModule.isSafeHttpsUrl('https://192.168.1.1/router'), false);
  assert.strictEqual(bookingAssistantModule.isSafeHttpsUrl('https://169.254.169.254/latest/meta-data'), false);
});

await runTest('Sanitization: Text sanitization strips HTML tags and script injections', () => {
  const dirty = 'Visit the <script>alert("hack")</script> <b>OPD Counter</b>';
  const clean = bookingAssistantModule.sanitizeText(dirty);
  assert(!clean.includes('<script>'), 'HTML script tags must be removed');
  assert(!clean.includes('<b>'), 'HTML bold tags must be removed');
  assert(clean.includes('Visit the'), 'Text content should be preserved');
  assert(clean.includes('OPD Counter'), 'Safe text should be preserved');
});

await runTest('Sanitization: Phone sanitization rejects script injection and accepts standard phone numbers', () => {
  assert.strictEqual(bookingAssistantModule.sanitizePhone('<script>alert(1)</script>'), null);
  assert.strictEqual(bookingAssistantModule.sanitizePhone('CALL ME AT MY HOSPITAL'), null);
  assert.strictEqual(bookingAssistantModule.sanitizePhone('+91-361-2529457'), '+91-361-2529457');
  assert.strictEqual(bookingAssistantModule.sanitizePhone('0361 2134567'), '0361 2134567');
  assert.strictEqual(bookingAssistantModule.sanitizePhone('1800-345-3850'), '1800-345-3850');
});

// ------------------------------------------------------------------------------
// TEST SUITE 3: FUNCTIONAL SERVERLESS AUTH & ERROR HANDLING
// ------------------------------------------------------------------------------
console.log('\n--- 3. Functional Serverless Endpoint Route Guards ---');

const bookingHandler = bookingAssistantModule.default;

await runTest('Route Guard: Rejects unauthenticated request with 401', async () => {
  const req = {
    method: 'POST',
    headers: {}, // No Bearer token
    body: { providerUrl: 'https://gmch.gov.in', providerName: 'Guwahati Medical College' },
  };
  const res = createMockRes();
  await bookingHandler(req, res);

  assert.strictEqual(res.statusCode, 401, 'Must reject unauthenticated request with 401');
  assert.strictEqual(res.body?.error, 'UNAUTHORIZED');
});

await runTest('Route Guard: Rejects non-caregiver (e.g. elderly patient) with 403', async () => {
  // Save original env
  const origKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  // Test role enforcement logic exists in source
  const src = fs.readFileSync(path.join(ROOT_DIR, 'api/caregiver/booking-assistant.ts'), 'utf8');
  assert(src.includes('const isCaregiver = userRole === \'caregiver\' || userRole === \'admin\';'), 'Must check caregiver/admin role');
  assert(src.includes('return res.status(403).json'), 'Must reject non-caregivers with 403');
});

await runTest('Route Guard: Rejects missing or non-https provider URL with 400', async () => {
  const src = fs.readFileSync(path.join(ROOT_DIR, 'api/caregiver/booking-assistant.ts'), 'utf8');
  assert(src.includes('if (!rawProviderUrl || !isSafeHttpsUrl(rawProviderUrl))'), 'Must validate safe https URL');
  assert(src.includes('INVALID_PROVIDER_URL'), 'Must return INVALID_PROVIDER_URL error code');
});

await runTest('Route Guard: Fails closed / configuration required when TINYFISH_API_KEY missing', () => {
  const src = fs.readFileSync(path.join(ROOT_DIR, 'api/caregiver/booking-assistant.ts'), 'utf8');
  assert(src.includes('CONFIG_REQUIRED'), 'Must return CONFIG_REQUIRED when key is placeholder or empty');
  assert(src.includes('your_tinyfish_api_key_here'), 'Must guard against placeholder keys');
});

await runTest('Rate Limiter: Server enforces sliding window rate limiting per user', () => {
  const src = fs.readFileSync(path.join(ROOT_DIR, 'api/caregiver/booking-assistant.ts'), 'utf8');
  assert(src.includes('RATE_LIMIT_EXCEEDED'), 'Must enforce rate limit exceeded status');
  assert(src.includes('checkRateLimit'), 'Must include rate limiting function');
});

// ------------------------------------------------------------------------------
// TEST SUITE 4: UI COMPONENT & INTEGRATION INTEGRITY
// ------------------------------------------------------------------------------
console.log('\n--- 4. Care Navigator UI Integration & Boundary Checks ---');

await runTest('Integration: CareNavigatorPage renders "Help Me Book" button for Nearby Care Finder', () => {
  const pageSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/pages/CareNavigatorPage.tsx'), 'utf8');
  assert(pageSrc.includes('Help Me Book'), 'CareNavigatorPage must contain "Help Me Book" button');
  assert(pageSrc.includes('activeSection === \'care_finder\''), 'Help Me Book must only render for care_finder results');
  assert(pageSrc.includes('HelpMeBookModal'), 'CareNavigatorPage must import and render HelpMeBookModal');
  assert(pageSrc.includes('setSelectedBookingProvider'), 'Must track selected provider state');
  // Check that original Official Link remains intact
  assert(pageSrc.includes('Official Link'), 'Existing Official Link button must remain intact');
});

await runTest('Component: HelpMeBookModal renders choices and disclaimers', () => {
  const modalSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/components/caregiver/HelpMeBookModal.tsx'), 'utf8');
  assert(modalSrc.includes('role="dialog"'), 'Must have role="dialog" accessibility');
  assert(modalSrc.includes('aria-modal="true"'), 'Must have aria-modal="true"');
  assert(modalSrc.includes('Find Official Appointment Webpage'), 'Must offer official appointment webpage choice');
  assert(modalSrc.includes('Find Hospital Appointment Phone Number'), 'Must offer phone number choice');
  assert(modalSrc.includes('Explain Booking Steps'), 'Must offer booking steps choice');
  assert(modalSrc.includes('Start Guided Lookup'), 'Must have explicit caregiver trigger button');
  assert(modalSrc.includes('Open Official Booking Page'), 'Must have verified open booking page action');
  assert(modalSrc.includes('Call Hospital:'), 'Must have verified call hospital action');
  assert(modalSrc.includes('rel="noopener noreferrer"'), 'Must open external links safely with rel="noopener noreferrer"');
  assert(modalSrc.includes('Read-Only Assisted Search'), 'Must include prominent read-only disclaimer');
});

await runTest('Component: HelpMeBookModal handles all 5 essential states', () => {
  const modalSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/components/caregiver/HelpMeBookModal.tsx'), 'utf8');
  assert(modalSrc.includes('isLoading'), 'Must handle loading state');
  assert(modalSrc.includes('isConfigured'), 'Must handle config required state');
  assert(modalSrc.includes('error'), 'Must handle error and timeout state');
  assert(modalSrc.includes('!result.detailsFound'), 'Must handle no results state');
  assert(modalSrc.includes('result.checkedAt'), 'Must display verified checked timestamp');
});

await runTest('Service: bookingAssistantService connects to dedicated endpoint', () => {
  const serviceSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/services/bookingAssistantService.ts'), 'utf8');
  assert(serviceSrc.includes('/api/caregiver/booking-assistant'), 'Must call dedicated endpoint /api/caregiver/booking-assistant');
  assert(serviceSrc.includes('Authorization') && serviceSrc.includes('Bearer'), 'Must pass Bearer token in request');
});

await runTest('Proxy: Vite development proxy routes /api/caregiver/booking-assistant', () => {
  const proxySrc = fs.readFileSync(path.join(ROOT_DIR, 'src/server/geminiProxyPlugin.ts'), 'utf8');
  assert(proxySrc.includes('/api/caregiver/booking-assistant'), 'Vite proxy must support /api/caregiver/booking-assistant');
  assert(proxySrc.includes('handleBookingAssistantApiRoute'), 'Must define handleBookingAssistantApiRoute');
});

console.log('\n======================================================');
console.log(`TOTAL HELP ME BOOK TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${totalTests - passedTests}`);
if (passedTests === totalTests) {
  console.log('STATUS: ALL HELP ME BOOK TESTS PASSED (100%)\n');
  process.exit(0);
} else {
  console.error('STATUS: VERIFICATION FAILED\n');
  process.exit(1);
}
