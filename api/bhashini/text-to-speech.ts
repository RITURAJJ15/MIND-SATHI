import type { VercelRequest, VercelResponse } from '@vercel/node';

const ERROR_MESSAGES: Record<string, string> = {
  EMPTY_TEXT: 'No text was provided for speech synthesis.',
  BHASHINI_AUTH_ERROR: 'Voice service authentication failed. Please check the BHASHINI configuration.',
  BHASHINI_CONFIG_ERROR: 'The selected language voice service is not configured.',
  BHASHINI_TTS_ERROR: 'MIND SATHI prepared the answer but could not play the voice response.',
  TIMEOUT: 'The voice service took too long to respond. Please try again.',
};

const DEFAULT_CONFIG_URL = 'https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline';
const DEFAULT_INFERENCE_URL = 'https://dhruva-api.bhashini.gov.in/services/inference/pipeline';

const FALLBACK_TTS_SERVICES: Record<string, string> = {
  as: 'ai4bharat/indic-tts-coqui-indo_aryan-gpu--t4',
  hi: 'ai4bharat/indic-tts-coqui-indo_aryan-gpu--t4',
  bn: 'ai4bharat/indic-tts-coqui-indo_aryan-gpu--t4',
  en: 'ai4bharat/indic-tts-coqui-misc-gpu--t4',
};

interface PipelineConfig {
  callbackUrl: string;
  inferenceApiKey: string;
  authHeaderName: string;
  ttsServiceId: string;
  ttsAudioFormat: string;
  ttsSamplingRate: number;
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

async function getTTSConfig(language: string): Promise<PipelineConfig> {
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
            taskType: 'tts',
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

        let ttsServiceId = FALLBACK_TTS_SERVICES[language] || FALLBACK_TTS_SERVICES.hi;
        let ttsAudioFormat = 'wav';
        let ttsSamplingRate = 22050;

        if (Array.isArray(data.pipelineResponseConfig)) {
          for (const task of data.pipelineResponseConfig) {
            if (task.taskType === 'tts' && Array.isArray(task.config) && task.config[0]) {
              const cfg = task.config[0];
              if (cfg.serviceId) ttsServiceId = cfg.serviceId;
              if (cfg.audioFormat) ttsAudioFormat = cfg.audioFormat;
              if (cfg.samplingRate) ttsSamplingRate = Number(cfg.samplingRate) || 22050;
            }
          }
        }

        const config: PipelineConfig = {
          callbackUrl,
          inferenceApiKey: authHeaderValue,
          authHeaderName,
          ttsServiceId,
          ttsAudioFormat,
          ttsSamplingRate,
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
    ttsServiceId: FALLBACK_TTS_SERVICES[language] || FALLBACK_TTS_SERVICES.hi,
    ttsAudioFormat: 'wav',
    ttsSamplingRate: 22050,
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
    const { text, language = 'as', gender = 'female' } = body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({
        success: false,
        error: 'EMPTY_TEXT',
        safeMessage: ERROR_MESSAGES.EMPTY_TEXT,
      });
    }

    const config = await getTTSConfig(language);

    const requestPayload = {
      pipelineTasks: [
        {
          taskType: 'tts',
          config: {
            language: {
              sourceLanguage: language,
            },
            serviceId: config.ttsServiceId,
            gender,
            samplingRate: config.ttsSamplingRate || 22050,
          },
        },
      ],
      inputData: {
        input: [
          {
            source: text.trim(),
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
        error: 'BHASHINI_TTS_ERROR',
        safeMessage: ERROR_MESSAGES.BHASHINI_TTS_ERROR,
      });
    }

    const bhashiniData: any = await bhashiniRes.json();
    const audioObj = bhashiniData.pipelineResponse?.[0]?.audio?.[0];
    const audioContent = audioObj?.audioContent || '';
    const audioFormat =
      bhashiniData.pipelineResponse?.[0]?.config?.audioFormat ||
      config.ttsAudioFormat ||
      'wav';

    if (!audioContent) {
      return res.status(502).json({
        success: false,
        error: 'BHASHINI_TTS_ERROR',
        safeMessage: ERROR_MESSAGES.BHASHINI_TTS_ERROR,
      });
    }

    return res.status(200).json({
      success: true,
      audioContent,
      audioFormat,
      language,
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
      error: 'BHASHINI_TTS_ERROR',
      safeMessage: ERROR_MESSAGES.BHASHINI_TTS_ERROR,
    });
  }
}
