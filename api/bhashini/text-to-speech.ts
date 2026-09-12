import type { VercelRequest, VercelResponse } from '@vercel/node';
import { callBhashiniTTS, getBhashiniCredentials } from './bhashiniClient';

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
      error: 'VOICE_SERVICE_NOT_CONFIGURED',
      message: 'Bhashini API keys (BHASHINI_INFERENCE_API_KEY or BHASHINI_UDYAT_KEY) are not configured on the server.',
    });
  }

  try {
    const body = req.body || {};
    const { text, language = 'hi', gender = 'female' } = body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ success: false, error: 'INVALID_TEXT_INPUT' });
    }

    const { audioContent, audioFormat } = await callBhashiniTTS({
      text: text.trim(),
      language,
      gender,
    });

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({
      success: true,
      audioContent,
      audioFormat,
      language,
    });
  } catch (err: any) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const errMessage = err.message || 'TTS_FAILED';

    if (errMessage === 'VOICE_SERVICE_NOT_CONFIGURED') {
      return res.status(503).json({ success: false, error: errMessage });
    }

    return res.status(502).json({
      success: false,
      error: 'BHASHINI_TTS_UNAVAILABLE',
    });
  }
}
