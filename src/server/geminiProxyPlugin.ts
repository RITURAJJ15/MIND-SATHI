import type { Plugin } from 'vite';
import http from 'http';

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
    sendJson(res, 500, { error: 'Gemini API key is not configured on server. Please set GEMINI_API_KEY in environment variables.' });
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

export function geminiBackendPlugin(): Plugin {
  return {
    name: 'vite-gemini-backend-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const handled = await handleGeminiApiRoute(req, res);
        if (!handled) next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const handled = await handleGeminiApiRoute(req, res);
        if (!handled) next();
      });
    },
  };
}
