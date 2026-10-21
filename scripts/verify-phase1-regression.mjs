// ==============================================================================
// MIND SATHI: Phase 1.5 Independent Verification & Role Authorization Test Suite
// ==============================================================================

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT_DIR = process.cwd();

console.log('=== MIND SATHI: PHASE 1.5 INDEPENDENT VERIFICATION GATE ===\n');

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

// Mock Response Helper for Serverless Handler Testing
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
// TEST SUITE 1: STATIC AUDIT & CREDENTIAL HYGIENE
// ------------------------------------------------------------------------------
console.log('--- 1. Static Audit & Secret Leak Checks ---');

await runTest('Security: No hardcoded base64 admin credentials in api/admin/login.ts', () => {
  const content = fs.readFileSync(path.join(ROOT_DIR, 'api/admin/login.ts'), 'utf8');
  assert(!content.includes('UklUVVJBSjEx'), 'Found base64 encoded username in api/admin/login.ts');
  assert(!content.includes('UklUVVJBSkAxMQ=='), 'Found base64 encoded password in api/admin/login.ts');
  assert(!content.includes('RITURAJ@11'), 'Found plaintext password in api/admin/login.ts');
  assert(!content.includes('DEFAULT_ID ='), 'Found DEFAULT_ID fallback in api/admin/login.ts');
  assert(!content.includes('DEFAULT_PASS ='), 'Found DEFAULT_PASS fallback in api/admin/login.ts');
});

await runTest('Security: No plaintext credential comments or client hashes in src/services/adminService.ts', () => {
  const content = fs.readFileSync(path.join(ROOT_DIR, 'src/services/adminService.ts'), 'utf8');
  assert(!content.includes('RITURAJ@11'), 'Found plaintext credential comment in adminService.ts');
  assert(!content.includes('HASHED_ADMIN_PASS'), 'Found client-side password hash comparison in adminService.ts');
  assert(!content.includes('HASHED_ADMIN_IDS'), 'Found client-side user hash comparison in adminService.ts');
  assert(!content.includes('admin_token_${Date.now()}_secure'), 'Found predictable pseudo-token in adminService.ts');
});

await runTest('Security: No unauthenticated bypass call in src/services/familyService.ts', () => {
  const content = fs.readFileSync(path.join(ROOT_DIR, 'src/services/familyService.ts'), 'utf8');
  assert(
    !content.includes('// 5. Also call backend API to guarantee deletion in database regardless of client RLS session'),
    'Found unauthenticated RLS bypass comment in familyService.ts'
  );
  assert(content.includes('Authorization: `Bearer ${accessToken}`'), 'Missing bearer token header in family deletion call');
});

await runTest('Security: No ephemeral in-memory memoryStore in api/sync.ts', () => {
  const content = fs.readFileSync(path.join(ROOT_DIR, 'api/sync.ts'), 'utf8');
  assert(!content.includes('let memoryStore'), 'api/sync.ts must not have in-memory store');
  assert(!content.includes('ramesh@mindsathi.in'), 'api/sync.ts must not have hardcoded mock patient records');
});

// ------------------------------------------------------------------------------
// TEST SUITE 2: CRYPTOGRAPHIC ADMIN AUTH & ROLE IMPERSONATION CHECKS
// ------------------------------------------------------------------------------
console.log('\n--- 2. Cryptographic Admin Authentication & Role Enforcement ---');

const TEST_SECRET = 'mind_sathi_test_jwt_secret_32_characters_minimum!';
process.env.ADMIN_JWT_SECRET = TEST_SECRET;

const authModule = await import('../api/admin/_auth.ts');

await runTest('Auth: Admin token creation and valid signature verification', () => {
  const token = authModule.signAdminToken('admin_user_01', 1);
  assert(typeof token === 'string', 'Token must be a string');
  assert.strictEqual(token.split('.').length, 3, 'Token must have header.payload.signature structure');

  const result = authModule.verifyAdminToken(token);
  assert.strictEqual(result.valid, true, 'Valid token must be verified');
  assert.strictEqual(result.adminId, 'admin_user_01', 'Decoded adminId must match');
});

await runTest('Auth: Tampered token signature is rejected', () => {
  const token = authModule.signAdminToken('admin_user_01', 1);
  const parts = token.split('.');
  const tamperedSig = Buffer.from('forged_signature_xyz').toString('base64url');
  const tamperedToken = `${parts[0]}.${parts[1]}.${tamperedSig}`;

  const result = authModule.verifyAdminToken(tamperedToken);
  assert.strictEqual(result.valid, false, 'Tampered signature must be rejected');
});

await runTest('Auth: Tampered payload (role elevation) is rejected', () => {
  const token = authModule.signAdminToken('admin_user_01', 1);
  const parts = token.split('.');
  // Attacker tries to change payload
  const forgedPayload = Buffer.from(JSON.stringify({ sub: 'hacker', role: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
  const forgedToken = `${parts[0]}.${forgedPayload}.${parts[2]}`;

  const result = authModule.verifyAdminToken(forgedToken);
  assert.strictEqual(result.valid, false, 'Forged payload with original signature must be rejected');
});

await runTest('Auth: Expired admin token is rejected', () => {
  // Create an expired payload
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub: 'admin_user_01',
      role: 'admin',
      iat: Math.floor(Date.now() / 1000) - 7200,
      exp: Math.floor(Date.now() / 1000) - 3600, // expired 1 hour ago
    })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', TEST_SECRET).update(`${header}.${payload}`).digest('base64url');
  const expiredToken = `${header}.${payload}.${sig}`;

  const result = authModule.verifyAdminToken(expiredToken);
  assert.strictEqual(result.valid, false, 'Expired token must be rejected');
  assert.strictEqual(result.error, 'Token has expired', 'Error message must specify expiration');
});

await runTest('Auth Role Check: Anonymous caller rejected by verifyCallerIsAdmin', async () => {
  const mockSupabase = {};
  const res = await authModule.verifyCallerIsAdmin(undefined, mockSupabase);
  assert.strictEqual(res.authorized, false, 'Anonymous caller must be rejected');
});

await runTest('Auth Role Check: Patient role cannot impersonate admin', async () => {
  const mockSupabase = {
    auth: {
      async getUser(token) {
        if (token === 'patient_valid_jwt') {
          return { data: { user: { id: 'patient-uuid-1234', app_metadata: { role: 'elderly' } } }, error: null };
        }
        return { data: { user: null }, error: new Error('Invalid token') };
      },
    },
    from(table) {
      return {
        select(col) {
          return {
            eq(key, val) {
              return {
                async maybeSingle() {
                  return { data: { role: 'elderly' } };
                },
              };
            },
          };
        },
      };
    },
  };

  const res = await authModule.verifyCallerIsAdmin('Bearer patient_valid_jwt', mockSupabase);
  assert.strictEqual(res.authorized, false, 'Patient must NOT be authorized as admin');
  assert.strictEqual(res.reason, 'User does not possess administrative role');
});

await runTest('Auth Role Check: Caregiver role cannot impersonate admin', async () => {
  const mockSupabase = {
    auth: {
      async getUser(token) {
        if (token === 'caregiver_valid_jwt') {
          return { data: { user: { id: 'caregiver-uuid-5678', app_metadata: { role: 'caregiver' } } }, error: null };
        }
        return { data: { user: null }, error: new Error('Invalid token') };
      },
    },
    from(table) {
      return {
        select(col) {
          return {
            eq(key, val) {
              return {
                async maybeSingle() {
                  return { data: { role: 'caregiver' } };
                },
              };
            },
          };
        },
      };
    },
  };

  const res = await authModule.verifyCallerIsAdmin('Bearer caregiver_valid_jwt', mockSupabase);
  assert.strictEqual(res.authorized, false, 'Caregiver must NOT be authorized as admin');
  assert.strictEqual(res.reason, 'User does not possess administrative role');
});

await runTest('Auth Role Check: Valid admin user is authorized', async () => {
  const mockSupabase = {
    auth: {
      async getUser(token) {
        if (token === 'admin_valid_jwt') {
          return { data: { user: { id: 'admin-uuid-9999', app_metadata: { role: 'admin' } } }, error: null };
        }
        return { data: { user: null }, error: new Error('Invalid token') };
      },
    },
    from(table) {
      return {
        select(col) {
          return {
            eq(key, val) {
              return {
                async maybeSingle() {
                  return { data: { role: 'admin' } };
                },
              };
            },
          };
        },
      };
    },
  };

  const res = await authModule.verifyCallerIsAdmin('Bearer admin_valid_jwt', mockSupabase);
  assert.strictEqual(res.authorized, true, 'Admin profile must be authorized');
});

// ------------------------------------------------------------------------------
// TEST SUITE 3: SERVERLESS ENDPOINT AUTHORIZATION CHECKS
// ------------------------------------------------------------------------------
console.log('\n--- 3. Functional Serverless Route Guard Checks ---');

// A. api/admin/login.ts functional testing
const adminLoginHandler = (await import('../api/admin/login.ts')).default;

await runTest('api/admin/login: Fails closed (503) if server env credentials missing', async () => {
  const origId = process.env.ADMIN_USER_ID;
  const origPass = process.env.ADMIN_PASSWORD;
  delete process.env.ADMIN_USER_ID;
  delete process.env.ADMIN_PASSWORD;

  const req = { method: 'POST', body: { userId: 'admin', password: 'password' }, headers: {} };
  const res = createMockRes();
  await adminLoginHandler(req, res);

  assert.strictEqual(res.statusCode, 503, 'Must return 503 when server credentials unconfigured');

  process.env.ADMIN_USER_ID = origId || 'test_admin_user';
  process.env.ADMIN_PASSWORD = origPass || 'test_admin_pass_123';
});

await runTest('api/admin/login: Rejects invalid credentials with 401', async () => {
  process.env.ADMIN_USER_ID = 'secure_admin';
  process.env.ADMIN_PASSWORD = 'super_secret_pass';

  const req = { method: 'POST', body: { userId: 'secure_admin', password: 'WRONG_PASSWORD' }, headers: {} };
  const res = createMockRes();
  await adminLoginHandler(req, res);

  assert.strictEqual(res.statusCode, 401, 'Must return 401 on incorrect password');
});

await runTest('api/admin/login: Accepts valid credentials with 200 and signed token', async () => {
  process.env.ADMIN_USER_ID = 'secure_admin';
  process.env.ADMIN_PASSWORD = 'super_secret_pass';

  const req = { method: 'POST', body: { userId: 'secure_admin', password: 'super_secret_pass' }, headers: {} };
  const res = createMockRes();
  await adminLoginHandler(req, res);

  assert.strictEqual(res.statusCode, 200, 'Must return 200 on correct credentials');
  assert(res.body?.success, 'Body must indicate success');
  assert(typeof res.body?.token === 'string', 'Body must contain signed token');
  
  const tokenVerify = authModule.verifyAdminToken(res.body.token);
  assert.strictEqual(tokenVerify.valid, true, 'Returned token must be cryptographically valid');
});

// B. api/family/delete.ts functional testing
const familyDeleteHandler = (await import('../api/family/delete.ts')).default;

await runTest('api/family/delete: Rejects unauthenticated request with 401', async () => {
  const req = { method: 'POST', body: { memberId: 'member-123', patientId: 'patient-456' }, headers: {} };
  const res = createMockRes();
  await familyDeleteHandler(req, res);

  assert.strictEqual(res.statusCode, 401, 'Must reject unauthenticated request with 401');
});

// C. api/sync.ts functional testing
const syncHandler = (await import('../api/sync.ts')).default;

await runTest('api/sync: Rejects unauthenticated /store-patient request with 401', async () => {
  const req = { url: '/api/sync/store-patient', method: 'POST', body: { patient: { id: 'pt-1' } }, headers: {} };
  const res = createMockRes();
  await syncHandler(req, res);

  assert.strictEqual(res.statusCode, 401, 'Must reject unauthenticated store-patient with 401');
});

await runTest('api/sync: Rejects unauthenticated /link-patient request with 401', async () => {
  const req = { url: '/api/sync/link-patient', method: 'POST', body: { caregiverId: 'cg-1', patientId: 'pt-1' }, headers: {} };
  const res = createMockRes();
  await syncHandler(req, res);

  assert.strictEqual(res.statusCode, 401, 'Must reject unauthenticated link-patient with 401');
});

await runTest('api/sync: Rejects unauthenticated /unlink-patient request with 401', async () => {
  const req = { url: '/api/sync/unlink-patient', method: 'POST', body: { caregiverId: 'cg-1', patientId: 'pt-1' }, headers: {} };
  const res = createMockRes();
  await syncHandler(req, res);

  assert.strictEqual(res.statusCode, 401, 'Must reject unauthenticated unlink-patient with 401');
});

await runTest('api/sync: Rejects unauthenticated /get-assigned-patient request with 401', async () => {
  const req = { url: '/api/sync/get-assigned-patient?caregiverId=cg-1', method: 'GET', query: { caregiverId: 'cg-1' }, headers: {} };
  const res = createMockRes();
  await syncHandler(req, res);

  assert.strictEqual(res.statusCode, 401, 'Must reject unauthenticated get-assigned-patient with 401');
});

// ------------------------------------------------------------------------------
// TEST SUITE 4: SCHEMA & MIGRATION RISK CHECKS
// ------------------------------------------------------------------------------
console.log('\n--- 4. Schema Integrity & Migration Risk Checks ---');

await runTest('Schema: live_location_sessions policy has valid closing syntax', () => {
  const schema = fs.readFileSync(path.join(ROOT_DIR, 'supabase_schema.sql'), 'utf8');
  const targetIdx = schema.indexOf('Patients can view their own live location sessions');
  assert(targetIdx !== -1, 'Policy not found in supabase_schema.sql');
  const slice = schema.substring(targetIdx, targetIdx + 600);
  assert(/  \);\s+-- 5\. Enable Realtime on live_location_sessions/.test(slice), 'Policy missing closing parenthesis and semicolon');
});

await runTest('Schema: game_sessions table defines user_id, patient_id, completed_at, and metadata', () => {
  const schema = fs.readFileSync(path.join(ROOT_DIR, 'supabase_schema.sql'), 'utf8');
  assert(schema.includes('patient_id UUID REFERENCES public.profiles(id)'), 'patient_id missing');
  assert(schema.includes('completed_at TIMESTAMPTZ DEFAULT now()'), 'completed_at missing');
  assert(schema.includes('metadata JSONB DEFAULT'), 'metadata missing');
  assert(schema.includes('idx_game_sessions_patient'), 'idx_game_sessions_patient index missing');
});

await runTest('Migration: Verification of 20261017_align_game_sessions_schema.sql', () => {
  const migrationPath = path.join(ROOT_DIR, 'supabase/migrations/20261017_align_game_sessions_schema.sql');
  assert(fs.existsSync(migrationPath), 'Migration file must exist');
  const content = fs.readFileSync(migrationPath, 'utf8');

  // Check no dangerous recursion
  assert(content.includes('BEFORE INSERT OR UPDATE ON public.game_sessions'), 'Must be a BEFORE trigger to prevent recursion');
  assert(!content.includes('UPDATE public.game_sessions') || content.includes('UPDATE public.game_sessions\nSET') || content.includes('UPDATE public.game_sessions\r\nSET'), 'Function must mutate NEW record, not call UPDATE table');
  
  // Check RLS policies
  assert(content.includes('USING (user_id = auth.uid() OR patient_id = auth.uid())'), 'Patient policy must check user_id OR patient_id');
  assert(content.includes('ROLLBACK SCRIPT'), 'Must document rollback procedure');
});

// ------------------------------------------------------------------------------
// TEST SUITE 5: DAILY PLAN & GAME ENGINE RESOLUTION
// ------------------------------------------------------------------------------
console.log('\n--- 5. Daily Plan & Game Engine Resolution Checks ---');

await runTest('Routing: Serverless plan-personalize alias exists', () => {
  const aliasPath = path.join(ROOT_DIR, 'api/gemini/plan-personalize.ts');
  assert(fs.existsSync(aliasPath), 'api/gemini/plan-personalize.ts must exist');
});

await runTest('Routing: Vite local dev proxy supports both plan personalization routes', () => {
  const plugin = fs.readFileSync(path.join(ROOT_DIR, 'src/server/geminiProxyPlugin.ts'), 'utf8');
  assert(plugin.includes("url === '/api/gemini/plan-personalize' || url === '/api/gemini/personalize-plan'"), 'Plugin must match both routes');
});

await runTest('GamePlayPage: Every scheduled game ID resolves to a component', () => {
  const dailyPlanContent = fs.readFileSync(path.join(ROOT_DIR, 'src/services/dailyPlanService.ts'), 'utf8');
  const pageContent = fs.readFileSync(path.join(ROOT_DIR, 'src/pages/GamePlayPage.tsx'), 'utf8');

  // Extract all gameId values from dailyPlanService
  const matches = [...dailyPlanContent.matchAll(/gameId:\s*'([^']+)'/g)].map((m) => m[1]);
  const uniqueGameIds = [...new Set(matches)];

  assert(uniqueGameIds.length >= 10, 'Must extract game IDs from dailyPlanService');

  for (const gId of uniqueGameIds) {
    const isExplicitlyHandled =
      pageContent.includes(`gameId === '${gId}'`) ||
      pageContent.includes(`'${gId}'`);
    assert(isExplicitlyHandled, `Game ID "${gId}" from daily plan must be handled in GamePlayPage.tsx`);
  }

  assert(pageContent.includes('isUnknownGame'), 'GamePlayPage must include safe fallback for unexpected IDs');
});

// ------------------------------------------------------------------------------
// TEST SUITE 6: CARE NAVIGATOR & TINYFISH INTEGRATION
// ------------------------------------------------------------------------------
console.log('\n--- 6. Care Navigator & TinyFish Integration Checks ---');

await runTest('Care Navigator: Endpoint exists and rejects unauthenticated request with 401', async () => {
  const navigatorHandler = (await import('../api/caregiver/navigator.ts')).default;
  const mockReq = {
    method: 'POST',
    headers: {}, // No Authorization header
    body: { section: 'care_finder', query: 'Guwahati' },
  };
  const mockRes = createMockRes();

  await navigatorHandler(mockReq, mockRes);
  assert.strictEqual(mockRes.statusCode, 401, 'Unauthenticated navigator request must be rejected with 401');
  assert.strictEqual(mockRes.body?.error, 'UNAUTHORIZED', 'Expected error code UNAUTHORIZED');
});

await runTest('Care Navigator: Endpoint fails closed / configuration-required when key missing', async () => {
  const content = fs.readFileSync(path.join(ROOT_DIR, 'api/caregiver/navigator.ts'), 'utf8');
  assert(content.includes('CONFIG_REQUIRED'), 'Must define CONFIG_REQUIRED state when API key is missing');
  assert(content.includes('TINYFISH_API_KEY'), 'Must read from process.env.TINYFISH_API_KEY');
  assert(!content.includes('sk-tinyfish-ePGCL8OjHMUHSSpcTGD04eys7IhQL6QM'), 'Must never hardcode the user API key into source code');
});

await runTest('Care Navigator: CaregiverApp.tsx contains Care Navigator sidebar navigation', () => {
  const appContent = fs.readFileSync(path.join(ROOT_DIR, 'src/CaregiverApp.tsx'), 'utf8');
  assert(appContent.includes('Care Navigator'), 'CaregiverApp must contain Care Navigator navigation item');
  assert(appContent.includes('Compass'), 'Must use Compass icon for Care Navigator');
  assert(appContent.includes('CareNavigatorPage'), 'Must import and render CareNavigatorPage');
  assert(appContent.includes('Patient Oversight'), 'Must preserve existing Patient Oversight view');
});

await runTest('Care Navigator: CareNavigatorPage.tsx implements all 4 functional sections with disclaimers', () => {
  const pageContent = fs.readFileSync(path.join(ROOT_DIR, 'src/pages/CareNavigatorPage.tsx'), 'utf8');
  assert(pageContent.includes('care_finder'), 'Must implement Nearby Care Finder section');
  assert(pageContent.includes('medicine'), 'Must implement Affordable Medicine section');
  assert(pageContent.includes('schemes'), 'Must implement Government Schemes section');
  assert(pageContent.includes('notices'), 'Must implement Health Notices section');
  assert(pageContent.includes('do not claim live stock availability'), 'Must include medicine stock disclaimer');
  assert(pageContent.includes('does not guarantee scheme eligibility'), 'Must include government scheme disclaimer');
});

await runTest('Care Navigator: Router and Vite proxy support /caregiver/navigator', () => {
  const routerContent = fs.readFileSync(path.join(ROOT_DIR, 'src/router/index.ts'), 'utf8');
  const proxyContent = fs.readFileSync(path.join(ROOT_DIR, 'src/server/geminiProxyPlugin.ts'), 'utf8');
  assert(routerContent.includes('/caregiver/navigator'), 'Router must include /caregiver/navigator');
  assert(proxyContent.includes('/api/caregiver/navigator'), 'Vite proxy must support /api/caregiver/navigator');
});

console.log('\n==============================================');
console.log(`TOTAL VERIFICATION TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${totalTests - passedTests}`);
if (passedTests === totalTests) {
  console.log('STATUS: ALL VERIFICATION GATES PASSED (100%)\n');
  process.exit(0);
} else {
  console.error('STATUS: VERIFICATION FAILED\n');
  process.exit(1);
}
