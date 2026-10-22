// ==============================================================================
// MIND SATHI: "Help Me Book" & Caregiver-Confirmed Booking Verification Suite
// ==============================================================================

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();

console.log('=== MIND SATHI: CAREGIVER-CONFIRMED APPOINTMENT BOOKING VERIFICATION GATE ===\n');

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
      // Ensure no live/actual API key token is hardcoded
      const keyPattern = /sk-tinyfish-[A-Za-z0-9_-]{20,}/;
      assert(!keyPattern.test(content), `${f} must not contain any real TinyFish API key token`);
    }
  }
});

await runTest('Privacy: No patient medical records, diagnoses, or medications sent to TinyFish', () => {
  const endpointContent = fs.readFileSync(path.join(ROOT_DIR, 'api/caregiver/booking-assistant.ts'), 'utf8');
  assert(!endpointContent.includes('diagnosis'), 'Must not include patient diagnosis');
  assert(!endpointContent.includes('medication'), 'Must not include patient medication');
  assert(!endpointContent.includes('medical_records'), 'Must not include medical records');
  assert(!endpointContent.includes('health_records'), 'Must not include health records');
  assert(!endpointContent.includes('password'), 'Must not send passwords or credentials');
  assert(!endpointContent.includes('session_token'), 'Must not send session tokens');
});

await runTest('Safety: Read-only goal enforces strict non-booking mandates', () => {
  const endpointContent = fs.readFileSync(path.join(ROOT_DIR, 'api/caregiver/booking-assistant.ts'), 'utf8');
  assert(endpointContent.includes('Read-only assistance only'), 'Must enforce read-only assistance');
  assert(endpointContent.includes('DO NOT fill in or submit any forms'), 'Must prohibit form submission');
  assert(endpointContent.includes('DO NOT make reservations, bookings, or appointments'), 'Must prohibit bookings');
  assert(endpointContent.includes('DO NOT enter personal data or credentials'), 'Must prohibit credential entry');
});

await runTest('Safety: Stage 1 proposal goal stops strictly before final submission', () => {
  const endpointContent = fs.readFileSync(path.join(ROOT_DIR, 'api/caregiver/booking-assistant.ts'), 'utf8');
  assert(endpointContent.includes('STOP BEFORE FINAL SUBMISSION'), 'Must include STOP BEFORE FINAL SUBMISSION mandate');
  assert(endpointContent.includes('DO NOT COMMIT ANY PAYMENT'), 'Must prohibit payment commitment');
});

// ------------------------------------------------------------------------------
// TEST SUITE 2: SSRF, HMAC SIGNATURE & PROTOCOL VALIDATION
// ------------------------------------------------------------------------------
console.log('\n--- 2. Server-Side SSRF, HMAC Signatures & Security Verification ---');

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

await runTest('HMAC Security: createProposalSignature generates deterministic SHA-256 signatures', () => {
  const proposalData = {
    proposalId: 'prop-12345',
    caregiverId: 'caregiver-abc',
    patientId: 'patient-xyz',
    providerUrl: 'https://gmch.gov.in',
    slot: 'Tomorrow 10:00 AM',
    expiresAt: Date.now() + 600000,
  };
  const sig1 = bookingAssistantModule.createProposalSignature(proposalData);
  const sig2 = bookingAssistantModule.createProposalSignature(proposalData);
  assert.strictEqual(sig1, sig2, 'Signatures for identical data must match');
  assert.strictEqual(typeof sig1, 'string');
  assert.strictEqual(sig1.length, 64, 'SHA-256 hex string must be 64 characters');
});

await runTest('HMAC Security: verifyProposalSignature accepts matching signature and rejects altered parameters', () => {
  const proposalData = {
    proposalId: 'prop-12345',
    caregiverId: 'caregiver-abc',
    patientId: 'patient-xyz',
    providerUrl: 'https://gmch.gov.in',
    slot: 'Tomorrow 10:00 AM',
    expiresAt: Date.now() + 600000,
  };
  const validSig = bookingAssistantModule.createProposalSignature(proposalData);

  // Exact match must pass
  assert.strictEqual(bookingAssistantModule.verifyProposalSignature(validSig, proposalData), true);

  // Altered slot must fail
  assert.strictEqual(
    bookingAssistantModule.verifyProposalSignature(validSig, {
      ...proposalData,
      slot: 'Different Slot 2:00 PM',
    }),
    false
  );

  // Altered patient must fail
  assert.strictEqual(
    bookingAssistantModule.verifyProposalSignature(validSig, {
      ...proposalData,
      patientId: 'different-patient-999',
    }),
    false
  );

  // Altered provider URL must fail
  assert.strictEqual(
    bookingAssistantModule.verifyProposalSignature(validSig, {
      ...proposalData,
      providerUrl: 'https://fake-hospital.com',
    }),
    false
  );

  // Tampered signature string must fail
  assert.strictEqual(
    bookingAssistantModule.verifyProposalSignature('abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890', proposalData),
    false
  );
});

// ------------------------------------------------------------------------------
// TEST SUITE 3: FUNCTIONAL SERVERLESS AUTH & EXPLICIT CONFIRMATION BOUNDARIES
// ------------------------------------------------------------------------------
console.log('\n--- 3. Functional Serverless Route Guards & Confirmation Boundaries ---');

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

await runTest('Explicit Consent Boundary: confirm_booking requires caregiverConfirmed: true', () => {
  const src = fs.readFileSync(path.join(ROOT_DIR, 'api/caregiver/booking-assistant.ts'), 'utf8');
  assert(src.includes('if (caregiverConfirmed !== true)'), 'Must check caregiverConfirmed === true');
  assert(src.includes('CONFIRMATION_REQUIRED'), 'Must return CONFIRMATION_REQUIRED error code');
});

await runTest('Anti-Replay Boundary: confirm_booking checks and records duplicate proposal submissions', () => {
  const src = fs.readFileSync(path.join(ROOT_DIR, 'api/caregiver/booking-assistant.ts'), 'utf8');
  assert(src.includes('usedProposalIds.has(proposalId)'), 'Must check for duplicate proposal ID in usedProposalIds');
  assert(src.includes('DUPLICATE_SUBMISSION'), 'Must return DUPLICATE_SUBMISSION error code');
  assert(src.includes('usedProposalIds.add(proposalId)'), 'Must record confirmed proposalId to prevent replay');
});

await runTest('Proposal Expiry Boundary: confirm_booking rejects expired proposals', () => {
  const src = fs.readFileSync(path.join(ROOT_DIR, 'api/caregiver/booking-assistant.ts'), 'utf8');
  assert(src.includes('if (Date.now() > expiresAt)'), 'Must verify proposal expiry');
  assert(src.includes('PROPOSAL_EXPIRED'), 'Must return PROPOSAL_EXPIRED error code');
});

await runTest('Patient-Caregiver Authorization: Verifies caregiver_patient link in database without invalid columns', () => {
  const src = fs.readFileSync(path.join(ROOT_DIR, 'api/caregiver/booking-assistant.ts'), 'utf8');
  assert(src.includes('.from(\'caregiver_patient\')'), 'Must query caregiver_patient table');
  assert(src.includes('PATIENT_NOT_AUTHORIZED'), 'Must reject unlinked patient with PATIENT_NOT_AUTHORIZED');
  assert(!src.includes('.select(\'status\')'), 'Must not query non-existent status column on caregiver_patient');
});

await runTest('Focused Authorization: Authorized active link succeeds', async () => {
  const mockUserClient = {
    from: (table) => ({
      select: (cols) => ({
        eq: (col1, val1) => ({
          eq: (col2, val2) => ({
            limit: () => {
              if (table === 'caregiver_patient' && val1 === 'cg-1' && val2 === 'pt-1') {
                return { data: [{ id: 'link-1', caregiver_id: 'cg-1', patient_id: 'pt-1' }], error: null };
              }
              return { data: [], error: null };
            },
          }),
        }),
      }),
    }),
  };

  const res = await bookingAssistantModule.verifyCaregiverPatientLink(
    mockUserClient,
    null,
    'cg-1',
    'pt-1',
    false
  );
  assert.strictEqual(res.authorized, true, 'Authorized link must succeed');
});

await runTest('Focused Authorization: Missing or unlinked patient is rejected', async () => {
  const mockUserClient = {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            limit: () => ({ data: [], error: null }),
          }),
        }),
      }),
    }),
  };

  const res = await bookingAssistantModule.verifyCaregiverPatientLink(
    mockUserClient,
    null,
    'cg-1',
    'pt-unlinked',
    false
  );
  assert.strictEqual(res.authorized, false, 'Unlinked patient must be rejected');
});

await runTest('Focused Authorization: Another caregiver cannot access the patient', async () => {
  const mockUserClient = {
    from: (table) => ({
      select: () => ({
        eq: (col1, val1) => ({
          eq: (col2, val2) => ({
            limit: () => {
              // Patient is linked to cg-1, but cg-2 is requesting
              if (table === 'caregiver_patient' && val1 === 'cg-1' && val2 === 'pt-1') {
                return { data: [{ id: 'link-1', caregiver_id: 'cg-1', patient_id: 'pt-1' }], error: null };
              }
              return { data: [], error: null };
            },
          }),
        }),
      }),
    }),
  };

  const res = await bookingAssistantModule.verifyCaregiverPatientLink(
    mockUserClient,
    null,
    'cg-2', // Different caregiver
    'pt-1',
    false
  );
  assert.strictEqual(res.authorized, false, 'Other caregiver must be rejected');
});

await runTest('Safe Handoff Boundary: Handles hospital SMS OTP & counter payment gracefully', () => {
  const src = fs.readFileSync(path.join(ROOT_DIR, 'api/caregiver/booking-assistant.ts'), 'utf8');
  assert(src.includes('handoff_required'), 'Must support status: handoff_required');
  assert(src.includes('safeNextSteps'), 'Must provide safeNextSteps');
});

await runTest('Rate Limiter: Server enforces sliding window rate limiting per user', () => {
  const src = fs.readFileSync(path.join(ROOT_DIR, 'api/caregiver/booking-assistant.ts'), 'utf8');
  assert(src.includes('RATE_LIMIT_EXCEEDED'), 'Must enforce rate limit exceeded status');
  assert(src.includes('checkRateLimit'), 'Must include rate limiting function');
});

// ------------------------------------------------------------------------------
// TEST SUITE 4: UI COMPONENT & INTEGRATION INTEGRITY
// ------------------------------------------------------------------------------
console.log('\n--- 4. UI Component & Integration Integrity ---');

await runTest('Integration: CareNavigatorPage renders "Help Me Book" button for Nearby Care Finder', () => {
  const pageSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/pages/CareNavigatorPage.tsx'), 'utf8');
  assert(pageSrc.includes('Help Me Book'), 'CareNavigatorPage must contain "Help Me Book" button');
  assert(pageSrc.includes('activeSection === \'care_finder\''), 'Help Me Book must only render for care_finder results');
  assert(pageSrc.includes('HelpMeBookModal'), 'CareNavigatorPage must import and render HelpMeBookModal');
  assert(pageSrc.includes('setSelectedBookingProvider'), 'Must track selected provider state');
  assert(pageSrc.includes('Official Link'), 'Existing Official Link button must remain intact');
});

await runTest('Component: HelpMeBookModal provides Book Appointment and Read-Only Guide modes', () => {
  const modalSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/components/caregiver/HelpMeBookModal.tsx'), 'utf8');
  assert(modalSrc.includes('Book Appointment'), 'Must have Book Appointment mode');
  assert(modalSrc.includes('Read-Only Guide'), 'Must have Read-Only Guide mode');
  assert(modalSrc.includes('Select Authorized Patient'), 'Must require authorized patient selection');
  assert(modalSrc.includes('Search Availability & Prepare Proposal'), 'Must have explicit Stage 1 trigger');
  assert(modalSrc.includes('Confirm and Book Appointment'), 'Must have explicit Stage 2 trigger');
  assert(modalSrc.includes('hasCaregiverAgreed'), 'Must require caregiver agreement checkbox');
});

await runTest('Service: bookingAssistantService supports 2-stage workflow and read-only lookup', () => {
  const serviceSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/services/bookingAssistantService.ts'), 'utf8');
  assert(serviceSrc.includes('getBookingAssistance'), 'Must preserve getBookingAssistance method');
  assert(serviceSrc.includes('prepareBookingProposal'), 'Must support prepareBookingProposal method');
  assert(serviceSrc.includes('confirmBooking'), 'Must support confirmBooking method');
});

await runTest('Proxy: Vite development proxy routes /api/caregiver/booking-assistant', () => {
  const proxySrc = fs.readFileSync(path.join(ROOT_DIR, 'src/server/geminiProxyPlugin.ts'), 'utf8');
  assert(proxySrc.includes('/api/caregiver/booking-assistant'), 'Vite proxy must support /api/caregiver/booking-assistant');
  assert(proxySrc.includes('handleBookingAssistantApiRoute'), 'Must define handleBookingAssistantApiRoute');
});

// ------------------------------------------------------------------------------
// TEST SUITE 5: VERCEL SERVERLESS FUNCTION COUNT AUDIT
// ------------------------------------------------------------------------------
console.log('\n--- 5. Vercel Serverless Function Count Verification ---');

await runTest('Vercel Limit: Total serverless functions <= 12 (Free Hobby Plan)', () => {
  const apiDir = path.join(ROOT_DIR, 'api');
  function findFunctions(dir) {
    let funcs = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        funcs = funcs.concat(findFunctions(full));
      } else if (ent.isFile() && (ent.name.endsWith('.ts') || ent.name.endsWith('.js'))) {
        // Vercel treats files not starting with '_' as endpoints
        if (!ent.name.startsWith('_')) {
          funcs.push(path.relative(ROOT_DIR, full));
        }
      }
    }
    return funcs;
  }
  const functions = findFunctions(apiDir);
  console.log(`       Discovered Serverless Functions (${functions.length}):`);
  functions.forEach(f => console.log(`         - ${f}`));
  assert(functions.length <= 12, `Total functions (${functions.length}) exceeds Vercel Hobby limit of 12!`);
});

console.log('\n======================================================');
console.log(`TOTAL BOOKING TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${totalTests - passedTests}`);
if (passedTests === totalTests) {
  console.log('STATUS: ALL VERIFICATION TESTS PASSED (100%)\n');
  process.exit(0);
} else {
  console.error('STATUS: VERIFICATION FAILED\n');
  process.exit(1);
}
