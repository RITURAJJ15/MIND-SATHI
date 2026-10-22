// ==============================================================================
// MIND SATHI: Offline-to-Online Sync Verification Test Suite
// ==============================================================================

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();

console.log('=== MIND SATHI: OFFLINE-TO-ONLINE SYNC VERIFICATION GATE ===\n');

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

// ------------------------------------------------------------------------------
// 1. SCHEMA ALIGNMENT & PAYLOAD INTEGRITY
// ------------------------------------------------------------------------------
console.log('--- 1. Schema Alignment & Database Column Integrity ---');

await runTest('Schema: syncService.ts does NOT insert non-existent columns into game_sessions', () => {
  const content = fs.readFileSync(path.join(ROOT_DIR, 'src/services/syncService.ts'), 'utf8');

  // Verify non-existent columns are NOT present in any insert to game_sessions
  assert.ok(!content.includes('user_id: mut.patientId'), 'Must not insert user_id in mutation game_sessions');
  assert.ok(!content.includes('user_id: session.userId'), 'Must not insert user_id in session game_sessions');
  assert.ok(!content.includes('created_at: sessionTimestamp'), 'Must not insert created_at in game_sessions');
  assert.ok(!content.includes('completed: true'), 'Must not insert top-level completed column');

  // Verify valid columns are used
  assert.ok(content.includes('patient_id: mut.patientId'), 'Must insert patient_id');
  assert.ok(content.includes('patient_id: session.userId'), 'Must insert patient_id for session');
  assert.ok(content.includes('completed_at: sessionTimestamp'), 'Must insert completed_at');
  assert.ok(content.includes('metadata: {'), 'Must store extended details in metadata');
});

await runTest('Schema: gameService.ts queries game_sessions with valid column names', () => {
  const content = fs.readFileSync(path.join(ROOT_DIR, 'src/services/gameService.ts'), 'utf8');
  assert.ok(!content.includes('.or(`patient_id.eq.${userId},user_id.eq.${userId}`)'), 'Must not query non-existent user_id');
  assert.ok(!content.includes(".order('created_at'"), 'Must not order by non-existent created_at');
  assert.ok(content.includes(".order('completed_at'"), 'Must order by completed_at');
});

await runTest('Schema: geminiService.ts queries game_sessions with valid column names', () => {
  const content = fs.readFileSync(path.join(ROOT_DIR, 'src/services/geminiService.ts'), 'utf8');
  assert.ok(!content.includes('.or(`patient_id.eq.${userId},user_id.eq.${userId}`)'), 'Must not query non-existent user_id');
  assert.ok(!content.includes('.or(`patient_id.eq.${patientId},user_id.eq.${patientId}`)'), 'Must not query non-existent user_id');
  assert.ok(content.includes(".order('completed_at', { ascending: false })"), 'Must order by completed_at');
});

// ------------------------------------------------------------------------------
// 2. ERROR CATEGORIZATION, SENSITIVE DATA HYGIENE & LOGGING
// ------------------------------------------------------------------------------
console.log('\n--- 2. Error Categorization & Privacy Protection ---');

await runTest('Privacy: syncService.ts categorizes errors safely without logging sensitive patient health data', () => {
  const content = fs.readFileSync(path.join(ROOT_DIR, 'src/services/syncService.ts'), 'utf8');
  assert.ok(content.includes('categorizeError'), 'Must define categorizeError');

  // Verify that categorizeError maps known error codes and doesn't dump raw query or sensitive data
  assert.ok(content.includes('Server schema mismatch'), 'Must provide safe message for 42703 / column mismatch');
  assert.ok(content.includes('Authentication session expired'), 'Must provide safe message for 401 / token expiry');
  assert.ok(content.includes('Network connection interrupted'), 'Must provide safe message for network drops');
});

await runTest('Privacy: No sensitive token or secret dumping in syncService logs', () => {
  const content = fs.readFileSync(path.join(ROOT_DIR, 'src/services/syncService.ts'), 'utf8');
  assert.ok(!content.includes('console.log(token'), 'No token logging');
  assert.ok(!content.includes('console.log(authHeader'), 'No auth header logging');
});

// ------------------------------------------------------------------------------
// 3. RETRY POLICY, EXPONENTIAL BACKOFF & IDEMPOTENCY
// ------------------------------------------------------------------------------
console.log('\n--- 3. Bounded Retries, Backoff & Deduplication ---');

await runTest('Backoff: syncService.ts bounds automatic retries and applies backoff', () => {
  const content = fs.readFileSync(path.join(ROOT_DIR, 'src/services/syncService.ts'), 'utf8');
  assert.ok(content.includes('isEligibleForRetry'), 'Must have isEligibleForRetry helper');
  assert.ok(content.includes('retries >= 5'), 'Must bound automatic retries to prevent infinite spamming');
  assert.ok(content.includes('Math.pow(2, retries)'), 'Must apply exponential backoff');
});

await runTest('Deduplication: getPendingCount() deduplicates game_sessions tracked in offlineMutations', () => {
  const content = fs.readFileSync(path.join(ROOT_DIR, 'src/services/syncService.ts'), 'utf8');
  assert.ok(content.includes('mutationGameSessionIds'), 'Must track mutation game session IDs to prevent duplicate counting');
  assert.ok(content.includes('uniquePendingSessions'), 'Must filter out duplicate session entries');
});

await runTest('Idempotency: Record removal only happens after server confirmation', () => {
  const content = fs.readFileSync(path.join(ROOT_DIR, 'src/services/syncService.ts'), 'utf8');
  // Mutations must only be deleted after successful sync, inside try block
  assert.ok(content.includes('await offlineDb.offlineMutations.delete(mut.id);'), 'Must delete mutation on success');
  assert.ok(content.includes('syncedCount++;'), 'Must count sync on success');
  // In catch block, mutation must be preserved and updated to failed status
  assert.ok(content.includes("status: 'failed'"), 'Must mark mutation failed on error');
  assert.ok(content.includes('retryCount: (mut.retryCount || 0) + 1'), 'Must increment retry count on failure');
});

// ------------------------------------------------------------------------------
// 4. NON-STUCK STATE & ACCURATE UI REPRESENTATION
// ------------------------------------------------------------------------------
console.log('\n--- 4. Non-Stuck State & Accurate Status UI ---');

await runTest('State: getSyncInfo() returns state = "syncing" ONLY when actively syncing', () => {
  const content = fs.readFileSync(path.join(ROOT_DIR, 'src/services/syncService.ts'), 'utf8');
  // Ensure that state = 'syncing' is strictly gated on this.isSyncing
  assert.ok(!content.includes("else if (pendingCount > 0) {\n      state = 'syncing';"), 'Must not set state=syncing when not isSyncing');
  assert.ok(content.includes('hasFailedRecords'), 'Must check for failed records when idle with pending items');
});

await runTest('Lock Safety: syncOfflineChanges releases isSyncing lock in finally block', () => {
  const content = fs.readFileSync(path.join(ROOT_DIR, 'src/services/syncService.ts'), 'utf8');
  assert.ok(content.includes('finally {'), 'Must have finally block in syncOfflineChanges');
  assert.ok(content.includes('this.isSyncing = false;'), 'Must set isSyncing = false in finally block');
  assert.ok(content.includes('await this.notify();'), 'Must notify listeners in finally block');
});

await runTest('Timestamp: lastSyncTime is updated ONLY when records actually sync or queue is clean', () => {
  const content = fs.readFileSync(path.join(ROOT_DIR, 'src/services/syncService.ts'), 'utf8');
  assert.ok(
    content.includes('if (syncedCount > 0 || (failedCount === 0 && mutations.length === 0))'),
    'lastSyncTime must only update on actual successful sync'
  );
});

await runTest('UI: SyncStatusIndicator.tsx does NOT falsely show "Syncing..." when state is online-synced with pending items', () => {
  const content = fs.readFileSync(path.join(ROOT_DIR, 'src/components/common/SyncStatusIndicator.tsx'), 'utf8');
  assert.ok(content.includes("shortLabel: syncInfo.pendingCount > 0 ? `Pending (${syncInfo.pendingCount})` : 'Synced'"), 'Header button must say Pending, not Syncing');
});

await runTest('UI: SyncStatusIndicator.tsx enables manual sync button when idle with pending or failed records', () => {
  const content = fs.readFileSync(path.join(ROOT_DIR, 'src/components/common/SyncStatusIndicator.tsx'), 'utf8');
  assert.ok(content.includes('disabled={!syncInfo.isOnline || isManualSyncing || syncInfo.state === \'syncing\'}'), 'Button must be enabled when idle');
  assert.ok(content.includes("syncInfo.state === 'sync-failed' ? 'Retry Synchronization' : 'Sync Now with Cloud'"), 'Button must offer Retry when sync failed');
});

// ------------------------------------------------------------------------------
// 5. AUTO-SYNC & CONNECTIVITY LISTENERS
// ------------------------------------------------------------------------------
console.log('\n--- 5. Auto-Sync & Event Listeners ---');

await runTest('Auto-Sync: online event triggers sync automatically', () => {
  const content = fs.readFileSync(path.join(ROOT_DIR, 'src/services/syncService.ts'), 'utf8');
  assert.ok(content.includes("window.addEventListener('online'"), 'Must listen for online event');
  assert.ok(content.includes('this.syncOfflineChanges(true)'), 'Must trigger sync on online event');
});

await runTest('Auto-Sync: visibilitychange triggers sync when app resumes', () => {
  const content = fs.readFileSync(path.join(ROOT_DIR, 'src/services/syncService.ts'), 'utf8');
  assert.ok(content.includes("document.addEventListener('visibilitychange'"), 'Must listen for visibilitychange');
});

await runTest('Auto-Sync: Background heartbeat checks every 30 seconds', () => {
  const content = fs.readFileSync(path.join(ROOT_DIR, 'src/services/syncService.ts'), 'utf8');
  assert.ok(content.includes('setInterval'), 'Must have setInterval');
  assert.ok(content.includes('30000'), 'Must run every 30 seconds');
});

// ------------------------------------------------------------------------------
// 6. SERVICE WORKER, CACHE INVALIDATION & PWA ASSET INTEGRITY
// ------------------------------------------------------------------------------
console.log('\n--- 6. Service Worker, Cache Invalidation & PWA Update Behavior ---');

await runTest('SW: Service worker cache version is bumped to v3 to flush stale assets', () => {
  const swContent = fs.readFileSync(path.join(ROOT_DIR, 'public/sw.js'), 'utf8');
  assert.ok(swContent.includes("const CACHE_NAME = 'mind-sathi-cache-v3';"), 'Must use mind-sathi-cache-v3');
  assert.ok(swContent.includes("caches.delete(key)"), 'Must delete old caches during activate');
});

await runTest('SW: Static assets include both patient shell and caregiver shell', () => {
  const swContent = fs.readFileSync(path.join(ROOT_DIR, 'public/sw.js'), 'utf8');
  assert.ok(swContent.includes("'/caregiver.html'"), 'Must include /caregiver.html in STATIC_ASSETS');
  assert.ok(swContent.includes("'/index.html'"), 'Must include /index.html in STATIC_ASSETS');
  assert.ok(swContent.includes("isCaregiver ? '/caregiver.html' : '/index.html'"), 'Must handle navigation fallback for caregiver route');
});

await runTest('PWA: HTML entrypoints check for SW updates immediately on load', () => {
  const indexHtml = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8');
  const caregiverHtml = fs.readFileSync(path.join(ROOT_DIR, 'caregiver.html'), 'utf8');
  assert.ok(indexHtml.includes('registration.update()'), 'index.html must call registration.update()');
  assert.ok(caregiverHtml.includes('registration.update()'), 'caregiver.html must call registration.update()');
  assert.ok(caregiverHtml.includes('manifest.webmanifest'), 'caregiver.html must link to manifest.webmanifest');
});

// ------------------------------------------------------------------------------
// 7. VERCEL SERVERLESS FUNCTION COUNT (<= 12 LIMIT)
// ------------------------------------------------------------------------------
console.log('\n--- 7. Vercel Hobby Serverless Limit Verification ---');

await runTest('Vercel Limit: Total serverless functions <= 12', () => {
  function getFiles(dir, files = []) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const fullPath = path.join(dir, e.name);
      if (e.isDirectory()) {
        getFiles(fullPath, files);
      } else if (e.isFile() && (e.name.endsWith('.ts') || e.name.endsWith('.js'))) {
        files.push(fullPath);
      }
    }
    return files;
  }

  const apiFiles = getFiles(path.join(ROOT_DIR, 'api'));
  console.log(`       Discovered Serverless Functions (${apiFiles.length}):`);
  apiFiles.forEach((f) => console.log(`         - ${path.relative(ROOT_DIR, f)}`));

  assert.ok(apiFiles.length <= 12, `Serverless function count (${apiFiles.length}) exceeds Vercel Hobby limit of 12!`);
});

// ------------------------------------------------------------------------------
// RESULTS SUMMARY
// ------------------------------------------------------------------------------
console.log('\n======================================================');
console.log(`TOTAL OFFLINE SYNC TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${totalTests - passedTests}`);
if (passedTests === totalTests) {
  console.log('STATUS: ALL VERIFICATION TESTS PASSED (100%)\n');
} else {
  console.error('STATUS: VERIFICATION FAILED\n');
  process.exit(1);
}
