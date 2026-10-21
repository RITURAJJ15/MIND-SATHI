// Unit & Integration verification for consolidated Serverless Functions
import handler from '../api/gemini.ts';

function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(key, value) {
      this.headers[key.toLowerCase()] = value;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    end() {
      return this;
    },
  };
  return res;
}

async function runTests() {
  console.log('--- Starting API Route Consolidation Tests ---\n');
  let passed = 0;
  let failed = 0;

  // Test 1: OPTIONS CORS Preflight
  {
    const req = { method: 'OPTIONS', url: '/api/gemini/assistant', query: {} };
    const res = createMockRes();
    await handler(req, res);
    if (res.statusCode === 204 && res.headers['access-control-allow-origin'] === '*') {
      console.log('✓ Test 1: OPTIONS preflight returns 204 with CORS headers');
      passed++;
    } else {
      console.error('✗ Test 1 failed:', res.statusCode, res.headers);
      failed++;
    }
  }

  // Test 2: Invalid HTTP Method (GET)
  {
    const req = { method: 'GET', url: '/api/gemini/personalize', query: {} };
    const res = createMockRes();
    await handler(req, res);
    if (res.statusCode === 405) {
      console.log('✓ Test 2: GET request rejected with 405 Method Not Allowed');
      passed++;
    } else {
      console.error('✗ Test 2 failed:', res.statusCode, res.body);
      failed++;
    }
  }

  // Test 3: Unknown Action
  {
    const req = { method: 'POST', url: '/api/gemini/unknown-endpoint', query: { action: 'unknown-endpoint' }, body: {} };
    const res = createMockRes();
    await handler(req, res);
    if (res.statusCode === 400 && res.body?.error?.includes('Unknown action')) {
      console.log('✓ Test 3: Unknown action returns 400 with helpful error');
      passed++;
    } else {
      console.error('✗ Test 3 failed:', res.statusCode, res.body);
      failed++;
    }
  }

  // Test 4: /api/gemini/personalize
  {
    const req = {
      method: 'POST',
      url: '/api/gemini/personalize',
      query: { action: 'personalize' },
      body: {
        userName: 'Achyut',
        language: 'as',
        sessions: [
          { gameId: 'smriti_sangam', score: 90, accuracy: 88, completed: true }
        ],
        currentDomainScores: { memory: 85, attention: 80 }
      }
    };
    const res = createMockRes();
    await handler(req, res);
    if (res.statusCode === 200 && res.body?.gameId && res.body?.difficulty) {
      console.log('✓ Test 4: /api/gemini/personalize returns valid recommendation:', res.body.gameId, `(${res.body.difficulty})`);
      passed++;
    } else {
      console.error('✗ Test 4 failed:', res.statusCode, res.body);
      failed++;
    }
  }

  // Test 5: /api/gemini/assistant (fallback & responses)
  {
    const req = {
      method: 'POST',
      url: '/api/gemini/assistant',
      query: { action: 'assistant' },
      body: {
        message: 'What medicine do I take today?',
        language: 'hi',
        reminders: [
          { title: 'Amlodipine 5mg', time: '09:00 AM', isCompletedToday: false }
        ]
      }
    };
    const res = createMockRes();
    await handler(req, res);
    if (res.statusCode === 200 && (res.body?.reply || res.body?.text)) {
      console.log('✓ Test 5: /api/gemini/assistant returns compassionate response:', (res.body.reply || res.body.text).slice(0, 60) + '...');
      passed++;
    } else {
      console.error('✗ Test 5 failed:', res.statusCode, res.body);
      failed++;
    }
  }

  // Test 6: /api/gemini/caregiver-insights
  {
    const req = {
      method: 'POST',
      url: '/api/gemini/caregiver-insights',
      query: { action: 'caregiver-insights' },
      body: {
        patientProfile: { full_name: 'Dada Baruah', age: 74, city: 'Guwahati' },
        gameSessions: [
          { gameId: 'smriti_sangam', score: 85, accuracy: 82, completed: true }
        ]
      }
    };
    const res = createMockRes();
    await handler(req, res);
    if (res.statusCode === 200 && (res.body?.cognitiveSummary || res.body?.riskLevel)) {
      console.log('✓ Test 6: /api/gemini/caregiver-insights returns structured caregiver data: riskLevel =', res.body.riskLevel);
      passed++;
    } else {
      console.error('✗ Test 6 failed:', res.statusCode, res.body);
      failed++;
    }
  }

  // Test 7: /api/gemini/plan-personalize & /api/gemini/personalize-plan
  {
    const req = {
      method: 'POST',
      url: '/api/gemini/plan-personalize',
      query: { action: 'plan-personalize' },
      body: {
        dayOfWeek: 'Wednesday',
        userName: 'Achyut',
        baselineFocus: 'Language & Verbal',
        language: 'en'
      }
    };
    const res = createMockRes();
    await handler(req, res);
    if (res.statusCode === 200 && res.body?.day && res.body?.recommendedGames) {
      console.log('✓ Test 7: /api/gemini/plan-personalize returns daily plan:', res.body.day, res.body.focusArea);
      passed++;
    } else {
      console.error('✗ Test 7 failed:', res.statusCode, res.body);
      failed++;
    }
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
