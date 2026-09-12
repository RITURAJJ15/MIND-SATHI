import type { VercelRequest, VercelResponse } from '@vercel/node';

const ERROR_MESSAGES: Record<string, string> = {
  BHASHINI_NMT_INPUT_ERROR: 'Could not process text for translation. Please speak clearly and try again.',
  BHASHINI_NMT_OUTPUT_ERROR: 'Translation service did not return an answer. Please try again.',
  BHASHINI_NMT_AUTH_ERROR: 'Voice service authentication failed. Please check the BHASHINI configuration.',
  BHASHINI_NMT_CONFIG_ERROR: 'Translation service is not configured for this language pair.',
  BHASHINI_NMT_UNSUPPORTED_LANGUAGE: 'Translation is not supported between the selected languages.',
  BHASHINI_NMT_NETWORK_ERROR: 'Translation service took too long to respond. Please try again.',
  TIMEOUT: 'Translation request timed out. Please try again.',
};

const DEFAULT_CONFIG_URL = 'https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline';
const DEFAULT_INFERENCE_URL = 'https://dhruva-api.bhashini.gov.in/services/inference/pipeline';

// Standard fallback NMT service for Indic languages
const FALLBACK_NMT_SERVICE = 'ai4bharat/indictrans-v2-all-gpu--t4';

interface PipelineConfig {
  callbackUrl: string;
  inferenceApiKey: string;
  authHeaderName: string;
  serviceId: string;
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

async function getNMTConfig(sourceLanguage: string, targetLanguage: string): Promise<PipelineConfig> {
  const cacheKey = `${sourceLanguage}->${targetLanguage}`;
  const now = Date.now();
  const cached = configCache.get(cacheKey);
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
            taskType: 'translation',
            config: {
              language: {
                sourceLanguage,
                targetLanguage,
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

        let serviceId = FALLBACK_NMT_SERVICE;

        if (Array.isArray(data.pipelineResponseConfig)) {
          for (const task of data.pipelineResponseConfig) {
            if (task.taskType === 'translation' && Array.isArray(task.config) && task.config[0]) {
              const cfg = task.config[0];
              if (cfg.serviceId) {
                serviceId = cfg.serviceId;
                break;
              }
            }
          }
        }

        const config: PipelineConfig = {
          callbackUrl,
          inferenceApiKey: authHeaderValue,
          authHeaderName,
          serviceId,
        };

        configCache.set(cacheKey, { config, expiresAt: now + 30 * 60 * 1000 });
        return config;
      }
    } catch {
      // Fall through to fallback
    }
  }

  const directKey = inferenceKey || udyatKey || '';
  const fallbackConfig: PipelineConfig = {
    callbackUrl: DEFAULT_INFERENCE_URL,
    inferenceApiKey: directKey,
    authHeaderName: 'Authorization',
    serviceId: FALLBACK_NMT_SERVICE,
  };

  configCache.set(cacheKey, { config: fallbackConfig, expiresAt: now + 5 * 60 * 1000 });
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
      error: 'BHASHINI_NMT_AUTH_ERROR',
      safeMessage: ERROR_MESSAGES.BHASHINI_NMT_AUTH_ERROR,
    });
  }

  try {
    const body = req.body || {};
    const { text, sourceLanguage = 'as', targetLanguage = 'en' } = body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({
        success: false,
        error: 'BHASHINI_NMT_INPUT_ERROR',
        safeMessage: ERROR_MESSAGES.BHASHINI_NMT_INPUT_ERROR,
      });
    }

    const trimmedText = text.trim();

    // Skip translation if source and target are the same
    if (sourceLanguage === targetLanguage) {
      return res.status(200).json({
        success: true,
        translatedText: trimmedText,
        sourceLanguage,
        targetLanguage,
      });
    }

    const config = await getNMTConfig(sourceLanguage, targetLanguage);

    const requestPayload = {
      pipelineTasks: [
        {
          taskType: 'translation',
          config: {
            language: {
              sourceLanguage,
              targetLanguage,
            },
            serviceId: config.serviceId,
          },
        },
      ],
      inputData: {
        input: [
          {
            source: trimmedText,
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
      console.warn('[Bhashini NMT] Auth error status:', bhashiniRes.status);
      return res.status(401).json({
        success: false,
        error: 'BHASHINI_NMT_AUTH_ERROR',
        safeMessage: ERROR_MESSAGES.BHASHINI_NMT_AUTH_ERROR,
      });
    }

    if (!bhashiniRes.ok) {
      console.warn('[Bhashini NMT] Compute error status:', bhashiniRes.status);
      return res.status(502).json({
        success: false,
        error: 'BHASHINI_NMT_OUTPUT_ERROR',
        safeMessage: ERROR_MESSAGES.BHASHINI_NMT_OUTPUT_ERROR,
      });
    }

    const bhashiniData: any = await bhashiniRes.json();
    const taskOutput = bhashiniData.pipelineResponse?.[0]?.output?.[0];
    const translatedText = (
      taskOutput?.target ||
      taskOutput?.dest ||
      taskOutput?.targetContent ||
      taskOutput?.text ||
      ''
    ).trim();

    if (!translatedText) {
      console.warn('[Bhashini NMT] Empty translation response');
      return res.status(502).json({
        success: false,
        error: 'BHASHINI_NMT_OUTPUT_ERROR',
        safeMessage: ERROR_MESSAGES.BHASHINI_NMT_OUTPUT_ERROR,
      });
    }

    // Safe diagnostic logging per Section 15 (never log keys, secrets, or raw sensitive info)
    console.log('[Bhashini NMT Success]', {
      sourceLanguage,
      targetLanguage,
      inputLength: trimmedText.length,
      outputLength: translatedText.length,
    });

    return res.status(200).json({
      success: true,
      translatedText,
      sourceLanguage,
      targetLanguage,
    });
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return res.status(504).json({
        success: false,
        error: 'TIMEOUT',
        safeMessage: ERROR_MESSAGES.TIMEOUT,
      });
    }

    console.error('[Bhashini NMT Exception]', err?.message || err);
    return res.status(500).json({
      success: false,
      error: 'BHASHINI_NMT_NETWORK_ERROR',
      safeMessage: ERROR_MESSAGES.BHASHINI_NMT_NETWORK_ERROR,
    });
  }
}
