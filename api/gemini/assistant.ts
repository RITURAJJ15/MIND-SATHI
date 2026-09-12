import type { VercelRequest, VercelResponse } from '@vercel/node';

async function callGeminiGenerate(apiKey: string, contents: any[], systemInstruction?: string): Promise<string> {
  const models = ['gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-2.0-flash'];

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
        const text = data.candidates[0].content.parts[0].text.trim();
        if (text) return text;
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
    message,
    originalLanguage = 'en',
    originalMessage = '',
    history = [],
    userProfile,
    familyMembers = [],
    reminders = [],
    dailyPlanTasks = [],
    caregiverName = '',
    language = 'en',
  } = body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Empty message received.' });
  }

  const familySummary =
    familyMembers
      .map(
        (f: any) =>
          `- ${f.name} (${f.relationship?.en || f.relationship || 'Family'}): Phone ${f.phone || 'N/A'}${
            f.isFavorite ? ' [Favorite]' : ''
          }`
      )
      .join('\n') || 'None recorded yet.';

  const reminderSummary =
    reminders
      .map(
        (r: any) =>
          `- ${r.title} at ${r.time} (${r.dosageOrDetail || r.type || 'medication'}${
            r.isCompletedToday ? ' - completed' : ' - pending'
          })`
      )
      .join('\n') || 'No reminders scheduled.';

  const planSummary =
    dailyPlanTasks
      .map((t: any) => `- ${t.title}: ${t.completed ? 'Completed' : 'Pending'}`)
      .join('\n') || 'No specific daily plan tasks.';

  const now = new Date();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const currentDayName = dayNames[now.getDay()];
  const currentDateStr = now.toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Kolkata',
  });

  const systemPrompt = `You are MIND SATHI (মাইণ্ড সাৰথি / माइंड साथी / মাইন্ড সাথী), a compassionate, respectful, and culturally attuned cognitive wellness companion for an elderly person in India.
The patient's name is ${userProfile?.name || 'Dada'} (preferred: ${userProfile?.preferredName || 'Dada'}).
Age: ${userProfile?.age || 72}, City: ${userProfile?.city || 'Guwahati'}, State: ${userProfile?.state || 'Assam'}.
Assigned Caregiver: ${caregiverName || 'Family Caregiver'}.
Today's Calendar Day: ${currentDayName} (${currentDateStr}).

GROUNDING CONTEXT (PATIENT'S VERIFIED SUPABASE DATA):
=====================================================
Current Day & Date: ${currentDayName}, ${currentDateStr}
Family Members:
${familySummary}

Today's Reminders & Medications:
${reminderSummary}

Today's Cognitive Activity & Daily Plan:
${planSummary}

Ayushman Bharat PM-JAY Status: ${
    userProfile?.isAyushmanMember
      ? 'Enrolled (ABHA: ' + (userProfile?.abhaId || 'Active') + ')'
      : 'Not enrolled'
  }
=====================================================

CRITICAL CONVERSATIONAL RULES:
1. DIRECT ANSWERING: Answer the patient's actual question directly, warmly, and helpfully.
   ${
     originalLanguage !== 'en'
       ? `PATIENT'S NATIVE LANGUAGE: ${originalLanguage}\nPATIENT'S ORIGINAL SPEECH: "${originalMessage || message}"\nTRANSLATED QUESTION: "${message}"\nAnswer in clear, natural, warm English. Your English reply will be immediately translated to ${originalLanguage} via Bhashini NMT and spoken aloud by Bhashini TTS.`
       : `Answer in warm, clear, gentle English.`
   }
2. SPOKEN AUDIO CONCISENESS:
   - Keep answers between 2 and 4 short, comforting sentences.
   - Do NOT use markdown tables, bullet points, asterisks, or jargon because this will be read aloud.
3. GROUNDING & ACCURACY:
   - When asked about games, daily activities, medications, or family, use the real records listed above.
   - NEVER invent family members or prescribe medical treatments.
   - Never diagnose diseases. Offer warm reassurance and suggest engaging cognitive games or checking with caregiver ${caregiverName || 'family'}.`;

  try {
    const geminiContents: any[] = [];
    for (const h of history.slice(-6)) {
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

    if (!replyText || !replyText.trim()) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(502).json({
        error: 'GEMINI_EMPTY_RESPONSE',
        message: 'Gemini returned an empty response.',
      });
    }

    // Safe server logging per Section 15
    console.log('[Gemini Assistant Success]', {
      messageLength: message.length,
      replyLength: replyText.length,
      language,
      originalLanguage,
    });

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({
      reply: replyText,
      text: replyText,
      success: true,
    });
  } catch (err: any) {
    console.error('[Gemini Assistant Error]', err?.message || err);
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(502).json({
      error: 'GEMINI_ERROR',
      message: 'Failed to generate AI response.',
    });
  }
}
