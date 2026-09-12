import React, { useState, useEffect, useRef } from 'react';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useLanguage } from '../../hooks/useLanguage';
import { VoiceLanguage, VOICE_LANGUAGES, VoiceState } from '../../types/voice';
import { bhashiniVoiceService } from '../../services/bhashiniVoiceService';
import { geminiService } from '../../services/geminiService';
import { familyService } from '../../services/familyService';
import { reminderService } from '../../services/reminderService';
import { dailyPlanService } from '../../services/dailyPlanService';
import { caregiverService } from '../../services/caregiverService';
import {
  Mic,
  Square,
  Volume2,
  Loader2,
  AlertCircle,
  Globe,
  Sparkles,
  X,
} from 'lucide-react';

interface BhashiniVoiceAssistantProps {
  onClose?: () => void;
  isModal?: boolean;
}

export const BhashiniVoiceAssistant: React.FC<BhashiniVoiceAssistantProps> = ({
  onClose,
  isModal = false,
}) => {
  const { currentUser } = useCurrentUser('voice-assistant');
  const { currentLang } = useLanguage();

  // Default voice language: match app language or default to Assamese
  const [selectedLanguage, setSelectedLanguage] = useState<VoiceLanguage>(() => {
    if (currentLang === 'as') return 'as';
    if (currentLang === 'bn') return 'bn';
    if (currentLang === 'hi') return 'hi';
    return 'as';
  });

  const [voiceState, setVoiceState] = useState<VoiceState>('IDLE');
  const [userTranscript, setUserTranscript] = useState<string>('');
  const [assistantReply, setAssistantReply] = useState<string>('');
  const [lastAudioBase64, setLastAudioBase64] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync selected voice language if user changes app language
  useEffect(() => {
    if (currentLang === 'as') setSelectedLanguage('as');
    else if (currentLang === 'bn') setSelectedLanguage('bn');
    else if (currentLang === 'hi') setSelectedLanguage('hi');
  }, [currentLang]);

  // Clean up timer and audio on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      bhashiniVoiceService.stopPlayback();
      bhashiniVoiceService.cleanupRecording();
    };
  }, []);

  // Quick suggestion prompts according to selected language
  const suggestions: Record<VoiceLanguage, { text: string; label: string }[]> = {
    as: [
      { label: '📅 আজিৰ দিনলিপি', text: 'আজি মোৰ দিনলিপিত কি কি কাম আছে?' },
      { label: '💊 ঔষধৰ সোঁৱৰণী', text: 'মই আজি কিবা ঔষধ খাবলৈ বাকী আছে নেকি?' },
      { label: '👨‍👩‍👧 মোৰ পৰিয়াল', text: 'মোৰ পৰিয়ালৰ সদস্যসকলৰ বিষয়ে কোৱা।' },
    ],
    hi: [
      { label: '📅 आज का प्लान', text: 'आज की मेरी दिनचर्या में क्या-क्या शामिल है?' },
      { label: '💊 दवाई रिमाइंडर', text: 'क्या आज की मेरी कोई दवाई बची है?' },
      { label: '👨‍👩‍👧 मेरा परिवार', text: 'मेरे परिवार के सदस्यों के बारे में बताइए।' },
    ],
    bn: [
      { label: '📅 আজকের রুটিন', text: 'আজ আমার রুটিনে কী কী কাজ আছে?' },
      { label: '💊 ওষুধের রিমাইন্ডার', text: 'আমার কি কোনো ওষুধ খাওয়ার বাকি আছে?' },
      { label: '👨‍👩‍👧 আমার পরিবার', text: 'আমার পরিবারের সদস্যদের সম্পর্কে বলো।' },
    ],
    en: [
      { label: '📅 Today’s Plan', text: 'What is my daily schedule for today?' },
      { label: '💊 Medication', text: 'Do I have any pending medicine reminders?' },
      { label: '👨‍👩‍👧 My Family', text: 'Tell me about my family members.' },
    ],
  };

  // Start microphone recording
  const handleStartRecording = async () => {
    setErrorMessage('');
    setRecordingSeconds(0);

    try {
      await bhashiniVoiceService.startRecording(selectedLanguage);
      setVoiceState('LISTENING');

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setRecordingSeconds((sec) => sec + 1);
      }, 1000);
    } catch (err: any) {
      console.warn('[BhashiniVoiceAssistant] Start recording error:', err);
      setVoiceState('IDLE');
      if (err.message === 'MIC_PERMISSION_DENIED') {
        setErrorMessage(
          'Microphone permission was not granted. Please allow microphone access in your browser.'
        );
      } else {
        setErrorMessage(
          'Microphone is unavailable. You can tap any of the quick question buttons below.'
        );
      }
    }
  };

  // Stop recording and process pipeline: STT -> Gemini -> TTS
  const handleStopRecording = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setVoiceState('PROCESSING_STT');

    try {
      const audioResult = await bhashiniVoiceService.stopRecording();

      // Call speech to text (with automatic browser speech fallback)
      const transcribedQuery = await bhashiniVoiceService.speechToText(
        audioResult?.base64 || '',
        selectedLanguage,
        audioResult?.format || 'wav'
      );

      if (!transcribedQuery || !transcribedQuery.trim()) {
        setVoiceState('IDLE');
        setErrorMessage('No speech heard. Please tap the microphone and try speaking again.');
        return;
      }

      setUserTranscript(transcribedQuery);

      // Process with Gemini AI grounded in real patient context
      await processPatientAIQuery(transcribedQuery);
    } catch (err: any) {
      console.warn('[BhashiniVoiceAssistant] Speech recognition notice:', err);
      setVoiceState('IDLE');
      setErrorMessage('Could not clearly detect speech. Please tap the microphone and speak again.');
    }
  };

  // Shared processor for transcribed voice text or quick suggestions
  const processPatientAIQuery = async (queryText: string) => {
    setVoiceState('PROCESSING_AI');
    setErrorMessage(''); // Clear any previous notices immediately

    try {
      // Gather real patient context from local and db services
      const familyMembers = familyService.getFamilyMembersForUser(currentUser.id);
      const reminders = reminderService.getRemindersForUser(currentUser.id);
      const dailyPlan = dailyPlanService.getDailyPlan(currentUser.id);

      const dailyPlanTasks = (dailyPlan?.tasks || []).map((t) => {
        let taskTitle = '';
        if (typeof t.title === 'string') {
          taskTitle = t.title;
        } else if (t.title && typeof t.title === 'object') {
          const titleObj = t.title as Record<string, string>;
          taskTitle = titleObj[selectedLanguage] || titleObj.en || '';
        }
        return {
          title: taskTitle,
          completed: t.completed,
        };
      });

      let caregiverName = '';
      try {
        const cg = await caregiverService.getAssignedCaregiverForPatient(currentUser.id);
        if (cg) caregiverName = cg.name || '';
      } catch (e) {
        // Non-blocking
      }

      // Call Gemini assistant grounded in patient context
      const reply = await geminiService.chatWithMemoryAssistant({
        userId: currentUser.id,
        message: queryText,
        history: [],
        userProfile: currentUser,
        familyMembers,
        reminders,
        dailyPlanTasks,
        caregiverName,
        language: selectedLanguage,
      });

      setAssistantReply(reply);

      // Synthesize speech: Try Bhashini TTS first, seamlessly fallback to browser SpeechSynthesis
      setVoiceState('GENERATING_AUDIO');
      let audioBase64: string | null = null;
      try {
        audioBase64 = await bhashiniVoiceService.textToSpeech(
          reply,
          selectedLanguage,
          'female'
        );
      } catch {
        // Ignored; fallback will speak via browser speechService
      }

      setLastAudioBase64(audioBase64);
      setVoiceState('PLAYING_AUDIO');

      // Speak aloud (Bhashini audio or browser speechService)
      await bhashiniVoiceService.speakText(reply, selectedLanguage, audioBase64);
      setVoiceState('IDLE');
    } catch (err: any) {
      console.error('[BhashiniVoiceAssistant] AI Query error:', err);
      setVoiceState('IDLE');
      // If Gemini chat succeeded, we don't display error. Only if general call completely failed:
      if (!assistantReply) {
        setErrorMessage('MIND SATHI is taking a moment to connect. Please try asking again.');
      }
    }
  };

  // Replay the synthesized audio response
  const handlePlayAgain = async () => {
    if (!assistantReply) return;
    setVoiceState('PLAYING_AUDIO');

    try {
      await bhashiniVoiceService.speakText(assistantReply, selectedLanguage, lastAudioBase64);
    } catch (e) {
      console.warn('[BhashiniVoiceAssistant] Play again notice:', e);
    } finally {
      setVoiceState('IDLE');
    }
  };

  // Status message rendering based on state
  const getStatusDisplay = () => {
    switch (voiceState) {
      case 'LISTENING':
        return {
          title: 'Listening...',
          sub: `Speak clearly in ${VOICE_LANGUAGES.find((l) => l.code === selectedLanguage)?.name} (${recordingSeconds}s)`,
          color: 'text-rose-400',
        };
      case 'PROCESSING_STT':
        return {
          title: 'Understanding voice...',
          sub: 'Processing speech...',
          color: 'text-amber-300',
        };
      case 'PROCESSING_AI':
        return {
          title: 'MIND SATHI is thinking...',
          sub: 'Checking your routine, family & reminders...',
          color: 'text-sky-300',
        };
      case 'GENERATING_AUDIO':
        return {
          title: 'Preparing voice...',
          sub: `Converting to ${VOICE_LANGUAGES.find((l) => l.code === selectedLanguage)?.nativeName} speech`,
          color: 'text-teal-300',
        };
      case 'PLAYING_AUDIO':
        return {
          title: 'MIND SATHI is speaking...',
          sub: 'Listen to your voice companion',
          color: 'text-emerald-300',
        };
      case 'ERROR':
        return {
          title: 'Notice',
          sub: 'Tap below to speak again',
          color: 'text-amber-300',
        };
      default:
        return {
          title: 'Ready to listen',
          sub: `Tap the microphone to speak in ${VOICE_LANGUAGES.find((l) => l.code === selectedLanguage)?.nativeName}`,
          color: 'text-slate-300',
        };
    }
  };

  const status = getStatusDisplay();

  return (
    <div className="bg-gradient-to-br from-[#081B2E] via-[#0E2A47] to-[#0A1A2F] border-2 border-emerald-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl text-white relative overflow-hidden max-w-2xl w-full mx-auto">
      {/* Decorative ambient glowing auras */}
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Section */}
      <div className="relative z-10 flex items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl sm:text-2xl">🎙️</span>
            <h2 className="text-base sm:text-lg font-extrabold tracking-tight text-white flex items-center gap-2">
              <span>Talk with MIND SATHI</span>
              <span className="text-[10px] font-semibold text-emerald-300 bg-emerald-950/80 border border-emerald-500/40 px-2 py-0.5 rounded-full">
                Multilingual Voice AI
              </span>
            </h2>
          </div>
          <p className="text-xs text-slate-300 mt-0.5 font-medium">
            মাইনড সাৰথি / माइंड साथी — Speak in your mother tongue.
          </p>
        </div>

        {isModal && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer shrink-0"
            title="Close voice dialog"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Language Selector Tabs */}
      <div className="relative z-10 my-3 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1 text-xs text-emerald-400 font-bold">
          <Globe className="w-3.5 h-3.5" />
          <span>Language:</span>
        </div>
        <div className="flex items-center gap-1.5 bg-[#061423]/90 p-1 rounded-2xl border border-white/10 shrink-0">
          {VOICE_LANGUAGES.map((lang) => {
            const isSelected = selectedLanguage === lang.code;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => {
                  if (voiceState === 'IDLE' || voiceState === 'ERROR') {
                    setSelectedLanguage(lang.code);
                  }
                }}
                disabled={voiceState !== 'IDLE' && voiceState !== 'ERROR'}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-white/5 disabled:opacity-50'
                }`}
              >
                <span>{lang.nativeName}</span>
                <span className="text-[10px] ml-1 opacity-70 uppercase">({lang.code})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Mic Action Center */}
      <div className="relative z-10 py-4 flex flex-col items-center justify-center text-center">
        {/* Animated Microphone / Action Button */}
        <div className="relative mb-3">
          {voiceState === 'LISTENING' && (
            <div className="absolute inset-0 rounded-full bg-rose-500/40 animate-ping" />
          )}
          {voiceState === 'PLAYING_AUDIO' && (
            <div className="absolute inset-0 rounded-full bg-emerald-500/40 animate-pulse" />
          )}

          {voiceState === 'LISTENING' ? (
            <button
              type="button"
              onClick={handleStopRecording}
              className="relative w-20 h-20 rounded-full bg-gradient-to-tr from-rose-600 to-red-500 hover:from-rose-500 hover:to-red-400 text-white flex flex-col items-center justify-center shadow-xl shadow-red-950/50 hover:scale-105 active:scale-95 transition-all cursor-pointer border-4 border-rose-300/40"
              title="Click to stop speaking and process"
            >
              <Square className="w-7 h-7 fill-white mb-0.5" />
              <span className="text-[10px] font-black uppercase tracking-wider">Stop</span>
            </button>
          ) : voiceState === 'IDLE' || voiceState === 'ERROR' ? (
            <button
              type="button"
              onClick={handleStartRecording}
              className="relative w-20 h-20 rounded-full bg-gradient-to-tr from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-500 text-white flex flex-col items-center justify-center shadow-xl shadow-emerald-950/50 hover:scale-105 active:scale-95 transition-all cursor-pointer border-4 border-emerald-300/40 group"
              title="Tap to start speaking"
            >
              <Mic className="w-8 h-8 group-hover:scale-110 transition-transform mb-0.5" />
              <span className="text-[9px] font-black uppercase tracking-wider">Tap to Speak</span>
            </button>
          ) : (
            <div className="relative w-20 h-20 rounded-full bg-[#07192C] border-4 border-blue-400/40 flex flex-col items-center justify-center text-blue-300 shadow-xl">
              <Loader2 className="w-7 h-7 animate-spin text-emerald-400 mb-0.5" />
              <span className="text-[9px] font-bold uppercase tracking-wider">Wait</span>
            </div>
          )}
        </div>

        {/* State Title & Subtitle */}
        <div className="space-y-0.5 max-w-md mx-auto">
          <div className={`text-base font-extrabold ${status.color}`}>
            {status.title}
          </div>
          <div className="text-xs text-slate-300 font-normal">
            {status.sub}
          </div>
        </div>

        {/* Recording Visual Wave Indicator */}
        {voiceState === 'LISTENING' && (
          <div className="flex items-center gap-1.5 mt-2.5">
            <span className="w-1.5 h-3 bg-rose-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-5 bg-rose-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-7 bg-rose-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            <span className="w-1.5 h-4 bg-rose-400 rounded-full animate-bounce" style={{ animationDelay: '450ms' }} />
            <span className="w-1.5 h-2 bg-rose-400 rounded-full animate-bounce" style={{ animationDelay: '600ms' }} />
          </div>
        )}

        {/* Speaking Equalizer Indicator */}
        {voiceState === 'PLAYING_AUDIO' && (
          <div className="flex items-center gap-1.5 mt-2.5">
            <span className="w-1.5 h-3 bg-emerald-400 rounded-full animate-pulse" />
            <span className="w-1.5 h-6 bg-emerald-400 rounded-full animate-pulse" style={{ animationDelay: '100ms' }} />
            <span className="w-1.5 h-4 bg-emerald-400 rounded-full animate-pulse" style={{ animationDelay: '200ms' }} />
            <span className="w-1.5 h-7 bg-emerald-400 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
            <span className="w-1.5 h-3 bg-emerald-400 rounded-full animate-pulse" style={{ animationDelay: '400ms' }} />
          </div>
        )}

        {/* Error Notice */}
        {errorMessage && (
          <div className="mt-3 p-2.5 bg-amber-950/60 border border-amber-500/40 rounded-2xl max-w-md text-xs text-amber-200 flex items-center gap-2 text-left">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="flex-1">{errorMessage}</span>
          </div>
        )}
      </div>

      {/* Conversation Cards: User Transcript & MIND SATHI Response */}
      {(userTranscript || assistantReply) && (
        <div className="relative z-10 space-y-2.5 pt-3 border-t border-white/10 max-h-56 overflow-y-auto pr-1">
          {userTranscript && (
            <div className="bg-[#071829]/90 border border-blue-500/20 rounded-2xl p-3 flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-600/30 text-blue-300 flex items-center justify-center shrink-0 text-xs font-bold">
                🗣️
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-bold text-blue-300 uppercase tracking-wider">
                  You Said
                </div>
                <div className="text-xs font-medium text-white mt-0.5 break-words">
                  "{userTranscript}"
                </div>
              </div>
            </div>
          )}

          {assistantReply && (
            <div className="bg-[#0A2239]/90 border border-emerald-500/30 rounded-2xl p-3.5 flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-600/30 text-emerald-300 flex items-center justify-center shrink-0 text-xs font-bold">
                🧠
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">
                    MIND SATHI
                  </div>

                  <button
                    type="button"
                    onClick={handlePlayAgain}
                    disabled={voiceState === 'PLAYING_AUDIO'}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white text-[11px] font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                  >
                    <Volume2 className="w-3 h-3" />
                    <span>{voiceState === 'PLAYING_AUDIO' ? 'Speaking...' : 'Play Again'}</span>
                  </button>
                </div>
                <div className="text-xs font-medium text-slate-100 mt-1 leading-relaxed whitespace-pre-line">
                  {assistantReply}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Suggested Quick Prompts */}
      <div className="relative z-10 mt-3 pt-2.5 border-t border-white/10">
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium mb-1.5">
          <Sparkles className="w-3 h-3 text-amber-400" />
          <span>Tap to ask in {VOICE_LANGUAGES.find((l) => l.code === selectedLanguage)?.name}:</span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {suggestions[selectedLanguage]?.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                if (voiceState === 'IDLE' || voiceState === 'ERROR') {
                  setUserTranscript(item.text);
                  processPatientAIQuery(item.text);
                }
              }}
              disabled={voiceState !== 'IDLE' && voiceState !== 'ERROR'}
              className="text-[11px] bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 hover:border-emerald-500/40 px-2.5 py-1 rounded-full transition-all cursor-pointer disabled:opacity-50 text-left"
            >
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BhashiniVoiceAssistant;
