import type { VercelRequest, VercelResponse } from '@vercel/node';

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

const DEFAULT_CONFIG_URL = 'https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline';
const DEFAULT_INFERENCE_URL = 'https://dhruva-api.bhashini.gov.in/services/inference/pipeline';

const FALLBACK_ASR_SERVICES: Record<string, string> = {
  as: 'ai4bharat/conformer-multilingual-indo_aryan-gpu--t4',
  hi: 'ai4bharat/conformer-multilingual-indo_aryan-gpu--t4',
  bn: 'ai4bharat/conformer-multilingual-indo_aryan-gpu--t4',
  en: 'ai4bharat/conformer-en-gpu--t4',
};

interface PipelineConfig {
  callbackUrl: string;
  inferenceApiKey: string;
  authHeaderName: string;
  asrServiceId: string;
  asrAudioFormat: string;
  asrSamplingRate: number;
}

const configCache = new Map<string, { config: PipelineConfig; expiresAt: number }>();

function getBhashiniCredentials() {
  return {
    inferenceKey: process.env.BHASHINI_INFERENCE_API_KEY,
    udyatKey: process.env.BHASHINI_UDYAT_KEY,
    userId: process.env.BHASHINI_USER_ID,
    pipelineId: process.env.BHASHINI_PIPELINE_ID,
  };
}

async function getASRConfig(language: string): Promise<PipelineConfig> {
  const now = Date.now();
  const cached = configCache.get(language);
  if (cached && cached.expiresAt > now) {
    return cached.config;
  }

  const { inferenceKey, udyatKey, userId, pipelineId } = getBhashiniCredentials();

  if (udyatKey) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const requestBody: any = {
        pipelineTasks: [
          {
            taskType: 'asr',
            config: {
              language: {
                sourceLanguage: language,
              },
            },
          },
        ],
      };

      if (pipelineId) {
        requestBody.pipelineRequestConfig = { pipelineId };
      }

      const response = await fetch(DEFAULT_CONFIG_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ulcaApiKey: udyatKey,
          ...(userId ? { userID: userId } : {}),
          ...(inferenceKey ? { Authorization: inferenceKey } : {}),
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data: any = await response.json();
        const callbackUrl = data.pipelineInferenceAPIEndPoint?.callbackUrl || DEFAULT_INFERENCE_URL;
        const authHeaderName = data.pipelineInferenceAPIEndPoint?.inferenceApiKey?.name || 'Authorization';
        const authHeaderValue = data.pipelineInferenceAPIEndPoint?.inferenceApiKey?.value || inferenceKey || udyatKey || '';

        let asrServiceId = FALLBACK_ASR_SERVICES[language] || FALLBACK_ASR_SERVICES.hi;
        let asrAudioFormat = 'wav';
        let asrSamplingRate = 16000;

        if (Array.isArray(data.pipelineResponseConfig)) {
          for (const task of data.pipelineResponseConfig) {
            if (task.taskType === 'asr' && Array.isArray(task.config) && task.config[0]) {
              const cfg = task.config[0];
              if (cfg.serviceId) asrServiceId = cfg.serviceId;
              if (cfg.audioFormat) asrAudioFormat = cfg.audioFormat;
              if (cfg.samplingRate) asrSamplingRate = Number(cfg.samplingRate) || 16000;
            }
          }
        }

        const config: PipelineConfig = {
          callbackUrl,
          inferenceApiKey: authHeaderValue,
          authHeaderName,
          asrServiceId,
          asrAudioFormat,
          asrSamplingRate,
        };

        configCache.set(language, { config, expiresAt: now + 30 * 60 * 1000 });
        return config;
      }
    } catch {
      // Fall through to direct fallback
    }
  }

  const directKey = inferenceKey || udyatKey || '';
  const fallbackConfig: PipelineConfig = {
    callbackUrl: DEFAULT_INFERENCE_URL,
    inferenceApiKey: directKey,
    authHeaderName: 'Authorization',
    asrServiceId: FALLBACK_ASR_SERVICES[language] || FALLBACK_ASR_SERVICES.hi,
    asrAudioFormat: 'wav',
    asrSamplingRate: 16000,
  };

  configCache.set(language, { config: fallbackConfig, expiresAt: now + 5 * 60 * 1000 });
  return fallbackConfig;
}

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

    const config = await getASRConfig(language);

    const requestPayload = {
      pipelineTasks: [
        {
          taskType: 'asr',
          config: {
            language: {
              sourceLanguage: language,
            },
            serviceId: config.asrServiceId,
            audioFormat: config.asrAudioFormat || audioFormat || 'wav',
            samplingRate: config.asrSamplingRate || samplingRate || 16000,
          },
        },
      ],
      inputData: {
        audio: [
          {
            audioContent: cleanBase64,
          },
        ],
      },
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const bhashiniRes = await fetch(config.callbackUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [config.authHeaderName]: config.inferenceApiKey,
      },
      body: JSON.stringify(requestPayload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (bhashiniRes.status === 401 || bhashiniRes.status === 403) {
      return res.status(401).json({
        success: false,
        error: 'BHASHINI_AUTH_ERROR',
        safeMessage: ERROR_MESSAGES.BHASHINI_AUTH_ERROR,
      });
    }

    if (!bhashiniRes.ok) {
      return res.status(502).json({
        success: false,
        error: 'BHASHINI_ASR_ERROR',
        safeMessage: ERROR_MESSAGES.BHASHINI_ASR_ERROR,
      });
    }

    const bhashiniData: any = await bhashiniRes.json();
    const taskOutput = bhashiniData.pipelineResponse?.[0]?.output?.[0];
    const recognizedText = (taskOutput?.source || taskOutput?.target || taskOutput?.text || '').trim();

    if (!recognizedText) {
      return res.status(200).json({
        success: true,
        text: '',
        isEmpty: true,
        safeMessage: ERROR_MESSAGES.NO_SPEECH_DETECTED,
      });
    }

    return res.status(200).json({
      success: true,
      text: recognizedText,
      language,
      isEmpty: false,
    });
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return res.status(504).json({
        success: false,
        error: 'TIMEOUT',
        safeMessage: ERROR_MESSAGES.TIMEOUT,
      });
    }

    return res.status(500).json({
      success: false,
      error: 'BHASHINI_ASR_ERROR',
      safeMessage: ERROR_MESSAGES.BHASHINI_ASR_ERROR,
    });
  }
}
