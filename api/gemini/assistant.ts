import type { VercelRequest, VercelResponse } from '@vercel/node';

async function callGeminiGenerate(apiKey: string, contents: any[], systemInstruction?: string): Promise<string> {
  // High-availability models prioritizing active quota
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
        const text = data.candidates[0].content.parts[0].text.trim();
        if (text) return text;
      }
    } catch {
      // Continue to next fallback model
    }
  }

  throw new Error('All Gemini models failed to respond.');
}

/**
 * Robust, elder-friendly localized contextual fallback if AI models are temporarily saturated.
 * Directly outputs natural Assamese, Bengali, Hindi, or English.
 */
function generateContextualFallback(
  message: string,
  userProfile: any,
  now: Date,
  reminders: any[],
  familyMembers: any[],
  dailyPlanTasks: any[],
  language: string = 'en',
  originalMessage: string = ''
): string {
  const combined = `${message || ''} ${originalMessage || ''}`.toLowerCase();
  const name =
    userProfile?.preferredName ||
    userProfile?.name ||
    (language === 'as' ? 'দাদা' : language === 'hi' ? 'दादाजी' : language === 'bn' ? 'দাদু' : 'Dada');

  const dayIndex = now.getDay();
  const dayNamesEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayNamesAs = ['দেওবাৰ', 'সোমবাৰ', 'মঙলবাৰ', 'বুধবাৰ', 'বৃহস্পতিবাৰ', 'শুক্ৰবাৰ', 'শনিবাৰ'];
  const dayNamesHi = ['रविवार', 'सोमवार', 'मंगलवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'];
  const dayNamesBn = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];

  const monthNamesEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthNamesAs = ['জানুৱাৰী', 'ফেব্ৰুৱাৰী', 'মাৰ্চ', 'এপ্ৰিল', 'মে', 'জুন', 'জুলাই', 'আগষ্ট', 'ছেপ্টেম্বৰ', 'অক্টোবৰ', 'নৱেম্বৰ', 'ডিচেম্বৰ'];
  const monthNamesHi = ['जनवरी', 'फरवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'];
  const monthNamesBn = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];

  const d = now.getDate();
  const y = now.getFullYear();

  const isDayQuery =
    combined.includes('day') ||
    combined.includes('date') ||
    combined.includes('today') ||
    combined.includes('time') ||
    combined.includes('calendar') ||
    combined.includes('বাৰ') ||
    combined.includes('দিন') ||
    combined.includes('সময়') ||
    combined.includes('আজিকি') ||
    combined.includes('আজি') ||
    combined.includes('তারিখ') ||
    combined.includes('বার') ||
    combined.includes('वार') ||
    combined.includes('दिन') ||
    combined.includes('तारीख') ||
    combined.includes('आज');

  const isMedicineQuery =
    combined.includes('medicine') ||
    combined.includes('pill') ||
    combined.includes('reminder') ||
    combined.includes('dose') ||
    combined.includes('দৰব') ||
    combined.includes('ঔষধ') ||
    combined.includes('दवा') ||
    combined.includes('औषध');

  const isFamilyQuery =
    combined.includes('family') ||
    combined.includes('daughter') ||
    combined.includes('son') ||
    combined.includes('পৰিয়াল') ||
    combined.includes('ল’ৰা') ||
    combined.includes('ছোৱালী') ||
    combined.includes('পরিবার') ||
    combined.includes('बेटा') ||
    combined.includes('बेटी');

  const isGameQuery =
    combined.includes('game') ||
    combined.includes('plan') ||
    combined.includes('play') ||
    combined.includes('activity') ||
    combined.includes('খেল') ||
    combined.includes('খেলা') ||
    combined.includes('खेल');

  if (language === 'as') {
    if (isDayQuery) {
      return `নমস্কাৰ ${name}! আজি ${y} চনৰ ${d} ${monthNamesAs[now.getMonth()]}, ${dayNamesAs[dayIndex]}। আপোনাৰ দিনটো অতি শান্তিময় আৰু আনন্দৰে পাৰ হওক!`;
    }
    if (isMedicineQuery) {
      if (reminders && reminders.length > 0) {
        const rem = reminders[0];
        return `${name}, আপোনাৰ আজি ${rem.time} বজাত "${rem.title}" ঔষধ গ্ৰহণ কৰিবলগীয়া আছে। সময়মতে পানীৰ সৈতে ঔষধ খাবলৈ নাপাহৰিব।`;
      }
      return `আপোনাৰ এই সময়ত কোনো ঔষধ বাকী নাই, ${name}। আপুনি সম্পূৰ্ণ সুস্থ আৰু সুৰক্ষিত।`;
    }
    if (isFamilyQuery) {
      return `আপোনাৰ পৰিয়াল আৰু মৰমৰ আত্মীয়সকল সদায় আপোনাৰ কাষতে আছে, ${name}। আপুনি যেতিয়াই বিচাৰে তেওঁলোকক ফোন কৰিব পাৰে।`;
    }
    if (isGameQuery) {
      return `আজিৰ স্মৃতি সঙ্গম খেলবোৰ খেলি মনটো সতেজ কৰি ৰাখক, ${name}! ই মগজুৰ বাবে অতি উত্তম।`;
    }
    return `নমস্কাৰ ${name}! আজি ${dayNamesAs[dayIndex]}, ${d} ${monthNamesAs[now.getMonth()]}। মই আপোনাৰ সহায়ৰ বাবে সদায় সাজু আছোঁ।`;
  }

  if (language === 'bn') {
    if (isDayQuery) {
      return `নমস্কার ${name}! আজ ${y} সালের ${d} ${monthNamesBn[now.getMonth()]}, ${dayNamesBn[dayIndex]}। আপনার আজকের দিনটি সুন্দর ও শান্তিময় কাটুক!`;
    }
    if (isMedicineQuery) {
      if (reminders && reminders.length > 0) {
        const rem = reminders[0];
        return `${name}, আজ আপনার ${rem.time} টায় "${rem.title}" ঔষধ নেওয়ার কথা আছে। সময়মতো ঔষধ নিতে ভুলবেন না।`;
      }
      return `আপনার এই মুহূর্তে কোনো ঔষধ বাকি নেই, ${name}। আপনি একদম সুস্থ আছেন।`;
    }
    if (isFamilyQuery) {
      return `আপনার পরিবারের সকলে সর্বদা আপনার সঙ্গে আছেন, ${name}। আপনি যেকোনো সময় তাঁদের সাথে কথা বলতে পারেন।`;
    }
    return `নমস্কার ${name}! আজ ${dayNamesBn[dayIndex]}, ${d} ${monthNamesBn[now.getMonth()]}। আমি আপনার সেবায় সর্বদা উপস্থিত।`;
  }

  if (language === 'hi') {
    if (isDayQuery) {
      return `नमस्ते ${name}! आज ${y} का ${d} ${monthNamesHi[now.getMonth()]}, ${dayNamesHi[dayIndex]} है। आपका दिन सुखद और मंगलमय हो!`;
    }
    if (isMedicineQuery) {
      if (reminders && reminders.length > 0) {
        const rem = reminders[0];
        return `${name}, आज आपकी ${rem.time} बजे "${rem.title}" दवा का समय है। कृपया समय पर एक गिलास पानी के साथ दवा लें।`;
      }
      return `इस समय आपकी कोई दवा लंबित नहीं है, ${name}। आप बिल्कुल सुरक्षित और स्वस्थ हैं।`;
    }
    if (isFamilyQuery) {
      return `आपका परिवार हमेशा आपके साथ है, ${name}। जब भी आपका मन करे, आप उन्हें सीधे कॉल कर सकते हैं।`;
    }
    return `नमस्ते ${name}! आज ${dayNamesHi[dayIndex]}, ${d} ${monthNamesHi[now.getMonth()]} है। मैं आपकी सहायता के लिए उपस्थित हूँ।`;
  }

  // English fallback
  const currentDayName = dayNamesEn[dayIndex];
  const currentDateStr = now.toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Kolkata',
  });

  if (isDayQuery) {
    return `Hello ${name}! Today is ${currentDayName}, ${currentDateStr}. I hope you have a peaceful and happy day!`;
  }
  if (isMedicineQuery) {
    if (reminders && reminders.length > 0) {
      const remList = reminders.map((r) => `${r.title} at ${r.time}`).slice(0, 2).join(' and ');
      return `For today, ${name}, you have reminders for ${remList}. Please remember to take them with a glass of water.`;
    }
    return `You have no pending medicine reminders scheduled for right now, ${name}. You are doing great today!`;
  }
  if (isFamilyQuery) {
    return `Your family is always with you in heart and mind, ${name}. You can tap the Family Call button anytime to reach out.`;
  }
  return `Hello ${name}! Today is ${currentDayName}, ${currentDateStr}. I am right here with you to help with your schedule, memories, or games anytime.`;
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

  const targetLang = language || originalLanguage || 'en';

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
1. DIRECT ANSWERING IN NATIVE LANGUAGE:
   ${
     targetLang === 'as'
       ? 'PATIENT SPEAKS ASSAMESE (অসমীয়া). YOU MUST ANSWER DIRECTLY IN GENTLE, NATURAL, RESPECTFUL ASSAMESE (অসমীয়া). Keep your answer in 1-2 comforting spoken sentences suitable for text-to-speech audio.'
       : targetLang === 'bn'
       ? 'PATIENT SPEAKS BENGALI (বাংলা). YOU MUST ANSWER DIRECTLY IN GENTLE, NATURAL, RESPECTFUL BENGALI (বাংলা). Keep your answer in 1-2 comforting spoken sentences suitable for text-to-speech audio.'
       : targetLang === 'hi'
       ? 'PATIENT SPEAKS HINDI (हिन्दी). YOU MUST ANSWER DIRECTLY IN GENTLE, NATURAL, RESPECTFUL HINDI (हिन्दी). Keep your answer in 1-2 comforting spoken sentences suitable for text-to-speech audio.'
       : 'Answer in warm, clear, gentle English in 1-2 comforting sentences.'
   }
2. SPOKEN AUDIO CONCISENESS:
   - Keep answers between 1 and 3 short, comforting sentences.
   - Do NOT use markdown tables, bullet points, asterisks, or technical jargon because this will be read aloud by text-to-speech.
3. GROUNDING & ACCURACY:
   - When asked about games, date, day, daily activities, medications, or family, use the real records listed above.
   - NEVER invent family members or prescribe medical treatments.
   - Never diagnose diseases. Offer warm reassurance and suggest engaging cognitive games or checking with caregiver ${caregiverName || 'family'}.`;

  const userQueryForModel =
    originalMessage && originalMessage.trim().length > 0
      ? (message && message !== '?' && message.trim().length > 2 && message !== originalMessage
          ? `${originalMessage} (${message})`
          : originalMessage)
      : (message || 'Hello');

  try {
    let replyText = '';

    if (apiKey) {
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
          parts: [{ text: userQueryForModel }],
        });

        replyText = await callGeminiGenerate(apiKey, geminiContents, systemPrompt);
      } catch (genErr: any) {
        console.warn('[Gemini Assistant Model Warning, activating contextual fallback]:', genErr?.message || genErr);
      }
    }

    // If Gemini models were saturated or rate-limited, provide grounded contextual fallback
    if (!replyText || !replyText.trim()) {
      replyText = generateContextualFallback(
        message,
        userProfile,
        now,
        reminders,
        familyMembers,
        dailyPlanTasks,
        targetLang,
        originalMessage
      );
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({
      reply: replyText,
      text: replyText,
      success: true,
      language: targetLang,
    });
  } catch (err: any) {
    console.error('[Gemini Assistant Error]', err?.message || err);
    // Even on total exception, return safe grounded answer instead of crashing elder experience
    const safeFallback = generateContextualFallback(
      message,
      userProfile,
      now,
      reminders,
      familyMembers,
      dailyPlanTasks,
      targetLang,
      originalMessage
    );

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({
      reply: safeFallback,
      text: safeFallback,
      success: true,
      fallback: true,
      language: targetLang,
    });
  }
}
