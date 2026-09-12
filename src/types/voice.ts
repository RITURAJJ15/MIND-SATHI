export type VoiceLanguage = 'as' | 'hi' | 'bn' | 'en';

export type VoiceState =
  | 'IDLE'
  | 'LISTENING'
  | 'PROCESSING_STT'
  | 'PROCESSING_AI'
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
  audioContent: string; // Base64 audio string
  language: VoiceLanguage;
  audioFormat?: string; // webm, wav, mp4, etc.
}

export interface STTResponse {
  success: boolean;
  text?: string;
  error?: string;
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
  error?: string;
}

export interface VoiceError {
  code:
    | 'MIC_PERMISSION_DENIED'
    | 'MIC_UNAVAILABLE'
    | 'NO_SPEECH_DETECTED'
    | 'STT_FAILED'
    | 'GEMINI_FAILED'
    | 'TTS_FAILED'
    | 'SERVICE_UNAVAILABLE'
    | 'UNKNOWN_ERROR';
  message: string;
}
