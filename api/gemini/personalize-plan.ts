import type { VercelRequest, VercelResponse } from '@vercel/node';

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
  const models = [
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.7-flash',
    'gemini-flash-lite-latest',
    'gemini-3.6-flash',
  ];

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
    } catch {
      // Continue to next fallback model
    }
  }

  throw new Error('All Gemini models failed to respond.');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const FALLBACK_KEY_B64 = 'QVEuQWI4Uk42TFVqTXQwczRpMzBIM1h6TUM3ODBJVnNoMU15ZHQ1V2pVVkpSZ3NfRWtkNmc=';
  const apiKey =
    process.env.GEMINI_API_KEY ||
    Buffer.from(FALLBACK_KEY_B64, 'base64').toString('utf-8');

  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on server.' });
  }

  const body = req.body || {};
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
  "difficulty": "saral", // or "madhyam" or "nipun"
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

  try {
    const rawResponse = await callGeminiGenerate(apiKey, [{ parts: [{ text: userPrompt }] }], systemPrompt);
    const parsed = extractJson(rawResponse);
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json(parsed);
  } catch (err: any) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({
      day: dayOfWeek,
      focusArea: baselineFocus,
      difficulty: 'saral',
      estimatedDuration: 15,
      recommendedGames: baselineGames,
      reason: language === 'hi'
        ? 'आज की दिनचर्या आपकी स्मृति और मानसिक सजगता को प्रोत्साहित करने के लिए तैयार की गई है।'
        : "Today's activities are tailored to support your cognitive vitality and daily routine.",
    });
  }
}
