/**
 * src/server/bhashiniServerHelper.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Isolated server-side helper for Bhashini ULCA / Dhruva Speech Services.
 * Reads BHASHINI_INFERENCE_API_KEY and/or BHASHINI_UDYAT_KEY from process.env.
 * NEVER exposes keys to client-side code, logs, or error responses.
 */

export interface BhashiniPipelineConfig {
  callbackUrl: string;
  inferenceApiKey: string;
  authHeaderName: string;
  asrServiceId: string;
  asrAudioFormat: string;
  asrSamplingRate: number;
  ttsServiceId: string;
  ttsAudioFormat: string;
  ttsSamplingRate: number;
}

const DEFAULT_CONFIG_URL = 'https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline';
const DEFAULT_INFERENCE_URL = 'https://dhruva-api.bhashini.gov.in/services/inference/pipeline';

// Official AI4Bharat / Bhashini Standard Service IDs by language
const FALLBACK_ASR_SERVICES: Record<string, string> = {
  as: 'ai4bharat/conformer-multilingual-indo_aryan-gpu--t4',
  hi: 'ai4bharat/conformer-multilingual-indo_aryan-gpu--t4',
  bn: 'ai4bharat/conformer-multilingual-indo_aryan-gpu--t4',
  en: 'ai4bharat/conformer-en-gpu--t4',
};

const FALLBACK_TTS_SERVICES: Record<string, string> = {
  as: 'ai4bharat/indic-tts-coqui-indo_aryan-gpu--t4',
  hi: 'ai4bharat/indic-tts-coqui-indo_aryan-gpu--t4',
  bn: 'ai4bharat/indic-tts-coqui-indo_aryan-gpu--t4',
  en: 'ai4bharat/indic-tts-coqui-misc-gpu--t4',
};

// In-memory per-language config cache (30 minute TTL)
const pipelineConfigCache = new Map<string, { config: BhashiniPipelineConfig; expiresAt: number }>();

/**
 * Validates availability of Bhashini API credentials
 */
export function getBhashiniCredentials(): {
  inferenceKey?: string;
  udyatKey?: string;
  userId?: string;
  pipelineId?: string;
} {
  return {
    inferenceKey: process.env.BHASHINI_INFERENCE_API_KEY,
    udyatKey: process.env.BHASHINI_UDYAT_KEY,
    userId: process.env.BHASHINI_USER_ID,
    pipelineId: process.env.BHASHINI_PIPELINE_ID,
  };
}

/**
 * Resolves official Bhashini pipeline configuration for the specified language.
 * Dynamically queries getModelsPipeline using BHASHINI_UDYAT_KEY and caches results.
 */
export async function getPipelineConfigForLanguage(language: string): Promise<BhashiniPipelineConfig> {
  const { inferenceKey, udyatKey, userId, pipelineId } = getBhashiniCredentials();

  if (!inferenceKey && !udyatKey) {
    throw new Error('BHASHINI_AUTH_ERROR');
  }

  const now = Date.now();
  const cached = pipelineConfigCache.get(language);
  if (cached && cached.expiresAt > now) {
    return cached.config;
  }

  // 1. Dynamic pipeline discovery via ULCA API if Udyat key is available
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
        const data = await response.json();
        const callbackUrl = data.pipelineInferenceAPIEndPoint?.callbackUrl || DEFAULT_INFERENCE_URL;
        const authHeaderName = data.pipelineInferenceAPIEndPoint?.inferenceApiKey?.name || 'Authorization';
        const authHeaderValue = data.pipelineInferenceAPIEndPoint?.inferenceApiKey?.value || inferenceKey || udyatKey || '';

        let asrServiceId = FALLBACK_ASR_SERVICES[language] || FALLBACK_ASR_SERVICES.hi;
        let asrAudioFormat = 'wav';
        let asrSamplingRate = 16000;

        let ttsServiceId = FALLBACK_TTS_SERVICES[language] || FALLBACK_TTS_SERVICES.hi;
        let ttsAudioFormat = 'wav';
        let ttsSamplingRate = 22050;

        if (Array.isArray(data.pipelineResponseConfig)) {
          for (const task of data.pipelineResponseConfig) {
            if (task.taskType === 'asr' && Array.isArray(task.config) && task.config[0]) {
              const cfg = task.config[0];
              if (cfg.serviceId) asrServiceId = cfg.serviceId;
              if (cfg.audioFormat) asrAudioFormat = cfg.audioFormat;
              if (cfg.samplingRate) asrSamplingRate = Number(cfg.samplingRate) || 16000;
            } else if (task.taskType === 'tts' && Array.isArray(task.config) && task.config[0]) {
              const cfg = task.config[0];
              if (cfg.serviceId) ttsServiceId = cfg.serviceId;
              if (cfg.audioFormat) ttsAudioFormat = cfg.audioFormat;
              if (cfg.samplingRate) ttsSamplingRate = Number(cfg.samplingRate) || 22050;
            }
          }
        }

        const config: BhashiniPipelineConfig = {
          callbackUrl,
          inferenceApiKey: authHeaderValue,
          authHeaderName,
          asrServiceId,
          asrAudioFormat,
          asrSamplingRate,
          ttsServiceId,
          ttsAudioFormat,
          ttsSamplingRate,
        };

        pipelineConfigCache.set(language, { config, expiresAt: now + 30 * 60 * 1000 });
        return config;
      }
    } catch {
      // Fall through to direct inference configuration
    }
  }

  // 2. Direct Dhruva inference configuration fallback
  const directKey = inferenceKey || udyatKey || '';
  const fallbackConfig: BhashiniPipelineConfig = {
    callbackUrl: DEFAULT_INFERENCE_URL,
    inferenceApiKey: directKey,
    authHeaderName: 'Authorization',
    asrServiceId: FALLBACK_ASR_SERVICES[language] || FALLBACK_ASR_SERVICES.hi,
    asrAudioFormat: 'wav',
    asrSamplingRate: 16000,
    ttsServiceId: FALLBACK_TTS_SERVICES[language] || FALLBACK_TTS_SERVICES.hi,
    ttsAudioFormat: 'wav',
    ttsSamplingRate: 22050,
  };

  pipelineConfigCache.set(language, { config: fallbackConfig, expiresAt: now + 5 * 60 * 1000 });
  return fallbackConfig;
}

/**
 * Calls Bhashini ASR (Speech-to-Text) inference with verified audio configuration.
 */
export async function callBhashiniASR(params: {
  audioBase64: string;
  language: string;
  audioFormat?: string;
  samplingRate?: number;
}): Promise<{ text: string; bhashiniStatus: number }> {
  const { audioBase64, language } = params;
  const config = await getPipelineConfigForLanguage(language);

  const requestPayload = {
    pipelineTasks: [
      {
        taskType: 'asr',
        config: {
          language: {
            sourceLanguage: language,
          },
          serviceId: config.asrServiceId,
          audioFormat: config.asrAudioFormat || 'wav',
          samplingRate: config.asrSamplingRate || 16000,
        },
      },
    ],
    inputData: {
      audio: [
        {
          audioContent: audioBase64,
        },
      ],
    },
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(config.callbackUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [config.authHeaderName]: config.inferenceApiKey,
      },
      body: JSON.stringify(requestPayload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 401 || response.status === 403) {
      throw new Error('BHASHINI_AUTH_ERROR');
    }
    if (response.status === 404) {
      throw new Error('BHASHINI_CONFIG_ERROR');
    }
    if (!response.ok) {
      throw new Error('BHASHINI_ASR_ERROR');
    }

    const data = await response.json();
    const taskOutput = data.pipelineResponse?.[0]?.output?.[0];
    const recognizedText = (taskOutput?.source || taskOutput?.target || taskOutput?.text || '').trim();

    return { text: recognizedText, bhashiniStatus: response.status };
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('TIMEOUT');
    }
    throw err;
  }
}

/**
 * Calls Bhashini TTS (Text-to-Speech) inference with verified voice configuration.
 */
export async function callBhashiniTTS(params: {
  text: string;
  language: string;
  gender?: 'female' | 'male';
}): Promise<{ audioContent: string; audioFormat: string; bhashiniStatus: number }> {
  const { text, language, gender = 'female' } = params;
  const config = await getPipelineConfigForLanguage(language);

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
          source: text,
        },
      ],
    },
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(config.callbackUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [config.authHeaderName]: config.inferenceApiKey,
      },
      body: JSON.stringify(requestPayload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 401 || response.status === 403) {
      throw new Error('BHASHINI_AUTH_ERROR');
    }
    if (response.status === 404) {
      throw new Error('BHASHINI_CONFIG_ERROR');
    }
    if (!response.ok) {
      throw new Error('BHASHINI_TTS_ERROR');
    }

    const data = await response.json();
    const audioObj = data.pipelineResponse?.[0]?.audio?.[0];
    const audioContent = audioObj?.audioContent || '';
    const audioFormat = data.pipelineResponse?.[0]?.config?.audioFormat || config.ttsAudioFormat || 'wav';

    if (!audioContent) {
      throw new Error('BHASHINI_TTS_ERROR');
    }

    return { audioContent, audioFormat, bhashiniStatus: response.status };
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('TIMEOUT');
    }
    throw err;
  }
}
