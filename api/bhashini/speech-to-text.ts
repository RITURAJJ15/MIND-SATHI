import type { VercelRequest, VercelResponse } from '@vercel/node';
import { callBhashiniASR, getBhashiniCredentials } from './bhashiniClient';

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
    const { audioContent, language = 'hi', audioFormat = 'wav' } = body;

    if (!audioContent || typeof audioContent !== 'string') {
      return res.status(400).json({ success: false, error: 'INVALID_AUDIO_DATA' });
    }

    // Clean base64 data prefix if present (e.g. data:audio/webm;base64,...)
    const cleanBase64 = audioContent.includes('base64,')
      ? audioContent.split('base64,')[1]
      : audioContent;

    const text = await callBhashiniASR({
      audioBase64: cleanBase64,
      language,
      audioFormat,
    });

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({
      success: true,
      text,
      language,
    });
  } catch (err: any) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const errMessage = err.message || 'STT_FAILED';

    if (errMessage === 'VOICE_SERVICE_NOT_CONFIGURED') {
      return res.status(503).json({ success: false, error: errMessage });
    }

    if (errMessage === 'NO_SPEECH_RECOGNIZED') {
      return res.status(200).json({ success: false, error: 'NO_SPEECH_RECOGNIZED', text: '' });
    }

    return res.status(502).json({
      success: false,
      error: 'BHASHINI_STT_UNAVAILABLE',
    });
  }
}
