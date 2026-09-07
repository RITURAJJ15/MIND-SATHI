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
  const {
    message,
    history = [],
    userProfile,
    familyMembers = [],
    reminders = [],
    dailyPlanTasks = [],
    caregiverName = '',
    language = 'en',
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

  try {
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
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({ reply: replyText });
  } catch (err: any) {
    const fallbackReplies: Record<string, string> = {
      as: 'নমস্কাৰ! 🙏 মই আপোনাৰ মাইণ্ড সাৰথি AI। মই আপোনাৰ লগত আছোঁ। আপোনাৰ পৰিয়াল, দৰব বা খেলৰ বিষয়ে কিবা জানিব বিচাৰে নেকি?',
      bn: 'নমস্কার! 🙏 আমি আপনার মাইন্ড সাথী AI। আমি আপনার সাথেই আছি। আপনার পরিবার, ওষুধ বা খেলা সম্পর্কে কিছু জানতে চান?',
      hi: 'नमस्ते! 🙏 मैं आपका माइंड साथी AI हूँ। मैं आपके साथ हूँ। आज मैं आपकी दवाओं, परिवार या दिमागी खेल में क्या सहायता करूँ?',
      en: 'Namaste! 🙏 I am your MIND SATHI AI companion. I am right here with you. How may I help you with your memories, reminders, or cognitive games today?',
    };
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({
      reply: fallbackReplies[language] || fallbackReplies.en,
    });
  }
}
