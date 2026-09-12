/**
 * src/server/bhashiniServerHelper.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Isolated server-side helper for Bhashini ULCA / Dhruva Speech Services.
 * Reads BHASHINI_INFERENCE_API_KEY and/or BHASHINI_UDYAT_KEY from process.env.
 * NEVER exposes keys to client-side code or logs.
 */

export interface BhashiniPipelineConfig {
  callbackUrl: string;
  inferenceApiKey: string;
  asrServiceIds: Record<string, string>;
  ttsServiceIds: Record<string, string>;
}

const DEFAULT_CONFIG_URL = 'https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline';
const DEFAULT_INFERENCE_URL = 'https://dhruva-api.bhashini.gov.in/services/inference/pipeline';

// Fallback known standard service IDs on Bhashini / AI4Bharat platform
const DEFAULT_ASR_SERVICE_IDS: Record<string, string> = {
  as: 'ai4bharat/conformer-multilingual-indo_aryan-gpu--t4',
  hi: 'ai4bharat/conformer-multilingual-indo_aryan-gpu--t4',
  bn: 'ai4bharat/conformer-multilingual-indo_aryan-gpu--t4',
  en: 'ai4bharat/conformer-en-gpu--t4',
};

const DEFAULT_TTS_SERVICE_IDS: Record<string, string> = {
  as: 'ai4bharat/indic-tts-coqui-indo_aryan-gpu--t4',
  hi: 'ai4bharat/indic-tts-coqui-indo_aryan-gpu--t4',
  bn: 'ai4bharat/indic-tts-coqui-indo_aryan-gpu--t4',
  en: 'ai4bharat/indic-tts-coqui-misc-gpu--t4',
};

// In-memory cache for resolved pipeline config
let cachedPipelineConfig: { config: BhashiniPipelineConfig; expiresAt: number } | null = null;

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
 * Resolves Bhashini pipeline configuration (endpoint, authorization token, service IDs).
 * Caches resolution for 30 minutes to minimize network roundtrips.
 */
export async function getPipelineConfig(): Promise<BhashiniPipelineConfig> {
  const { inferenceKey, udyatKey, userId, pipelineId } = getBhashiniCredentials();

  if (!inferenceKey && !udyatKey) {
    throw new Error('VOICE_SERVICE_NOT_CONFIGURED');
  }

  // Use cached config if still valid
  const now = Date.now();
  if (cachedPipelineConfig && cachedPipelineConfig.expiresAt > now) {
    return cachedPipelineConfig.config;
  }

  // 1. If Udyat Key is available, attempt dynamic pipeline discovery
  if (udyatKey) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const payload: any = {
        pipelineTasks: [
          { taskType: 'asr' },
          { taskType: 'tts' },
        ],
      };

      if (pipelineId) {
        payload.pipelineRequestConfig = { pipelineId };
      }

      const response = await fetch(DEFAULT_CONFIG_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ulcaApiKey: udyatKey,
          ...(userId ? { userID: userId } : {}),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const callbackUrl = data.pipelineInferenceAPIEndPoint?.callbackUrl || DEFAULT_INFERENCE_URL;
        const resolvedInferenceKey = data.pipelineInferenceAPIEndPoint?.inferenceApiKey?.value || inferenceKey || udyatKey;

        const asrServiceIds: Record<string, string> = { ...DEFAULT_ASR_SERVICE_IDS };
        const ttsServiceIds: Record<string, string> = { ...DEFAULT_TTS_SERVICE_IDS };

        if (Array.isArray(data.pipelineResponseConfig)) {
          for (const task of data.pipelineResponseConfig) {
            if (task.taskType === 'asr' && Array.isArray(task.config)) {
              for (const cfg of task.config) {
                const lang = cfg.language?.sourceLanguage;
                if (lang && cfg.serviceId) {
                  asrServiceIds[lang] = cfg.serviceId;
                }
              }
            } else if (task.taskType === 'tts' && Array.isArray(task.config)) {
              for (const cfg of task.config) {
                const lang = cfg.language?.sourceLanguage;
                if (lang && cfg.serviceId) {
                  ttsServiceIds[lang] = cfg.serviceId;
                }
              }
            }
          }
        }

        const config: BhashiniPipelineConfig = {
          callbackUrl,
          inferenceApiKey: resolvedInferenceKey,
          asrServiceIds,
          ttsServiceIds,
        };

        cachedPipelineConfig = {
          config,
          expiresAt: now + 30 * 60 * 1000, // 30 minutes
        };

        return config;
      }
    } catch {
      // Dynamic config lookup failed, fallback to direct inference key
    }
  }

  // 2. Default direct inference setup using BHASHINI_INFERENCE_API_KEY
  const directKey = inferenceKey || udyatKey || '';
  const fallbackConfig: BhashiniPipelineConfig = {
    callbackUrl: DEFAULT_INFERENCE_URL,
    inferenceApiKey: directKey,
    asrServiceIds: { ...DEFAULT_ASR_SERVICE_IDS },
    ttsServiceIds: { ...DEFAULT_TTS_SERVICE_IDS },
  };

  cachedPipelineConfig = {
    config: fallbackConfig,
    expiresAt: now + 5 * 60 * 1000,
  };

  return fallbackConfig;
}

/**
 * Calls Bhashini ASR (Speech-to-Text) inference
 */
export async function callBhashiniASR(params: {
  audioBase64: string;
  language: string;
  audioFormat?: string;
  samplingRate?: number;
}): Promise<string> {
  const { audioBase64, language, audioFormat = 'wav', samplingRate = 16000 } = params;
  const config = await getPipelineConfig();

  const serviceId = config.asrServiceIds[language] || DEFAULT_ASR_SERVICE_IDS[language] || DEFAULT_ASR_SERVICE_IDS.hi;

  const requestPayload = {
    pipelineTasks: [
      {
        taskType: 'asr',
        config: {
          language: {
            sourceLanguage: language,
          },
          serviceId,
          audioFormat,
          samplingRate,
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
  const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 seconds max

  try {
    const response = await fetch(config.callbackUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: config.inferenceApiKey,
      },
      body: JSON.stringify(requestPayload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`BHASHINI_ASR_ERROR_${response.status}`);
    }

    const data = await response.json();
    const taskOutput = data.pipelineResponse?.[0]?.output?.[0];
    const recognizedText = taskOutput?.source || taskOutput?.target || '';

    if (!recognizedText.trim()) {
      throw new Error('NO_SPEECH_RECOGNIZED');
    }

    return recognizedText.trim();
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('BHASHINI_ASR_TIMEOUT');
    }
    throw err;
  }
}

/**
 * Calls Bhashini TTS (Text-to-Speech) inference
 */
export async function callBhashiniTTS(params: {
  text: string;
  language: string;
  gender?: 'female' | 'male';
}): Promise<{ audioContent: string; audioFormat: string }> {
  const { text, language, gender = 'female' } = params;
  const config = await getPipelineConfig();

  const serviceId = config.ttsServiceIds[language] || DEFAULT_TTS_SERVICE_IDS[language] || DEFAULT_TTS_SERVICE_IDS.hi;

  const requestPayload = {
    pipelineTasks: [
      {
        taskType: 'tts',
        config: {
          language: {
            sourceLanguage: language,
          },
          serviceId,
          gender,
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
  const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 seconds max

  try {
    const response = await fetch(config.callbackUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: config.inferenceApiKey,
      },
      body: JSON.stringify(requestPayload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`BHASHINI_TTS_ERROR_${response.status}`);
    }

    const data = await response.json();
    const audioObj = data.pipelineResponse?.[0]?.audio?.[0];
    const audioContent = audioObj?.audioContent || '';
    const audioFormat = data.pipelineResponse?.[0]?.config?.audioFormat || 'wav';

    if (!audioContent) {
      throw new Error('NO_AUDIO_GENERATED');
    }

    return { audioContent, audioFormat };
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('BHASHINI_TTS_TIMEOUT');
    }
    throw err;
  }
}
