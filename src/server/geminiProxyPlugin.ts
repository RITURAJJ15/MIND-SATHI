import type { Plugin } from 'vite';
import http from 'http';
import fs from 'fs';
import path from 'path';

function parseJsonBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 5 * 1024 * 1024) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: http.ServerResponse, statusCode: number, data: any) {
  const json = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(json);
}

function extractJson(text: string): any {
  const clean = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(clean);
  } catch {
    const start = clean.indexOf('{');
    const end = clean.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(clean.substring(start, end + 1));
    }
    throw new Error('Unable to extract valid JSON from Gemini response');
  }
}

async function callGeminiGenerate(apiKey: string, contents: any[], systemInstruction?: string): Promise<string> {
  const models = ['gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-flash-latest'];

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const payload: any = { contents };

      if (systemInstruction) {
        payload.systemInstruction = {
          parts: [{ text: systemInstruction }],
        };
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (response.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
        return data.candidates[0].content.parts[0].text;
      }
      console.warn(`[Gemini Server Proxy] Model ${model} response not ok:`, data.error?.message || response.statusText);
    } catch (err: any) {
      console.warn(`[Gemini Server Proxy] Model ${model} fetch failed:`, err.message);
    }
  }

  throw new Error('All Gemini model fallbacks failed to respond.');
}

async function handleGeminiApiRoute(req: http.IncomingMessage, res: http.ServerResponse) {
  const url = req.url?.split('?')[0] || '';

  if (!url.startsWith('/api/gemini/')) {
    return false;
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    res.end();
    return true;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return true;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    sendJson(res, 500, { error: 'Gemini API key is not configured on server. Please set GEMINI_API_KEY in your environment variables.' });
    return true;
  }

  let body: any = {};
  try {
    body = await parseJsonBody(req);
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON request body.' });
    return true;
  }

  // 1. AI Cognitive Personalization
  if (url === '/api/gemini/personalize') {
    try {
      const { sessions, currentDomainScores, userName, language = 'en' } = body;
      const systemPrompt = `You are MIND SATHI Cognitive Personalization AI for elderly cognitive wellness in India.
Analyze the user's REAL cognitive game performance history and determine the next best game and difficulty tier.
Available games:
- 'smriti_sangam' (domain: memory, visual pairs)
- 'shabda_mala' (domain: language, word associations)
- 'rangoli_rekha' (domain: working_memory, visual patterns)
- 'bazaar_hisaab' (domain: executive, shopping & everyday math)
- 'dhyan_kendra' (domain: attention, visual focus)
- 'disha_sathi' (domain: visuospatial, clocks & directions)
- 'ne_states_memory' (domain: northeast_culture, regional culture recall)
- 'family_memory' (domain: family_reminiscence, family photo recall)

Difficulty options: 'saral' (gentle/easy), 'madhyam' (moderate/balanced), 'nipun' (challenging/advanced).

CRITICAL RULES:
1. Do not diagnose dementia or any disease. Frame all insights positively around cognitive support, stimulation, and brain wellness.
2. Output ONLY raw, valid JSON with this exact schema:
{
  "gameId": "smriti_sangam",
  "difficulty": "saral",
  "reason": "Clear explanation of why this game and difficulty tier are chosen based on recent accuracy, speed, and cognitive domains needing practice",
  "domainScores": {
    "memory": 85,
    "language": 80,
    "working_memory": 82,
    "executive": 75,
    "attention": 88,
    "visuospatial": 78
  },
  "summary": "Short 1-2 sentence performance summary for the elder in ${language}"
}`;

      const userPrompt = `User: ${userName || 'Dada'}
Recent Game Sessions (${sessions?.length || 0}):
${JSON.stringify(sessions?.slice(0, 10) || [])}
Current Domain Scores:
${JSON.stringify(currentDomainScores || {})}
Language: ${language}

Provide personalized game recommendation and difficulty in valid JSON only.`;

      const rawResponse = await callGeminiGenerate(apiKey, [{ parts: [{ text: userPrompt }] }], systemPrompt);
      const parsed = extractJson(rawResponse);
      sendJson(res, 200, parsed);
      return true;
    } catch (err: any) {
      console.warn('[Gemini Proxy Personalize Fallback]:', err.message);
      sendJson(res, 200, {
        gameId: 'smriti_sangam',
        difficulty: 'saral',
        reason: 'Gentle visual memory practice tailored to reinforce recall and support cognitive wellness today.',
        domainScores: body.currentDomainScores || { memory: 80, language: 80, working_memory: 80, executive: 80, attention: 80, visuospatial: 80 },
        summary: 'Daily brain stimulation routine ready.',
      });
      return true;
    }
  }

  // 1.1 7-Day Personalized Daily Plan
  if (url === '/api/gemini/plan-personalize') {
    try {
      const {
        dayOfWeek = 'Monday',
        planDate,
        baselineFocus = 'Memory Focus',
        baselineGames = ['family_memory', 'smriti_sangam'],
        sessions = [],
        performanceSummary,
        userName = 'Elderly User',
        language = 'en',
      } = body;

      const systemPrompt = `You are the MIND SATHI Cognitive Personalization AI for elderly cognitive wellness in India.
Your role is to personalize today's daily cognitive activity plan based on the 7-day weekly rotation schedule and the patient's actual recent game performance.

WEEKLY 7-DAY ROTATING STRUCTURE:
- Monday: Memory Focus (domain: memory, family recognition, recall)
- Tuesday: Attention & Focus (domain: attention, visual matching, concentration)
- Wednesday: Language & Verbal (domain: language, word recall, verbal memory)
- Thursday: Problem Solving & Logic (domain: executive, everyday math, pattern reasoning)
- Friday: Family & Social Connection (domain: family_reminiscence, audio/photo recall)
- Saturday: Mixed Cognitive Challenge (multi-domain cognitive workout)
- Sunday: Light Cognitive Review & Relaxation (gentle review, nature & calm stimulation)

PERSONALIZATION RULES:
1. Do NOT diagnose dementia or any disease. Keep all reasoning encouraging, warm, respectful, and clinically constructive.
2. Adapt difficulty based on recent performance:
   - Low accuracy (<70%) or high mistakes -> Recommend 'saral' (gentle/easy) with reinforcement.
   - Good accuracy (70-85%) -> Recommend 'madhyam' (moderate/balanced).
   - High accuracy (>85%) -> Recommend 'nipun' (advanced challenge).
3. Select 2-3 games fitting today's domain from valid game IDs:
   'smriti_sangam', 'shabda_mala', 'rangoli_rekha', 'bazaar_hisaab', 'dhyan_kendra', 'disha_sathi',
   'sequence_memory', 'object_recognition', 'word_recall', 'number_pattern', 'daily_challenge',
   'family_memory', 'ne_states_memory', 'guess_the_place', 'culture_match', 'food_memory', 'nature_memory', 'festival_memory'.
4. Output ONLY valid JSON matching this schema:
{
  "day": "${dayOfWeek}",
  "focusArea": "Today's specific focus area name",
  "difficulty": "saral",
  "estimatedDuration": 15,
  "recommendedGames": ["gameId1", "gameId2"],
  "reason": "1-2 sentence warm, encouraging explanation for the elder explaining why these activities were chosen today based on their recent performance in ${language}."
}`;

      const userPrompt = `Patient: ${userName}
Local Date: ${planDate}
Day of Week: ${dayOfWeek}
Baseline Focus: ${baselineFocus}
Baseline Recommended Games: ${JSON.stringify(baselineGames)}
Recent Performance Metrics:
${JSON.stringify(performanceSummary || { sessionsCount: sessions.length })}
Recent Sessions Sample:
${JSON.stringify(sessions.slice(0, 8))}
Target Language: ${language}

Provide the personalized plan in raw JSON only.`;

      const rawResponse = await callGeminiGenerate(apiKey, [{ parts: [{ text: userPrompt }] }], systemPrompt);
      const parsed = extractJson(rawResponse);
      sendJson(res, 200, parsed);
      return true;
    } catch (err: any) {
      console.warn('[Gemini Proxy Plan Personalize Fallback]:', err.message);
      sendJson(res, 200, {
        day: body.dayOfWeek || 'Monday',
        focusArea: body.baselineFocus || 'Memory Focus',
        difficulty: 'saral',
        estimatedDuration: 15,
        recommendedGames: body.baselineGames || ['family_memory', 'smriti_sangam'],
        reason: body.language === 'hi'
          ? 'आज की दिनचर्या आपकी स्मृति और मानसिक सजगता को प्रोत्साहित करने के लिए तैयार की गई है।'
          : "Today's activities are tailored to support your cognitive vitality and daily routine.",
      });
      return true;
    }
  }

  // 2. AI Sathi Memory Assistant
  if (url === '/api/gemini/assistant') {
    try {
      const {
        message,
        history = [],
        userProfile,
        familyMembers = [],
        reminders = [],
        dailyPlanTasks = [],
        caregiverName = '',
        language = 'en'
      } = body;

      const familySummary = familyMembers.map((f: any) => `- ${f.name} (${f.relationship?.en || f.relationship || 'Family'}): Phone ${f.phone || 'N/A'}${f.isFavorite ? ' [Favorite]' : ''}`).join('\n') || 'None recorded yet.';
      const reminderSummary = reminders.map((r: any) => `- ${r.title} at ${r.time} (${r.dosageOrDetail || r.type || 'medication'})`).join('\n') || 'No reminders scheduled.';
      const planSummary = dailyPlanTasks.map((t: any) => `- ${t.title}: ${t.completed ? 'Completed' : 'Pending'}`).join('\n') || 'No specific daily plan tasks.';

      const langMap: Record<string, { name: string; exampleGreeting: string }> = {
        as: { name: 'Assamese (অসমীয়া)', exampleGreeting: 'নমস্কাৰ' },
        bn: { name: 'Bengali (বাংলা)', exampleGreeting: 'নমস্কার' },
        hi: { name: 'Hindi (हिन्दी)', exampleGreeting: 'नमस्ते' },
        en: { name: 'English', exampleGreeting: 'Namaste' },
      };

      const targetLang = langMap[language] || langMap.en;

      const systemPrompt = `You are MIND SATHI (মাউন্ড সাথী / মাইণ্ড সাৰথি), a compassionate, respectful, and culturally attuned voice assistant for seniors and elders in India.
The authenticated user's name is ${userProfile?.name || 'Dada'} (preferred: ${userProfile?.preferredName || 'Dada'}).
Age: ${userProfile?.age || 72}, City: ${userProfile?.city || 'Guwahati'}, State: ${userProfile?.state || 'Assam'}.
Connected Caregiver: ${caregiverName || 'Priya'}.

GROUNDING DATA (AUTHENTICATED USER'S REAL SUPABASE DATA):
=========================================================
Family Members:
${familySummary}

Today's Reminders & Medications:
${reminderSummary}

Today's Activity Plan:
${planSummary}

Ayushman Bharat PM-JAY Status: ${userProfile?.isAyushmanMember ? 'Enrolled (ABHA: ' + (userProfile?.abhaId || 'Active') + ')' : 'Not enrolled'}
=========================================================

CRITICAL MANDATES:
1. STRICT LANGUAGE REQUIREMENT: You MUST reply entirely in ${targetLang.name}.
   - If Assamese (as) is chosen, write only in genuine Assamese (অসমীয়া) script.
   - If Bengali (bn) is chosen, write only in genuine Bengali (বাংলা) script.
   - If Hindi (hi) is chosen, write only in genuine Hindi (हिन्दी) Devanagari script.
   - If English (en) is chosen, write in warm, gentle English.
2. SPOKEN AUDIO CONCISENESS: This response will be read aloud to the elderly patient via Text-to-Speech.
   - Keep answers short, clear, and elderly-friendly (2 to 4 short sentences maximum).
   - Never use long lists, markdown tables, asterisks, or dense technical words.
3. PERSONAL DATA GROUNDING:
   - Base all answers regarding family members, medications, schedule, or identity ONLY on the real Supabase data above.
   - NEVER invent or assume relatives, phone numbers, or prescriptions.
   - If something is not in the records, gently say so in ${targetLang.name} and offer to help contact caregiver ${caregiverName || 'Priya'}.
4. MEDICAL SAFETY:
   - NEVER diagnose dementia, Alzheimer's, or any medical condition.
   - Provide emotional reassurance, brain stimulation, and practical daily reminders only.`;

      const geminiContents: any[] = [];
      for (const h of history.slice(-8)) {
        geminiContents.push({
          role: h.role === 'user' ? 'user' : 'model',
          parts: [{ text: h.content || h.message || h.text }],
        });
      }
      geminiContents.push({
        role: 'user',
        parts: [{ text: message }],
      });

      const replyText = await callGeminiGenerate(apiKey, geminiContents, systemPrompt);
      sendJson(res, 200, { reply: replyText });
      return true;
    } catch (err: any) {
      console.warn('[Gemini Proxy Assistant Fallback]:', err.message);
      const fallbackReplies: Record<string, string> = {
        as: 'নমস্কাৰ! 🙏 মই আপোনাৰ মাইণ্ড সাৰথি AI। মই আপোনাৰ লগত আছোঁ। আপোনাৰ পৰিয়াল, দৰব বা খেলৰ বিষয়ে কিবা জানিব বিচাৰে নেকি?',
        bn: 'নমস্কার! 🙏 আমি আপনার মাইন্ড সাথী AI। আমি আপনার সাথেই আছি। আপনার পরিবার, ওষুধ বা খেলা সম্পর্কে কিছু জানতে চান?',
        hi: 'नमस्ते! 🙏 मैं आपका माइंड साथी AI हूँ। मैं आपके साथ हूँ। आज मैं आपकी दवाओं, परिवार या दिमागी खेल में क्या सहायता करूँ?',
        en: 'Namaste! 🙏 I am your MIND SATHI AI companion. I am right here with you. How may I help you with your memories, reminders, or cognitive games today?',
      };
      sendJson(res, 200, {
        reply: fallbackReplies[body.language] || fallbackReplies.en,
      });
      return true;
    }
  }

  // 3. Caregiver AI Insights
  if (url === '/api/gemini/caregiver-insights') {
    try {
      const { patientProfile, gameSessions = [], language = 'en' } = body;

      const systemPrompt = `You are MIND SATHI Clinical & Caregiver Cognitive Insights Engine.
Your job is to analyze the REAL cognitive game sessions and activity history of an assigned patient and provide an objective, empathetic, and actionable summary for their caregiver.

CRITICAL INSTRUCTIONS:
1. NEVER declare or diagnose dementia, Alzheimer's, or clinical neurodegeneration. You provide non-diagnostic cognitive-support insights and trends only.
2. Base all observations strictly on the supplied game session data (scores, accuracy, mistakes, duration, completion rates).
3. Output ONLY raw, valid JSON with this exact schema:
{
  "cognitiveSummary": "Comprehensive 2-3 sentence overview of patient's cognitive engagement and overall progress.",
  "strengths": ["Domain 1 strength with specific evidence", "Domain 2 strength"],
  "areasForSupport": ["Domain needing gentle encouragement or simplified difficulty", "Specific area to watch"],
  "trendAnalysis": "Detailed trend breakdown comparing early vs recent sessions (accuracy, reaction speed, persistence).",
  "recommendationsForCaregiver": [
    "Practical daily activity or communication recommendation",
    "Suggested game practice routine or time of day"
  ],
  "riskLevel": "stable"
}
Note: riskLevel must be one of: "optimal", "stable", "attention_recommended".`;

      const userPrompt = `Patient Profile:
Name: ${patientProfile?.full_name || patientProfile?.name || 'Patient'}
Age: ${patientProfile?.age || 70}, City: ${patientProfile?.city || 'Guwahati'}
Total Game Sessions: ${gameSessions.length}

Sessions Data:
${JSON.stringify(gameSessions.slice(0, 15))}

Language: ${language}
Provide comprehensive caregiver insights in JSON format.`;

      const rawResponse = await callGeminiGenerate(apiKey, [{ parts: [{ text: userPrompt }] }], systemPrompt);
      const parsed = extractJson(rawResponse);
      sendJson(res, 200, parsed);
      return true;
    } catch (err: any) {
      console.warn('[Gemini Proxy Caregiver Insights Fallback]:', err.message);
      sendJson(res, 200, {
        cognitiveSummary: 'Patient demonstrates steady engagement with cognitive stimulation games. Recent participation shows consistent attentiveness and positive effort.',
        strengths: ['Regular session completion', 'Positive engagement in memory activities'],
        areasForSupport: ['Consider gentle hints during speed-based tasks to reduce frustration'],
        trendAnalysis: 'Stable cognitive scores maintained across sessions.',
        recommendationsForCaregiver: [
          'Encourage daily 15-minute game sessions in the morning',
          'Celebrate achievements to reinforce positive motivation',
        ],
        riskLevel: 'stable',
      });
      return true;
    }
  }

  sendJson(res, 404, { error: 'Unknown endpoint' });
  return true;
}

interface SyncStore {
  patients: any[];
  caregivers: any[];
  links: Array<{ caregiverId: string; patientId: string; caregiverEmail?: string; patientEmail?: string; connectionCode?: string; linkedAt: string }>;
}

const STORE_DIR = path.resolve(process.cwd(), 'data');
const STORE_FILE = path.join(STORE_DIR, 'mindsathi_store.json');

function loadSyncStore(): SyncStore {
  try {
    if (!fs.existsSync(STORE_DIR)) {
      fs.mkdirSync(STORE_DIR, { recursive: true });
    }
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        patients: Array.isArray(parsed.patients) ? parsed.patients : [],
        caregivers: Array.isArray(parsed.caregivers) ? parsed.caregivers : [],
        links: Array.isArray(parsed.links) ? parsed.links : [],
      };
    }
  } catch (e) {
    console.warn('[SyncStore] Load notice:', e);
  }
  return {
    patients: [
      {
        id: '11111111-1111-4000-a000-000000000001',
        full_name: 'Ramesh Kumar',
        name: 'Ramesh Kumar',
        preferred_name: 'Ramesh Ji',
        preferredName: 'Ramesh Ji',
        role: 'elderly',
        email: 'ramesh@mindsathi.in',
        phone: '9876543210',
        age: 72,
        gender: 'male',
        city: 'Guwahati',
        state: 'Assam',
        connectionCode: 'MS-RAMESH',
        secondaryLanguage: 'MS-RAMESH',
        secondary_language: 'MS-RAMESH',
        profile_photo_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
        avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
        abha_id: '91-4829-1029-4820',
        abhaId: '91-4829-1029-4820',
        pmjay_id: 'PMJAY-AS-84729104',
        pmjayId: 'PMJAY-AS-84729104',
        streak_days: 5,
        streakDays: 5,
        total_xp: 450,
        totalXp: 450,
        level: 2,
        level_title: 'Sadhak Sathi',
        levelTitle: 'Sadhak Sathi',
        createdAt: new Date().toISOString(),
      },
    ],
    caregivers: [],
    links: [],
  };
}

function saveSyncStore(store: SyncStore): void {
  try {
    if (!fs.existsSync(STORE_DIR)) {
      fs.mkdirSync(STORE_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (e) {
    console.error('[SyncStore] Save error:', e);
  }
}

async function handleSyncApiRoute(req: http.IncomingMessage, res: http.ServerResponse): Promise<boolean> {
  const [urlPath, queryString] = (req.url || '').split('?');
  if (!urlPath.startsWith('/api/sync/')) {
    return false;
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    res.end();
    return true;
  }

  const queryParams = new URLSearchParams(queryString || '');
  const store = loadSyncStore();

  // 1. GET /api/sync/find-patient?q=...
  if (urlPath === '/api/sync/find-patient' && req.method === 'GET') {
    const q = (queryParams.get('q') || queryParams.get('query') || queryParams.get('code') || queryParams.get('email') || '').trim().toLowerCase();
    const cleanDigits = q.replace(/\D/g, '');
    const codeNoPrefix = q.replace(/^ms-?/i, '');

    const found = store.patients.find((p) => {
      const pEmail = (p.email || '').toLowerCase();
      const pCode = (p.connectionCode || p.secondary_language || p.secondaryLanguage || '').toLowerCase();
      const pCodeNoPrefix = pCode.replace(/^ms-?/i, '');
      const pId = (p.id || '').toLowerCase();
      const pName = (p.full_name || p.name || '').toLowerCase();
      const pPhone = (p.phone || '').replace(/\D/g, '');

      if (pEmail && pEmail === q) return true;
      if (pCode && (pCode === q || pCodeNoPrefix === codeNoPrefix)) return true;
      if (pId && (pId === q || pId.startsWith(q) || (codeNoPrefix.length >= 4 && pId.replace(/-/g, '').startsWith(codeNoPrefix)))) return true;
      if (cleanDigits.length >= 10 && pPhone.endsWith(cleanDigits.slice(-10))) return true;
      if (q.length > 2 && pName.includes(q)) return true;
      return false;
    });

    if (found) {
      sendJson(res, 200, { success: true, patient: found });
    } else {
      sendJson(res, 404, { success: false, error: 'No registered patient found with identifier ' + q });
    }
    return true;
  }

  // 2. POST /api/sync/store-patient
  if (urlPath === '/api/sync/store-patient' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const patient = body.patient || body;
      if (!patient || !patient.id) {
        sendJson(res, 400, { success: false, error: 'Patient object with id is required' });
        return true;
      }

      const connectionCode = patient.connectionCode || patient.secondary_language || patient.secondaryLanguage || ('MS-' + patient.id.replace(/-/g, '').substring(0, 6).toUpperCase());
      const normalized = {
        ...patient,
        connectionCode,
        secondaryLanguage: connectionCode,
        secondary_language: connectionCode,
        updatedAt: new Date().toISOString(),
      };

      const existingIdx = store.patients.findIndex((p) => p.id === patient.id || (p.email && patient.email && p.email.toLowerCase() === patient.email.toLowerCase()));
      if (existingIdx >= 0) {
        store.patients[existingIdx] = { ...store.patients[existingIdx], ...normalized };
      } else {
        store.patients.push(normalized);
      }
      saveSyncStore(store);
      sendJson(res, 200, { success: true, patient: normalized });
    } catch (e: any) {
      sendJson(res, 500, { success: false, error: e.message });
    }
    return true;
  }

  // 3. GET /api/sync/all-patients
  if (urlPath === '/api/sync/all-patients' && req.method === 'GET') {
    sendJson(res, 200, { success: true, patients: store.patients });
    return true;
  }

  // 4. POST /api/sync/store-caregiver
  if (urlPath === '/api/sync/store-caregiver' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const caregiver = body.caregiver || body;
      if (!caregiver || !caregiver.email) {
        sendJson(res, 400, { success: false, error: 'Caregiver email is required' });
        return true;
      }

      const cleanEmail = caregiver.email.toLowerCase();
      const normalized = {
        ...caregiver,
        email: cleanEmail,
        updatedAt: new Date().toISOString(),
      };

      const existingIdx = store.caregivers.findIndex((c) => c.email.toLowerCase() === cleanEmail || (caregiver.id && c.id === caregiver.id));
      if (existingIdx >= 0) {
        store.caregivers[existingIdx] = { ...store.caregivers[existingIdx], ...normalized };
      } else {
        store.caregivers.push(normalized);
      }
      saveSyncStore(store);
      sendJson(res, 200, { success: true, caregiver: normalized });
    } catch (e: any) {
      sendJson(res, 500, { success: false, error: e.message });
    }
    return true;
  }

  // 5. GET /api/sync/get-caregiver?email=...
  if (urlPath === '/api/sync/get-caregiver' && req.method === 'GET') {
    const email = (queryParams.get('email') || '').trim().toLowerCase();
    const found = store.caregivers.find((c) => c.email.toLowerCase() === email);
    if (found) {
      sendJson(res, 200, { success: true, caregiver: found });
    } else {
      sendJson(res, 404, { success: false, error: 'Caregiver not found' });
    }
    return true;
  }

  // 6. POST /api/sync/link-patient
  if (urlPath === '/api/sync/link-patient' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const { caregiverId, patientId, caregiverEmail, patientEmail, connectionCode } = body;
      if (!caregiverId || !patientId) {
        sendJson(res, 400, { success: false, error: 'caregiverId and patientId are required' });
        return true;
      }

      // Check strict 1-to-1: is patient already linked to another caregiver?
      const otherCg = store.links.find((l) => l.patientId === patientId && l.caregiverId !== caregiverId);
      if (otherCg) {
        sendJson(res, 409, {
          success: false,
          error: 'This patient is already linked to another caregiver. Mind Sathi strictly maintains a 1 Patient ↔ 1 Caregiver relationship.'
        });
        return true;
      }

      // Remove any prior link for this caregiver
      store.links = store.links.filter((l) => l.caregiverId !== caregiverId && l.caregiverEmail !== caregiverEmail);

      // Add link
      store.links.push({
        caregiverId,
        patientId,
        caregiverEmail: caregiverEmail?.toLowerCase(),
        patientEmail: patientEmail?.toLowerCase(),
        connectionCode,
        linkedAt: new Date().toISOString(),
      });
      saveSyncStore(store);
      sendJson(res, 200, { success: true, message: 'Linked successfully' });
    } catch (e: any) {
      sendJson(res, 500, { success: false, error: e.message });
    }
    return true;
  }

  // 7. POST /api/sync/unlink-patient
  if (urlPath === '/api/sync/unlink-patient' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const { caregiverId, patientId } = body;
      store.links = store.links.filter((l) => l.caregiverId !== caregiverId && (!patientId || l.patientId !== patientId));
      saveSyncStore(store);
      sendJson(res, 200, { success: true, message: 'Unlinked successfully' });
    } catch (e: any) {
      sendJson(res, 500, { success: false, error: e.message });
    }
    return true;
  }

  // 8. GET /api/sync/get-assigned-patient?caregiverId=...
  if (urlPath === '/api/sync/get-assigned-patient' && req.method === 'GET') {
    const cgId = queryParams.get('caregiverId') || '';
    const cgEmail = (queryParams.get('caregiverEmail') || '').toLowerCase();

    const link = store.links.find((l) => (cgId && l.caregiverId === cgId) || (cgEmail && l.caregiverEmail === cgEmail));
    if (!link) {
      sendJson(res, 404, { success: false, error: 'No patient assigned' });
      return true;
    }

    const patient = store.patients.find(
      (p) =>
        p.id === link.patientId ||
        (link.patientEmail && p.email && p.email.toLowerCase() === link.patientEmail.toLowerCase()) ||
        (link.connectionCode && (p.connectionCode === link.connectionCode || p.secondary_language === link.connectionCode)) ||
        ((link.patientId === 'd8a2f3e4-5b6c-7d8e-9f0a-1b2c3d4e5f6a' || link.patientId === '11111111-1111-4000-a000-000000000001') &&
         p.email === 'ramesh@mindsathi.in')
    );
    if (patient) {
      sendJson(res, 200, { success: true, patient, link });
    } else {
      sendJson(res, 404, { success: false, error: 'Assigned patient record not found' });
    }
    return true;
  }

  sendJson(res, 404, { success: false, error: 'Unknown sync endpoint' });
  return true;
}

async function handleBhashiniApiRoute(req: http.IncomingMessage, res: http.ServerResponse): Promise<boolean> {
  const url = req.url?.split('?')[0] || '';
  if (!url.startsWith('/api/bhashini/')) {
    return false;
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    res.end();
    return true;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { success: false, error: 'Method not allowed' });
    return true;
  }

  const { callBhashiniASR, callBhashiniTTS, getBhashiniCredentials } = await import('./bhashiniServerHelper');
  const { inferenceKey, udyatKey } = getBhashiniCredentials();

  if (!inferenceKey && !udyatKey) {
    sendJson(res, 503, {
      success: false,
      error: 'VOICE_SERVICE_NOT_CONFIGURED',
      message: 'Bhashini API keys (BHASHINI_INFERENCE_API_KEY or BHASHINI_UDYAT_KEY) are not configured on the server.',
    });
    return true;
  }

  let body: any = {};
  try {
    body = await parseJsonBody(req);
  } catch {
    sendJson(res, 400, { success: false, error: 'Invalid JSON request body.' });
    return true;
  }

  // 1. Speech-to-Text (ASR)
  if (url === '/api/bhashini/speech-to-text') {
    try {
      const { audioContent, language = 'hi', audioFormat = 'wav' } = body;
      if (!audioContent || typeof audioContent !== 'string') {
        sendJson(res, 400, { success: false, error: 'INVALID_AUDIO_DATA' });
        return true;
      }

      const cleanBase64 = audioContent.includes('base64,')
        ? audioContent.split('base64,')[1]
        : audioContent;

      const text = await callBhashiniASR({
        audioBase64: cleanBase64,
        language,
        audioFormat,
      });

      sendJson(res, 200, { success: true, text, language });
      return true;
    } catch (err: any) {
      if (err.message === 'VOICE_SERVICE_NOT_CONFIGURED') {
        sendJson(res, 503, { success: false, error: err.message });
        return true;
      }
      if (err.message === 'NO_SPEECH_RECOGNIZED') {
        sendJson(res, 200, { success: false, error: 'NO_SPEECH_RECOGNIZED', text: '' });
        return true;
      }
      sendJson(res, 502, { success: false, error: 'BHASHINI_STT_UNAVAILABLE' });
      return true;
    }
  }

  // 2. Text-to-Speech (TTS)
  if (url === '/api/bhashini/text-to-speech') {
    try {
      const { text, language = 'hi', gender = 'female' } = body;
      if (!text || typeof text !== 'string' || !text.trim()) {
        sendJson(res, 400, { success: false, error: 'INVALID_TEXT_INPUT' });
        return true;
      }

      const { audioContent, audioFormat } = await callBhashiniTTS({
        text: text.trim(),
        language,
        gender,
      });

      sendJson(res, 200, { success: true, audioContent, audioFormat, language });
      return true;
    } catch (err: any) {
      if (err.message === 'VOICE_SERVICE_NOT_CONFIGURED') {
        sendJson(res, 503, { success: false, error: err.message });
        return true;
      }
      sendJson(res, 502, { success: false, error: 'BHASHINI_TTS_UNAVAILABLE' });
      return true;
    }
  }

  sendJson(res, 404, { success: false, error: 'Unknown Bhashini endpoint' });
  return true;
}

export function geminiBackendPlugin(): Plugin {
  return {
    name: 'vite-gemini-backend-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const handledBhashini = await handleBhashiniApiRoute(req, res);
        if (handledBhashini) return;
        const handledGemini = await handleGeminiApiRoute(req, res);
        if (handledGemini) return;
        const handledSync = await handleSyncApiRoute(req, res);
        if (handledSync) return;
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const handledBhashini = await handleBhashiniApiRoute(req, res);
        if (handledBhashini) return;
        const handledGemini = await handleGeminiApiRoute(req, res);
        if (handledGemini) return;
        const handledSync = await handleSyncApiRoute(req, res);
        if (handledSync) return;
        next();
      });
    },
  };
}

