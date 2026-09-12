import type { VercelRequest, VercelResponse } from '@vercel/node';
import { callBhashiniTTS, getBhashiniCredentials } from './bhashiniClient';

const ERROR_MESSAGES: Record<string, string> = {
  BHASHINI_AUTH_ERROR: 'Voice service authentication failed. Please check the BHASHINI configuration.',
  BHASHINI_CONFIG_ERROR: 'The selected language voice service is not configured.',
  BHASHINI_TTS_ERROR: 'MIND SATHI prepared the answer but could not play the voice response.',
  TIMEOUT: 'The voice service took too long to respond. Please try again.',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { inferenceKey, udyatKey } = getBhashiniCredentials();
  if (!inferenceKey && !udyatKey) {
    return res.status(503).json({
      success: false,
      error: 'BHASHINI_AUTH_ERROR',
      safeMessage: ERROR_MESSAGES.BHASHINI_AUTH_ERROR,
    });
  }

  try {
    const body = req.body || {};
    const { text, language = 'as', gender = 'female' } = body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ success: false, error: 'INVALID_TEXT_INPUT' });
    }

    console.log(`[Bhashini TTS Request] lang=${language}, gender=${gender}, textLen=${text.length}`);

    const result = await callBhashiniTTS({
      text: text.trim(),
      language,
      gender,
    });

    console.log(`[Bhashini TTS Success] lang=${language}, bhashiniStatus=${result.bhashiniStatus}, audioFormat=${result.audioFormat}`);

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({
      success: true,
      audioContent: result.audioContent,
      audioFormat: result.audioFormat,
      language,
    });
  } catch (err: any) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const errorCode = err.message || 'BHASHINI_TTS_ERROR';
    const safeMessage = ERROR_MESSAGES[errorCode] || ERROR_MESSAGES.BHASHINI_TTS_ERROR;

    console.warn(`[Bhashini TTS Error] code=${errorCode}, message=${safeMessage}`);

    const statusCode = errorCode === 'BHASHINI_AUTH_ERROR' ? 503 : errorCode === 'TIMEOUT' ? 504 : 502;
    return res.status(statusCode).json({
      success: false,
      error: errorCode,
      safeMessage,
    });
  }
}
