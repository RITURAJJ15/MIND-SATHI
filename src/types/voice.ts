export type VoiceLanguage = 'as' | 'hi' | 'bn' | 'en';

export type VoiceState =
  | 'READY'
  | 'IDLE'
  | 'LISTENING'
  | 'UNDERSTANDING'
  | 'PROCESSING_STT'
  | 'TRANSLATING'
  | 'THINKING'
  | 'PROCESSING_AI'
  | 'TRANSLATING_RESPONSE'
  | 'SPEAKING'
  | 'GENERATING_AUDIO'
  | 'PLAYING_AUDIO'
  | 'ERROR';

export interface VoiceLanguageOption {
  code: VoiceLanguage;
  name: string;
  nativeName: string;
  greeting: string;
  flag: string;
}

export const VOICE_LANGUAGES: VoiceLanguageOption[] = [
  { code: 'as', name: 'Assamese', nativeName: 'অসমীয়া', greeting: 'নমস্কাৰ! আপুনি কি ক’ব বিচাৰে?', flag: '🌾' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', greeting: 'नमस्ते! आप क्या कहना चाहते हैं?', flag: '🪔' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', greeting: 'নমস্কার! আপনি কি বলতে চান?', flag: '🌺' },
  { code: 'en', name: 'English', nativeName: 'English', greeting: 'Hello! What would you like to talk about today?', flag: '🌐' },
];

export interface STTRequestPayload {
  audioContent: string; // Base64 WAV PCM audio string
  language: VoiceLanguage;
  audioFormat?: string; // wav
  samplingRate?: number; // 16000
}

export interface STTResponse {
  success: boolean;
  text?: string;
  isEmpty?: boolean;
  error?: VoiceErrorCode | string;
  safeMessage?: string;
  language?: VoiceLanguage;
  diagnostics?: {
    samplingRate?: number;
    audioFormat?: string;
    bhashiniStatus?: number;
    sizeBytes?: number;
  };
}

export interface NMTRequestPayload {
  text: string;
  sourceLanguage: VoiceLanguage;
  targetLanguage: VoiceLanguage;
}

export interface NMTResponse {
  success: boolean;
  translatedText?: string;
  sourceLanguage?: VoiceLanguage;
  targetLanguage?: VoiceLanguage;
  error?: VoiceErrorCode | string;
  safeMessage?: string;
}

export interface TTSRequestPayload {
  text: string;
  language: VoiceLanguage;
  gender?: 'female' | 'male';
}

export interface TTSResponse {
  success: boolean;
  audioContent?: string; // Base64 audio string
  audioFormat?: string;
  error?: VoiceErrorCode | string;
  safeMessage?: string;
}

export type VoiceErrorCode =
  | 'MIC_PERMISSION_DENIED'
  | 'EMPTY_RECORDING'
  | 'BHASHINI_AUTH_ERROR'
  | 'BHASHINI_CONFIG_ERROR'
  | 'BHASHINI_ASR_ERROR'
  | 'BHASHINI_NMT_INPUT_ERROR'
  | 'BHASHINI_NMT_OUTPUT_ERROR'
  | 'BHASHINI_NMT_AUTH_ERROR'
  | 'BHASHINI_NMT_CONFIG_ERROR'
  | 'BHASHINI_NMT_UNSUPPORTED_LANGUAGE'
  | 'BHASHINI_NMT_NETWORK_ERROR'
  | 'GEMINI_ERROR'
  | 'GEMINI_EMPTY_RESPONSE'
  | 'BHASHINI_TTS_ERROR'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'NO_SPEECH_DETECTED';

export const VOICE_ERROR_MESSAGES: Record<VoiceErrorCode, string> = {
  MIC_PERMISSION_DENIED: 'Microphone permission was denied. Please allow microphone access and try again.',
  EMPTY_RECORDING: 'No voice was detected. Please speak clearly and try again.',
  BHASHINI_AUTH_ERROR: 'Voice service authentication failed. Please check the BHASHINI configuration.',
  BHASHINI_CONFIG_ERROR: 'The selected language voice service is not configured.',
  BHASHINI_ASR_ERROR: 'Voice recognition is temporarily unavailable.',
  BHASHINI_NMT_INPUT_ERROR: 'Could not process text for translation. Please speak clearly and try again.',
  BHASHINI_NMT_OUTPUT_ERROR: 'Translation service did not return an answer. Please try again.',
  BHASHINI_NMT_AUTH_ERROR: 'Voice service authentication failed. Please check the BHASHINI configuration.',
  BHASHINI_NMT_CONFIG_ERROR: 'Translation service is not configured for this language pair.',
  BHASHINI_NMT_UNSUPPORTED_LANGUAGE: 'Translation is not supported between the selected languages.',
  BHASHINI_NMT_NETWORK_ERROR: 'Translation service took too long to respond. Please try again.',
  GEMINI_ERROR: 'MIND SATHI could not prepare a response. Please try again.',
  GEMINI_EMPTY_RESPONSE: 'MIND SATHI could not generate an answer to your question. Please try asking again.',
  BHASHINI_TTS_ERROR: 'MIND SATHI prepared the answer but could not play the voice response.',
  NETWORK_ERROR: 'Please check your internet connection and try again.',
  TIMEOUT: 'The voice service took too long to respond. Please try again.',
  NO_SPEECH_DETECTED: 'No speech was detected. Please tap the microphone and speak again.',
};
