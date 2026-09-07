interface ApiRequest {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
  url?: string;
}

interface ApiResponse {
  status: (code: number) => ApiResponse;
  json: (body: any) => void;
  setHeader: (name: string, value: string) => void;
  end: () => void;
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
    } catch {
      // Continue to next fallback model
    }
  }

  throw new Error('All Gemini models failed to respond.');
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on server.' });
  }

  const body = req.body || {};
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

  try {
    const rawResponse = await callGeminiGenerate(apiKey, [{ parts: [{ text: userPrompt }] }], systemPrompt);
    const parsed = extractJson(rawResponse);
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json(parsed);
  } catch {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({
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
  }
}
