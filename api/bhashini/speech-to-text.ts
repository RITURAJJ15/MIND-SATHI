import type { VercelRequest, VercelResponse } from '@vercel/node';
import { callBhashiniASR, getBhashiniCredentials } from './bhashiniClient';

const ERROR_MESSAGES: Record<string, string> = {
  MIC_PERMISSION_DENIED: 'Microphone permission was denied. Please allow microphone access and try again.',
  EMPTY_RECORDING: 'No voice was detected. Please speak clearly and try again.',
  BHASHINI_AUTH_ERROR: 'Voice service authentication failed. Please check the BHASHINI configuration.',
  BHASHINI_CONFIG_ERROR: 'The selected language voice service is not configured.',
  BHASHINI_ASR_ERROR: 'Voice recognition is temporarily unavailable.',
  GEMINI_ERROR: 'MIND SATHI could not prepare a response. Please try again.',
  BHASHINI_TTS_ERROR: 'MIND SATHI prepared the answer but could not play the voice response.',
  NETWORK_ERROR: 'Please check your internet connection and try again.',
  TIMEOUT: 'The voice service took too long to respond. Please try again.',
  NO_SPEECH_DETECTED: 'No speech was detected. Please tap the microphone and speak again.',
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
    const { audioContent, language = 'as', audioFormat = 'wav', samplingRate = 16000 } = body;

    if (!audioContent || typeof audioContent !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'EMPTY_RECORDING',
        safeMessage: ERROR_MESSAGES.EMPTY_RECORDING,
      });
    }

    // Clean base64 data prefix if present (e.g. data:audio/wav;base64,...)
    const cleanBase64 = audioContent.includes('base64,')
      ? audioContent.split('base64,')[1]
      : audioContent;

    if (cleanBase64.length < 500) {
      return res.status(200).json({
        success: true,
        text: '',
        isEmpty: true,
        safeMessage: ERROR_MESSAGES.NO_SPEECH_DETECTED,
      });
    }

    // Safe diagnostic log (no secrets or raw audio)
    console.log(`[Bhashini ASR Request] lang=${language}, format=${audioFormat}, rate=${samplingRate}, sizeBytes=${cleanBase64.length}`);

    const result = await callBhashiniASR({
      audioBase64: cleanBase64,
      language,
      audioFormat,
      samplingRate,
    });

    console.log(`[Bhashini ASR Success] lang=${language}, bhashiniStatus=${result.bhashiniStatus}, textLength=${result.text.length}`);

    res.setHeader('Access-Control-Allow-Origin', '*');

    if (!result.text || !result.text.trim()) {
      return res.status(200).json({
        success: true,
        text: '',
        isEmpty: true,
        safeMessage: ERROR_MESSAGES.NO_SPEECH_DETECTED,
        language,
      });
    }

    return res.status(200).json({
      success: true,
      text: result.text.trim(),
      isEmpty: false,
      language,
      diagnostics: {
        samplingRate,
        audioFormat,
        bhashiniStatus: result.bhashiniStatus,
        sizeBytes: cleanBase64.length,
      },
    });
  } catch (err: any) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const errorCode = err.message || 'BHASHINI_ASR_ERROR';
    const safeMessage = ERROR_MESSAGES[errorCode] || ERROR_MESSAGES.BHASHINI_ASR_ERROR;

    console.warn(`[Bhashini ASR Error] code=${errorCode}, message=${safeMessage}`);

    const statusCode = errorCode === 'BHASHINI_AUTH_ERROR' ? 503 : errorCode === 'TIMEOUT' ? 504 : 502;
    return res.status(statusCode).json({
      success: false,
      error: errorCode,
      safeMessage,
    });
  }
}
