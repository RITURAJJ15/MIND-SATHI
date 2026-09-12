/**
 * src/components/voice/BhashiniVoiceAssistant.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Complete Multilingual Voice Assistant Dialog for MIND SATHI.
 * Full Pipeline:
 * [ASR] -> [NMT native->en] -> [GEMINI English] -> [NMT en->native] -> [TTS native voice]
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  Square,
  Volume2,
  AlertCircle,
  Loader2,
  Sparkles,
  Globe,
  X,
} from 'lucide-react';
import {
  VoiceLanguage,
  VoiceState,
  VOICE_LANGUAGES,
  VOICE_ERROR_MESSAGES,
  VoiceErrorCode,
} from '../../types/voice';
import { bhashiniVoiceService } from '../../services/bhashiniVoiceService';
import { geminiService } from '../../services/geminiService';
import { familyService } from '../../services/familyService';
import { reminderService } from '../../services/reminderService';
import { dailyPlanService } from '../../services/dailyPlanService';
import { caregiverService } from '../../services/caregiverService';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useLanguage } from '../../hooks/useLanguage';

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

  // Selected language: match patient's app language or default to Assamese
  const [selectedLanguage, setSelectedLanguage] = useState<VoiceLanguage>(() => {
    if (currentLang === 'as') return 'as';
    if (currentLang === 'bn') return 'bn';
    if (currentLang === 'hi') return 'hi';
    return 'as';
  });

  const [voiceState, setVoiceState] = useState<VoiceState>('READY');
  const [userTranscript, setUserTranscript] = useState<string>('');
  const [assistantReply, setAssistantReply] = useState<string>('');
  const [lastAudioBase64, setLastAudioBase64] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [conversationHistory, setConversationHistory] = useState<
    { role: 'user' | 'assistant'; content: string }[]
  >([]);

  const isProcessingRef = useRef<boolean>(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const autoStopTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
      if (autoStopTimeoutRef.current) clearTimeout(autoStopTimeoutRef.current);
      bhashiniVoiceService.stopPlayback();
      bhashiniVoiceService.cleanupRecording();
      isProcessingRef.current = false;
    };
  }, []);

  // Quick suggestion prompts according to selected language
  const suggestions: Record<VoiceLanguage, { text: string; label: string }[]> = {
    as: [
      { label: '📅 আজিৰ দিনলিপি', text: 'মই আজি কি খেল খেলিব পাৰোঁ?' },
      { label: '💊 দৰবৰ সোঁৱৰণী', text: 'মোৰ আজি কিবা ঔষধ খাবলৈ বাকী আছে নেকি?' },
      { label: '👨‍👩‍👧 মোৰ পৰিয়াল', text: 'মোৰ পৰিয়ালৰ সদস্যসকলৰ বিষয়ে কোৱা।' },
    ],
    hi: [
      { label: '📅 आज का खेल', text: 'आज मुझे कौन सा खेल खेलना चाहिए?' },
      { label: '💊 दवाई रिमाइंडर', text: 'क्या आज की मेरी कोई दवाई बची है?' },
      { label: '👨‍👩‍👧 मेरा परिवार', text: 'मेरे परिवार के सदस्यों के बारे में बताइए।' },
    ],
    bn: [
      { label: '📅 আজকের খেলা', text: 'আজ আমি কী খেলা খেলতে পারি?' },
      { label: '💊 ওষুধের রিমাইন্ডার', text: 'আমার কি কোনো ওষুধ খাওয়ার বাকি আছে?' },
      { label: '👨‍👩‍👧 আমার পরিবার', text: 'আমার পরিবারের সদস্যদের সম্পর্কে বলো।' },
    ],
    en: [
      { label: '📅 Today’s Activity', text: 'What is my activity for today?' },
      { label: '💊 Medication', text: 'Do I have any pending medicine reminders?' },
      { label: '👨‍👩‍👧 My Family', text: 'Tell me about my family members.' },
    ],
  };

  // Start microphone recording
  const handleStartRecording = async () => {
    if (isProcessingRef.current) return;
    setErrorMessage('');
    setRecordingSeconds(0);

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const offlineMsg =
        selectedLanguage === 'hi'
          ? "वॉइस एआई के लिए इंटरनेट कनेक्शन आवश्यक है। आपकी सहेजी गई प्रगति सुरक्षित है और वापस ऑनलाइन होने पर स्वचालित रूप से सिंक हो जाएगी।"
          : selectedLanguage === 'as'
          ? "ভইচ এআইৰ বাবে ইণ্টাৰনেট সংযোগৰ প্ৰয়োজন। আপোনাৰ সঞ্চিত অগ্ৰগতি সুৰক্ষিত আছে আৰু পুনৰ অনলাইন হ'লে স্বয়ংক্ৰিয়ভাৱে ছিংক হ'ব।"
          : selectedLanguage === 'bn'
          ? "ভয়েস এআই-এর জন্য ইন্টারনেট সংযোগ প্রয়োজন। আপনার সংরক্ষিত অগ্রগতি সুরক্ষিত রয়েছে এবং অনলাইনে ফিরলে স্বয়ংক্রিয়ভাবে সিঙ্ক হবে।"
          : "Voice AI needs an internet connection. Your saved progress is safe and will sync automatically when you're back online.";
      setErrorMessage(offlineMsg);
      setVoiceState('ERROR');
      return;
    }

    try {
      await bhashiniVoiceService.startRecording(selectedLanguage);
      setVoiceState('LISTENING');

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setRecordingSeconds((sec) => sec + 1);
      }, 1000);

      // Safe auto-stop after 15 seconds to prevent accidental infinite recording
      if (autoStopTimeoutRef.current) clearTimeout(autoStopTimeoutRef.current);
      autoStopTimeoutRef.current = setTimeout(() => {
        handleStopRecording();
      }, 15000);
    } catch (err: any) {
      console.warn('[BhashiniVoiceAssistant] Start recording error:', err);
      setVoiceState('READY');
      setErrorMessage(
        err.message || VOICE_ERROR_MESSAGES.MIC_PERMISSION_DENIED
      );
    }
  };

  // Stop recording and process full pipeline
  const handleStopRecording = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (autoStopTimeoutRef.current) {
      clearTimeout(autoStopTimeoutRef.current);
      autoStopTimeoutRef.current = null;
    }

    if (isProcessingRef.current) return;

    setVoiceState('UNDERSTANDING');
    setErrorMessage('');

    try {
      const audioResult = await bhashiniVoiceService.stopRecording();

      // Call Bhashini Speech-to-Text
      const sttResult = await bhashiniVoiceService.speechToText(
        audioResult.base64,
        selectedLanguage
      );

      // Empty speech check: ONLY show when speech was genuinely empty
      if (sttResult.isEmpty || !sttResult.text || !sttResult.text.trim()) {
        setVoiceState('READY');
        setErrorMessage(VOICE_ERROR_MESSAGES.NO_SPEECH_DETECTED);
        return;
      }

      const patientOriginalTranscript = sttResult.text.trim();
      setUserTranscript(patientOriginalTranscript);
      setErrorMessage('');

      // Run complete multilingual conversation pipeline
      await processPatientAIQuery(patientOriginalTranscript);
    } catch (err: any) {
      console.warn('[BhashiniVoiceAssistant] STT Error:', err);
      setVoiceState('READY');
      const displayMessage = err.message || VOICE_ERROR_MESSAGES.BHASHINI_ASR_ERROR;
      setErrorMessage(displayMessage);
    }
  };

  // Complete Multilingual Conversation Pipeline: NMT -> Gemini -> NMT -> TTS
  const processPatientAIQuery = async (originalQueryText: string) => {
    if (isProcessingRef.current) return;

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const offlineMsg =
        selectedLanguage === 'hi'
          ? "वॉइस एआई के लिए इंटरनेट कनेक्शन आवश्यक है। आपकी सहेजी गई प्रगति सुरक्षित है और वापस ऑनलाइन होने पर स्वचालित रूप से सिंक हो जाएगी।"
          : selectedLanguage === 'as'
          ? "ভইচ এআইৰ বাবে ইণ্টাৰনেট সংযোগৰ প্ৰয়োজন। আপোনাৰ সঞ্চিত অগ্ৰগতি সুৰক্ষিত আছে আৰু পুনৰ অনলাইন হ'লে স্বয়ংক্ৰিয়ভাৱে ছিংক হ'ব।"
          : selectedLanguage === 'bn'
          ? "ভয়েস এআই-এর জন্য ইন্টারনেট সংযোগ প্রয়োজন। আপনার সংরক্ষিত অগ্রগতি সুরক্ষিত রয়েছে এবং অনলাইনে ফিরলে স্বয়ংক্রিয়ভাবে সিঙ্ক হবে।"
          : "Voice AI needs an internet connection. Your saved progress is safe and will sync automatically when you're back online.";
      setErrorMessage(offlineMsg);
      setVoiceState('ERROR');
      return;
    }

    isProcessingRef.current = true;
    setErrorMessage('');

    try {
      // ───────────────────────────────────────────────────────────────────────
      // STAGE 1: INPUT NMT (Translate Patient Native Speech -> English, if needed)
      // ───────────────────────────────────────────────────────────────────────
      let queryForAssistant = originalQueryText;
      if (selectedLanguage !== 'en') {
        try {
          const translated = await bhashiniVoiceService.translateWithBhashini(
            originalQueryText,
            selectedLanguage,
            'en'
          );
          // Only adopt translation if it's meaningful and not corrupted punctuation
          if (
            translated &&
            translated.trim().length > 2 &&
            !/^[?\s.,!]+$/.test(translated) &&
            !translated.startsWith('???')
          ) {
            queryForAssistant = translated;
          }
        } catch (tErr) {
          console.warn('[BhashiniVoiceAssistant] Translation note, proceeding with native text:', tErr);
        }
      }

      // ───────────────────────────────────────────────────────────────────────
      // STAGE 2: GEMINI ASSISTANT (Native multilingual reasoning)
      // ───────────────────────────────────────────────────────────────────────
      setVoiceState('THINKING');

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

      const rawReply = await geminiService.chatWithMemoryAssistant({
        userId: currentUser.id,
        message: queryForAssistant,
        originalMessage: originalQueryText,
        originalLanguage: selectedLanguage,
        history: conversationHistory,
        userProfile: currentUser,
        familyMembers,
        reminders,
        dailyPlanTasks,
        caregiverName,
        language: selectedLanguage,
      });

      if (!rawReply || !rawReply.trim()) {
        const emptyErr = new Error(VOICE_ERROR_MESSAGES.GEMINI_EMPTY_RESPONSE) as any;
        emptyErr.code = 'GEMINI_EMPTY_RESPONSE';
        throw emptyErr;
      }

      // Update multi-turn conversation history
      setConversationHistory((prev) => [
        ...prev.slice(-6),
        { role: 'user', content: queryForAssistant },
        { role: 'assistant', content: rawReply },
      ]);

      // ───────────────────────────────────────────────────────────────────────
      // STAGE 3: CHECK IF RESPONSE IS ALREADY IN PATIENT'S SCRIPT
      // ───────────────────────────────────────────────────────────────────────
      let patientLanguageReply = rawReply;
      const isAlreadyTargetScript =
        (selectedLanguage === 'as' && /[\u0980-\u09FF]/.test(rawReply)) ||
        (selectedLanguage === 'bn' && /[\u0980-\u09FF]/.test(rawReply)) ||
        (selectedLanguage === 'hi' && /[\u0900-\u097F]/.test(rawReply));

      if (!isAlreadyTargetScript) {
        setVoiceState('TRANSLATING_RESPONSE');
        try {
          const translated = await bhashiniVoiceService.translateWithBhashini(
            rawReply,
            'en',
            selectedLanguage
          );
          if (
            translated &&
            translated.trim().length > 2 &&
            !/^[?\s.,!]+$/.test(translated) &&
            !translated.startsWith('???')
          ) {
            patientLanguageReply = translated;
          }
        } catch (err) {
          console.warn('[BhashiniVoiceAssistant] Output NMT notice, using assistant reply:', err);
        }
      }

      // ───────────────────────────────────────────────────────────────────────
      // STAGE 4: DISPLAY TRANSLATED ANSWER IN UI
      // ───────────────────────────────────────────────────────────────────────
      setAssistantReply(patientLanguageReply);

      // ───────────────────────────────────────────────────────────────────────
      // STAGE 5: SYNTHESIZE SPEECH WITH BHASHINI TTS
      // ───────────────────────────────────────────────────────────────────────
      setVoiceState('GENERATING_AUDIO');
      const audioBase64 = await bhashiniVoiceService.textToSpeech(
        patientLanguageReply,
        selectedLanguage,
        'female'
      );

      setLastAudioBase64(audioBase64);

      // ───────────────────────────────────────────────────────────────────────
      // STAGE 6: SPEAK ALOUD (Audio playback)
      // ───────────────────────────────────────────────────────────────────────
      setVoiceState('SPEAKING');
      await bhashiniVoiceService.speakText(
        patientLanguageReply,
        selectedLanguage,
        audioBase64
      );

      setVoiceState('READY');
    } catch (err: any) {
      console.error('[BhashiniVoiceAssistant] Conversation error:', err);
      // Elder-friendly resilient fallback: synthesize grounded localized reply
      try {
        const familyMembers = familyService.getFamilyMembersForUser(currentUser.id);
        const reminders = reminderService.getRemindersForUser(currentUser.id);
        const dailyPlan = dailyPlanService.getDailyPlan(currentUser.id);
        const safeReply = await geminiService.chatWithMemoryAssistant({
          userId: currentUser.id,
          message: originalQueryText,
          originalMessage: originalQueryText,
          originalLanguage: selectedLanguage,
          history: [],
          userProfile: currentUser,
          familyMembers,
          reminders,
          dailyPlanTasks: (dailyPlan?.tasks || []).map((t) => ({
            title: typeof t.title === 'string' ? t.title : (t.title as any)?.[selectedLanguage] || '',
            completed: t.completed,
          })),
          language: selectedLanguage,
        });

        if (safeReply && safeReply.trim()) {
          setAssistantReply(safeReply);
          setVoiceState('GENERATING_AUDIO');
          const audioBase64 = await bhashiniVoiceService.textToSpeech(safeReply, selectedLanguage, 'female');
          setLastAudioBase64(audioBase64);
          setVoiceState('SPEAKING');
          await bhashiniVoiceService.speakText(safeReply, selectedLanguage, audioBase64);
          setVoiceState('READY');
          return;
        }
      } catch (safeErr) {
        console.warn('[BhashiniVoiceAssistant] Secondary fallback note:', safeErr);
      }

      setVoiceState('READY');
      const errCode = (err.code || err.message) as VoiceErrorCode;
      const displayMessage =
        VOICE_ERROR_MESSAGES[errCode] ||
        err.message ||
        VOICE_ERROR_MESSAGES.GEMINI_ERROR;
      setErrorMessage(displayMessage);
    } finally {
      isProcessingRef.current = false;
    }
  };

  // Replay the synthesized audio response
  const handlePlayAgain = async () => {
    if (!assistantReply) return;
    setVoiceState('SPEAKING');

    try {
      await bhashiniVoiceService.speakText(
        assistantReply,
        selectedLanguage,
        lastAudioBase64
      );
    } catch (e) {
      console.warn('[BhashiniVoiceAssistant] Play again notice:', e);
    } finally {
      setVoiceState('READY');
    }
  };

  // State flow titles matching Section 12
  const getStatusDisplay = () => {
    switch (voiceState) {
      case 'LISTENING':
        return {
          title: 'Listening...',
          sub: `Speak clearly in ${
            VOICE_LANGUAGES.find((l) => l.code === selectedLanguage)?.name
          } (${recordingSeconds}s)`,
          color: 'text-rose-400',
        };
      case 'UNDERSTANDING':
      case 'PROCESSING_STT':
        return {
          title: 'Understanding...',
          sub: 'Transcribing speech with Bhashini...',
          color: 'text-amber-300',
        };
      case 'TRANSLATING':
        return {
          title: 'Translating...',
          sub: `Translating ${
            VOICE_LANGUAGES.find((l) => l.code === selectedLanguage)?.name
          } to English for AI...`,
          color: 'text-indigo-300',
        };
      case 'THINKING':
      case 'PROCESSING_AI':
        return {
          title: 'Thinking...',
          sub: 'Checking your daily routine, plan & reminders...',
          color: 'text-sky-300',
        };
      case 'TRANSLATING_RESPONSE':
        return {
          title: 'Preparing your answer...',
          sub: `Translating response to ${
            VOICE_LANGUAGES.find((l) => l.code === selectedLanguage)?.nativeName
          }...`,
          color: 'text-purple-300',
        };
      case 'GENERATING_AUDIO':
        return {
          title: 'Preparing voice...',
          sub: `Generating ${
            VOICE_LANGUAGES.find((l) => l.code === selectedLanguage)?.nativeName
          } speech...`,
          color: 'text-teal-300',
        };
      case 'SPEAKING':
      case 'PLAYING_AUDIO':
        return {
          title: 'Speaking...',
          sub: 'Listen to your voice companion',
          color: 'text-emerald-300',
        };
      case 'ERROR':
        return {
          title: 'Notice',
          sub: 'Tap below to try again',
          color: 'text-amber-300',
        };
      case 'READY':
      case 'IDLE':
      default:
        return {
          title: 'Ready to listen',
          sub: `Tap the microphone to speak in ${
            VOICE_LANGUAGES.find((l) => l.code === selectedLanguage)?.nativeName
          }`,
          color: 'text-slate-300',
        };
    }
  };

  const status = getStatusDisplay();
  const isBusy =
    voiceState === 'UNDERSTANDING' ||
    voiceState === 'PROCESSING_STT' ||
    voiceState === 'TRANSLATING' ||
    voiceState === 'THINKING' ||
    voiceState === 'PROCESSING_AI' ||
    voiceState === 'TRANSLATING_RESPONSE' ||
    voiceState === 'GENERATING_AUDIO';

  const isSpeaking =
    voiceState === 'SPEAKING' || voiceState === 'PLAYING_AUDIO';

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
                  if (
                    voiceState === 'READY' ||
                    voiceState === 'IDLE' ||
                    voiceState === 'ERROR'
                  ) {
                    setSelectedLanguage(lang.code);
                    setUserTranscript('');
                    setAssistantReply('');
                    setErrorMessage('');
                    setConversationHistory([]);
                  }
                }}
                disabled={isBusy || voiceState === 'LISTENING' || isSpeaking}
                className={`text-xs px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <span>{lang.nativeName}</span>
                <span className="text-[10px] ml-1 opacity-70 uppercase">
                  ({lang.code})
                </span>
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
          {isSpeaking && (
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
              <span className="text-[10px] font-black uppercase tracking-wider">
                Stop
              </span>
            </button>
          ) : isBusy ? (
            <div className="relative w-20 h-20 rounded-full bg-[#07192C] border-4 border-blue-400/40 flex flex-col items-center justify-center text-blue-300 shadow-xl">
              <Loader2 className="w-7 h-7 animate-spin text-emerald-400 mb-0.5" />
              <span className="text-[9px] font-bold uppercase tracking-wider">
                Wait
              </span>
            </div>
          ) : isSpeaking ? (
            <button
              type="button"
              onClick={() => {
                bhashiniVoiceService.stopPlayback();
                setVoiceState('READY');
              }}
              className="relative w-20 h-20 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex flex-col items-center justify-center shadow-xl shadow-emerald-950/50 hover:scale-105 active:scale-95 transition-all cursor-pointer border-4 border-emerald-300/40"
              title="Stop speaking"
            >
              <Square className="w-6 h-6 fill-white mb-0.5" />
              <span className="text-[9px] font-black uppercase tracking-wider">
                Stop
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStartRecording}
              className="relative w-20 h-20 rounded-full bg-gradient-to-tr from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-500 text-white flex flex-col items-center justify-center shadow-xl shadow-emerald-950/50 hover:scale-105 active:scale-95 transition-all cursor-pointer border-4 border-emerald-300/40 group"
              title="Tap to start speaking"
            >
              <Mic className="w-8 h-8 group-hover:scale-110 transition-transform mb-0.5" />
              <span className="text-[9px] font-black uppercase tracking-wider">
                Tap to Speak
              </span>
            </button>
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
            <span
              className="w-1.5 h-3 bg-rose-400 rounded-full animate-bounce"
              style={{ animationDelay: '0ms' }}
            />
            <span
              className="w-1.5 h-5 bg-rose-400 rounded-full animate-bounce"
              style={{ animationDelay: '150ms' }}
            />
            <span
              className="w-1.5 h-7 bg-rose-400 rounded-full animate-bounce"
              style={{ animationDelay: '300ms' }}
            />
            <span
              className="w-1.5 h-4 bg-rose-400 rounded-full animate-bounce"
              style={{ animationDelay: '450ms' }}
            />
            <span
              className="w-1.5 h-2 bg-rose-400 rounded-full animate-bounce"
              style={{ animationDelay: '600ms' }}
            />
          </div>
        )}

        {/* Speaking Equalizer Indicator */}
        {isSpeaking && (
          <div className="flex items-center gap-1.5 mt-2.5">
            <span className="w-1.5 h-3 bg-emerald-400 rounded-full animate-pulse" />
            <span
              className="w-1.5 h-6 bg-emerald-400 rounded-full animate-pulse"
              style={{ animationDelay: '100ms' }}
            />
            <span
              className="w-1.5 h-4 bg-emerald-400 rounded-full animate-pulse"
              style={{ animationDelay: '200ms' }}
            />
            <span
              className="w-1.5 h-7 bg-emerald-400 rounded-full animate-pulse"
              style={{ animationDelay: '300ms' }}
            />
            <span
              className="w-1.5 h-3 bg-emerald-400 rounded-full animate-pulse"
              style={{ animationDelay: '400ms' }}
            />
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
                    disabled={isSpeaking}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white text-[11px] font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                  >
                    <Volume2 className="w-3 h-3" />
                    <span>{isSpeaking ? 'Speaking...' : 'Play Again'}</span>
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
          <span>
            Tap to ask in{' '}
            {VOICE_LANGUAGES.find((l) => l.code === selectedLanguage)?.name}:
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {suggestions[selectedLanguage]?.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                if (
                  voiceState === 'READY' ||
                  voiceState === 'IDLE' ||
                  voiceState === 'ERROR'
                ) {
                  setUserTranscript(item.text);
                  processPatientAIQuery(item.text);
                }
              }}
              disabled={isBusy || isSpeaking || voiceState === 'LISTENING'}
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
