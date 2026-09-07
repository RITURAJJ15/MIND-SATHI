import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../hooks/useLanguage';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { speechService } from '../services/speechService';
import {
  Send, Bot, User, Volume2, RefreshCw, Brain, Heart, Bell,
  Gamepad2, Phone, HelpCircle, Mic, MicOff, Square, Sparkles, WifiOff,
  Globe, Check, VolumeX, AlertCircle, Loader2
} from 'lucide-react';
import { geminiService } from '../services/geminiService';
import { familyService } from '../services/familyService';
import { reminderService } from '../services/reminderService';
import { dailyPlanService } from '../services/dailyPlanService';
import { caregiverService } from '../services/caregiverService';
import { SupportedLanguage } from '../types/user';

export type AILanguage = 'as' | 'bn' | 'hi' | 'en';

interface Message {
  id: string;
  role: 'assistant' | 'user';
  text: string;
  time: string;
  language?: AILanguage;
}

const getTime = () => new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

export const AI_LANGUAGES = [
  { id: 'as' as AILanguage, label: 'অসমীয়া', sub: 'Assamese', tag: 'as-IN', flag: '🌾' },
  { id: 'bn' as AILanguage, label: 'বাংলা', sub: 'Bengali', tag: 'bn-IN', flag: '🌺' },
  { id: 'hi' as AILanguage, label: 'हिन्दी', sub: 'Hindi', tag: 'hi-IN', flag: '🪔' },
  { id: 'en' as AILanguage, label: 'English', sub: 'English', tag: 'en-IN', flag: '🌐' },
];

const QUICK_CHIPS = [
  {
    icon: Gamepad2,
    label: {
      as: 'মগজুৰ খেল পৰামৰ্শ দিয়ক',
      bn: 'একটি ব্রেন গেম সুপারিশ করুন',
      hi: 'दिमागी खेल सुझाएं',
      en: 'Recommend a brain game',
    },
    color: 'bg-amber-100 text-amber-900 border-amber-300',
  },
  {
    icon: Bell,
    label: {
      as: 'আজিৰ দৰবসমূহ চাওক',
      bn: 'আজকের ওষুধগুলো দেখুন',
      hi: 'आज की दवाएं बताएं',
      en: 'Check my medicines today',
    },
    color: 'bg-blue-100 text-blue-900 border-blue-300',
  },
  {
    icon: Heart,
    label: {
      as: 'উত্তৰ-পূৰ্বৰ লোককথা কওক',
      bn: 'একটি সুন্দর লোকগাথা শোনান',
      hi: 'पूर्वोत्तर की लोककथा सुनाएं',
      en: 'Tell me a Northeast folklore story',
    },
    color: 'bg-rose-100 text-rose-900 border-rose-300',
  },
  {
    icon: Phone,
    label: {
      as: 'মোৰ পৰিয়ালক ফোন কৰক',
      bn: 'পরিবারকে ফোন করতে সাহায্য করুন',
      hi: 'परिवार से संपर्क में मदद करें',
      en: 'Help me call my family',
    },
    color: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  },
  {
    icon: Brain,
    label: {
      as: 'স্মৃতিশক্তি কেনেকৈ সতেজ ৰাখিম?',
      bn: 'স্মৃতিশক্তি কীভাবে ভালো রাখব?',
      hi: 'याददाश्त कैसे दुरुस्त रखें?',
      en: 'How to keep memory sharp?',
    },
    color: 'bg-teal-100 text-teal-900 border-teal-300',
  },
  {
    icon: HelpCircle,
    label: {
      as: 'আয়ুষ্মান ভাৰতৰ সুবিধা কি?',
      bn: 'আয়ুষ্মান ভারতের সুবিধা কী?',
      hi: 'आयुष्मान भारत के लाभ बताएं',
      en: 'Explain Ayushman Bharat benefits',
    },
    color: 'bg-purple-100 text-purple-900 border-purple-300',
  },
];

const getWelcomeGreeting = (lang: AILanguage, userName: string): string => {
  const name = userName || 'Dada';
  switch (lang) {
    case 'as':
      return `নমস্কাৰ ${name}! 🙏 মই আপোনাৰ মাইণ্ড সাৰথি AI কণ্ঠ সহায়ক। মই আপোনাৰ সৈতে অসমীয়াত কথা পাতিব পাৰোঁ। মাইকত স্পৰ্শ কৰি কওক বা তলত লিখক!`;
    case 'bn':
      return `নমস্কার ${name}! 🙏 আমি আপনার মাইন্ড সাথী AI ভয়েস সহায়ক। আমি বাংলায় কথা বলতে পারি। মাইকে ট্যাপ করে বলুন অথবা টাইপ করুন!`;
    case 'hi':
      return `नमस्ते ${name}! 🙏 मैं आपका माइंड साथी AI सहायक हूँ। आप मुझसे हिन्दी में बोलकर या लिखकर अपनी दवाएं, परिवार या दिमागी खेल के बारे में कुछ भी पूछ सकते हैं!`;
    case 'en':
    default:
      return `Namaste ${name}! 🙏 I am your MIND SATHI two-way voice companion. Tap the microphone to speak, or type below. How may I support your wellness today?`;
  }
};

export const AIAssistantPage: React.FC = () => {
  const { currentLang: globalLang } = useLanguage();
  const { currentUser } = useCurrentUser();

  // Active AI Conversation Language: Assamese, Bengali, Hindi, English
  const initialLang: AILanguage = ['as', 'bn', 'hi', 'en'].includes(globalLang as any)
    ? (globalLang as AILanguage)
    : 'hi';

  const [aiLang, setAiLang] = useState<AILanguage>(initialLang);
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      id: 'welcome',
      role: 'assistant',
      text: getWelcomeGreeting(initialLang, currentUser?.preferredName || currentUser?.name || ''),
      time: getTime(),
      language: initialLang,
    },
  ]);

  const [input, setInput] = useState('');
  const [interimText, setInterimText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Connectivity detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => {
      setIsOnline(false);
      speechService.stop();
      setIsAiSpeaking(false);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
      setIsListening(false);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Listen to TTS speech service state
  useEffect(() => {
    const unsub = speechService.subscribe((speaking) => {
      setIsAiSpeaking(speaking);
    });
    return () => {
      unsub();
      speechService.stop();
    };
  }, []);

  // Configure Web Speech Recognition for Selected Language
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = true;

    const langTagMap: Record<AILanguage, string> = {
      as: 'as-IN',
      bn: 'bn-IN',
      hi: 'hi-IN',
      en: 'en-IN',
    };
    rec.lang = langTagMap[aiLang] || 'hi-IN';

    rec.onstart = () => {
      setIsListening(true);
      setInterimText('');
    };

    rec.onresult = (event: any) => {
      let finalChunk = '';
      let interimChunk = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalChunk += event.results[i][0].transcript;
        } else {
          interimChunk += event.results[i][0].transcript;
        }
      }

      if (interimChunk) {
        setInterimText(interimChunk);
      }

      if (finalChunk.trim()) {
        setInterimText('');
        sendMessage(finalChunk.trim());
      }
    };

    rec.onerror = (event: any) => {
      console.warn('[SpeechRecognition error]:', event.error);
      setIsListening(false);
      setInterimText('');
    };

    rec.onend = () => {
      setIsListening(false);
      setInterimText('');
    };

    recognitionRef.current = rec;

    return () => {
      try {
        rec.abort();
      } catch {}
    };
  }, [aiLang]);

  // Load real user profile data & Supabase conversation history
  useEffect(() => {
    if (currentUser?.id) {
      familyService.syncFamilyMembersFromDb(currentUser.id);
      reminderService.syncRemindersFromDb(currentUser.id);

      // Restore Supabase conversation history
      geminiService.getConversationHistory(currentUser.id).then((history) => {
        if (history && history.length > 0) {
          const loaded: Message[] = history.map((h) => ({
            id: h.id,
            role: h.role,
            text: h.content,
            time: new Date(h.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
            language: aiLang,
          }));
          setMessages((prev) => [prev[0], ...loaded]);
        }
      });
    }
  }, [currentUser?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, interimText]);

  // Change Active Conversation Language
  const handleSelectLanguage = (newLang: AILanguage) => {
    if (newLang === aiLang) return;
    speechService.stop();
    setAiLang(newLang);

    // Welcome user in the newly selected language
    const welcome = getWelcomeGreeting(newLang, currentUser?.preferredName || currentUser?.name || '');
    setMessages((prev) => [
      ...prev,
      {
        id: `lang-switch-${Date.now()}`,
        role: 'assistant',
        text: welcome,
        time: getTime(),
        language: newLang,
      },
    ]);

    // Automatically speak the greeting in the newly selected language
    speechService.speak(welcome, newLang as SupportedLanguage);
  };

  // Toggle Voice Recording
  const toggleListening = () => {
    if (!isOnline) {
      alert('AI Sathi voice conversation requires an active internet connection.');
      return;
    }

    if (!speechSupported) {
      alert('Speech recognition is not available in this browser. Please use Chrome, Edge, or type below.');
      return;
    }

    if (isListening) {
      try {
        recognitionRef.current?.stop();
      } catch {}
      setIsListening(false);
      setInterimText('');
    } else {
      try {
        speechService.stop(); // Stop any currently playing TTS audio before listening
        recognitionRef.current?.start();
      } catch (e) {
        console.warn('Speech start error:', e);
      }
    }
  };

  // Send Message: Process through Gemini and automatically read response aloud
  const sendMessage = async (text: string) => {
    if (!text.trim()) return;

    // Check offline
    if (!navigator.onLine) {
      const offlineMsg =
        aiLang === 'as'
          ? 'নমস্কাৰ! 🙏 AI সাৰথিৰ কণ্ঠ বাৰ্তাৰ বাবে সক্ৰিয় ইন্টাৰনেটৰ প্ৰয়োজন। আপোনাৰ সকলো খেল আৰু সোঁৱৰণী অফলাইনত সুৰক্ষিতভাৱে চলি আছে।'
          : aiLang === 'bn'
          ? 'নমস্কার! 🙏 AI সাথীর ভয়েস বার্তার জন্য সক্রিয় ইন্টারনেট সংযোগ প্রয়োজন। আপনার খেলা এবং রুটিন অফলাইনে নিরাপদে কাজ করছে।'
          : aiLang === 'hi'
          ? 'नमस्ते! 🙏 AI साथी की आवाज़ और बातचीत के लिए सक्रिय इंटरनेट की आवश्यकता है। आपके सभी खेल और दवाएं ऑफलाइन सुरक्षित रूप से काम कर रही हैं।'
          : 'AI Sathi voice conversation requires an active internet connection. Your cognitive games, reminders, and family photos continue working offline.';

      const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', text, time: getTime(), language: aiLang };
      const assistantMsg: Message = { id: `a-${Date.now()}`, role: 'assistant', text: offlineMsg, time: getTime(), language: aiLang };
      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setInput('');
      return;
    }

    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', text, time: getTime(), language: aiLang };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    const activeUserId = currentUser?.id || 'current-user';
    const familyMembers = familyService.getFamilyMembersForUser(activeUserId);
    const reminders = reminderService.getRemindersForUser(activeUserId);
    const dailyPlan = dailyPlanService.getDailyPlan(activeUserId);
    const caregiver = caregiverService.getCaregiverForUser(activeUserId);

    const historyForAi = messages.slice(-8).map((m) => ({
      role: m.role,
      content: m.text,
    }));

    try {
      const reply = await geminiService.chatWithMemoryAssistant({
        userId: activeUserId,
        message: text,
        history: historyForAi,
        userProfile: currentUser,
        familyMembers,
        reminders,
        dailyPlanTasks: dailyPlan.tasks.map((t) => ({
          title: t.title[aiLang] || t.title.en,
          completed: t.completed,
        })),
        caregiverName: caregiver?.name || 'Priya',
        language: aiLang,
      });

      const aiMsg: Message = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: reply,
        time: getTime(),
        language: aiLang,
      };

      setMessages((prev) => [...prev, aiMsg]);

      // TWO-WAY VOICE FLOW: Patient hears the response automatically in the chosen language!
      speechService.speak(reply, aiLang as SupportedLanguage);
    } catch (err) {
      console.warn('AI Assistant error:', err);
      const fallbackReplies: Record<AILanguage, string> = {
        as: 'নমস্কাৰ! 🙏 মই আপোনাৰ মাইণ্ড সাৰথি AI। আপোনাৰ প্ৰশ্নৰ উত্তৰ দিবলৈ মই সাজু আছোঁ। পুনৰ সুধিব নেকি?',
        bn: 'নমস্কার! 🙏 আমি আপনার মাইন্ড সাথী AI। আমি আপনার উত্তর দিতে প্রস্তুত। দয়া করে আবার বলুন।',
        hi: 'नमस्ते! 🙏 मैं आपका माइंड साथी AI हूँ। कृपया अपना प्रश्न दोबारा पूछें, मैं उत्तर देने के लिए तैयार हूँ।',
        en: 'Namaste! 🙏 I am your MIND SATHI companion. Please ask again, I am right here with you.',
      };
      const fallbackMsg: Message = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: fallbackReplies[aiLang] || fallbackReplies.en,
        time: getTime(),
        language: aiLang,
      };
      setMessages((prev) => [...prev, fallbackMsg]);
      speechService.speak(fallbackMsg.text, aiLang as SupportedLanguage);
    } finally {
      setIsTyping(false);
    }
  };

  const handleChip = (chip: typeof QUICK_CHIPS[0]) => {
    const text = chip.label[aiLang] || chip.label.en;
    sendMessage(text);
  };

  const handleStopAudio = () => {
    speechService.stop();
    setIsAiSpeaking(false);
  };

  const handleReplayAudio = (text: string, msgLang?: AILanguage) => {
    speechService.stop();
    speechService.speak(text, (msgLang || aiLang) as SupportedLanguage);
  };

  const clearChat = () => {
    speechService.stop();
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        text: getWelcomeGreeting(aiLang, currentUser?.preferredName || currentUser?.name || ''),
        time: getTime(),
        language: aiLang,
      },
    ]);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-13rem)] sm:h-[calc(100vh-12rem)] max-w-3xl mx-auto animate-fade-in">
      {/* ── 1. Top Header Banner ────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-violet-800 via-purple-700 to-indigo-800 text-white p-4 sm:p-5 rounded-3xl shadow-elder mb-3 border border-violet-400/30">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0 shadow-inner">
              <Bot className="w-6 h-6 sm:w-7 sm:h-7 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black tracking-tight">
                  MIND SATHI AI
                </h1>
                <span className="text-[10px] font-extrabold bg-amber-400 text-purple-950 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                  <Sparkles className="w-3 h-3 text-purple-900" />
                  TWO-WAY VOICE
                </span>
              </div>
              <p className="text-violet-200 text-xs font-semibold mt-0.5">
                {aiLang === 'as' ? 'অসমীয়া, বাংলা, হিন্দী আৰু ইংৰাজীত দুমুখীয়া কণ্ঠ বাৰ্তালাপ'
                  : aiLang === 'bn' ? 'বাংলা, অসমীয়া, হিন্দি ও ইংরেজিতে দ্বিমুখী ভয়েস কথোপকথন'
                  : aiLang === 'hi' ? 'हिन्दी, असमिया, बांग्ला एवं अंग्रेज़ी में दो-तरफ़ा आवाज़ संवाद'
                  : 'Two-way voice assistant in Assamese, Bengali, Hindi & English'}
              </p>
            </div>
          </div>

          {/* Quick Header Actions: Audio Stop / Replay / Clear */}
          <div className="flex items-center gap-2 self-end sm:self-center">
            {isAiSpeaking ? (
              <button
                onClick={handleStopAudio}
                type="button"
                className="px-3.5 py-1.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-md animate-pulse"
                title="Stop speech output"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop Speaking</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === 'assistant');
                  if (lastAssistantMsg) handleReplayAudio(lastAssistantMsg.text, lastAssistantMsg.language);
                }}
                type="button"
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-violet-200 hover:text-white cursor-pointer transition-all"
                title="Replay last answer"
              >
                <Volume2 className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={clearChat}
              type="button"
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer transition-all"
              title="Clear chat"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Dedicated Language Selector Bar (Assamese, Bengali, Hindi, English) ── */}
        <div className="mt-3.5 pt-3 border-t border-white/15 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-violet-200 font-bold">
            <Globe className="w-4 h-4 text-amber-300" />
            <span className="hidden xs:inline">Select Conversation Language:</span>
            <span className="xs:hidden">Language:</span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {AI_LANGUAGES.map((l) => {
              const isSelected = aiLang === l.id;
              return (
                <button
                  key={l.id}
                  onClick={() => handleSelectLanguage(l.id)}
                  type="button"
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-amber-400 text-purple-950 shadow-md ring-2 ring-white scale-105'
                      : 'bg-white/15 text-white hover:bg-white/25 border border-white/20'
                  }`}
                >
                  <span>{l.flag}</span>
                  <span>{l.label}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Offline Mode Notice ────────────────────────────────────────── */}
      {!isOnline && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-400 text-amber-950 p-3.5 rounded-2xl mb-2.5 flex items-center gap-3 shadow-xs animate-fade-in">
          <div className="w-9 h-9 rounded-xl bg-amber-200 flex items-center justify-center shrink-0 text-amber-900">
            <WifiOff className="w-5 h-5" />
          </div>
          <div className="text-xs leading-relaxed font-semibold">
            <strong className="text-amber-900 block sm:inline mr-1 font-black">
              AI Sathi voice requires an internet connection:
            </strong>
            {aiLang === 'as'
              ? 'কণ্ঠ বাৰ্তাৰ বাবে ইন্টাৰনেট সংযোগৰ প্ৰয়োজন। আপোনাৰ সকলো খেল, সোঁৱৰণী আৰু পাৰিবাৰিক ফটো অফলাইনত সম্পূৰ্ণভাৱে চলি আছে।'
              : aiLang === 'bn'
              ? 'ভয়েস চ্যাটের জন্য ইন্টারনেট সংযোগ প্রয়োজন। আপনার সব খেলা ও ওষুধ অফলাইনে সুরক্ষিত ও উপলব্ধ রয়েছে।'
              : aiLang === 'hi'
              ? 'आवाज़ संवाद के लिए इंटरनेट आवश्यक है। आपके खेल, दवा की यादें और परिवार की तस्वीरें बिना इंटरनेट के पूरी तरह सुरक्षित हैं।'
              : 'All your cognitive games, daily plan, and reminders continue working offline! Voice chat will resume when reconnected.'}
          </div>
        </div>
      )}

      {/* ── Live Listening Waveform Banner ─────────────────────────────── */}
      {isListening && (
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white px-4 py-3 rounded-2xl mb-2.5 flex items-center justify-between shadow-lg animate-pulse">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-white/25 flex items-center justify-center shrink-0 animate-ping">
              <Mic className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-black flex items-center gap-2">
                <span>
                  {aiLang === 'as' ? 'মাইক শুনি আছে... অনুগ্ৰহ কৰি কওক'
                    : aiLang === 'bn' ? 'মাইক শুনছে... দয়া করে বলুন'
                    : aiLang === 'hi' ? 'माइक सुन रहा है... कृपया बोलिए'
                    : 'Listening in English... Speak now'}
                </span>
                <span className="text-[11px] font-mono opacity-80 uppercase">({aiLang})</span>
              </div>
              {interimText && (
                <p className="text-xs text-amber-200 italic truncate font-medium mt-0.5">
                  "{interimText}"
                </p>
              )}
            </div>
          </div>
          <button
            onClick={toggleListening}
            type="button"
            className="text-xs font-black bg-white text-red-700 px-3 py-1.5 rounded-xl shadow-sm cursor-pointer hover:bg-red-50 shrink-0 ml-2"
          >
            Cancel
          </button>
        </div>
      )}

      {/* ── Live AI Speaking Bar ────────────────────────────────────────── */}
      {isAiSpeaking && !isListening && (
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-blue-600 text-white px-4 py-2 rounded-2xl mb-2.5 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2.5">
            <Volume2 className="w-5 h-5 text-amber-300 animate-bounce" />
            <span className="text-xs sm:text-sm font-black">
              {aiLang === 'as' ? 'মাইণ্ড সাৰথিয়ে কথা কৈ আছে...'
                : aiLang === 'bn' ? 'মাইন্ড সাথী উত্তর দিচ্ছে...'
                : aiLang === 'hi' ? 'माइंड साथी बोल रहे हैं...'
                : 'AI Sathi is speaking response...'}
            </span>
          </div>
          <button
            onClick={handleStopAudio}
            type="button"
            className="text-xs font-bold bg-white/20 hover:bg-white/30 text-white px-2.5 py-1 rounded-xl cursor-pointer flex items-center gap-1"
          >
            <Square className="w-3 h-3 fill-white" />
            <span>Stop</span>
          </button>
        </div>
      )}

      {/* ── Quick Suggestion Chips (Multilingual) ─────────────────────── */}
      <div className="mb-2.5 overflow-x-auto scrollbar-none">
        <div className="flex gap-2 pb-1" style={{ minWidth: 'max-content' }}>
          {QUICK_CHIPS.map((chip, i) => {
            const Icon = chip.icon;
            const label = chip.label[aiLang] || chip.label.en;
            return (
              <button
                key={i}
                onClick={() => handleChip(chip)}
                type="button"
                className={`px-3 py-1.5 rounded-2xl border text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer hover:opacity-85 transition-all shadow-2xs ${chip.color}`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Chat Messages Scroll Area ───────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto space-y-3.5 pr-1">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex gap-2.5 sm:gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {/* Avatar */}
              <div
                className={`w-9 h-9 rounded-2xl shrink-0 flex items-center justify-center text-white font-black shadow-sm ${
                  isUser
                    ? 'bg-gradient-to-br from-amber-500 to-orange-600'
                    : 'bg-gradient-to-br from-violet-600 to-purple-700'
                }`}
              >
                {isUser ? <User className="w-4 h-4" /> : <Bot className="w-5 h-5 text-amber-300" />}
              </div>

              {/* Message Bubble */}
              <div className={`max-w-[85%] sm:max-w-[80%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
                <div
                  className={`px-4 py-3 rounded-2xl text-xs sm:text-sm font-medium leading-relaxed whitespace-pre-wrap shadow-xs ${
                    isUser
                      ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-tr-none'
                      : 'bg-white border border-gray-200 text-gray-900 rounded-tl-none'
                  }`}
                >
                  {msg.text}
                </div>

                {/* Message Meta & Speak Replay */}
                <div className="flex items-center gap-2.5 mt-1 px-1">
                  <span className="text-[10px] text-gray-400 font-mono">{msg.time}</span>
                  {!isUser && (
                    <button
                      onClick={() => handleReplayAudio(msg.text, msg.language)}
                      type="button"
                      className="text-[11px] text-violet-600 hover:text-violet-800 font-bold cursor-pointer flex items-center gap-1 bg-violet-50 hover:bg-violet-100 px-2 py-0.5 rounded-lg border border-violet-200 transition-all"
                      title="Listen to this response aloud"
                    >
                      <Volume2 className="w-3 h-3 text-violet-600" />
                      <span>Listen</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Typing Indicator */}
        {isTyping && (
          <div className="flex gap-2.5 sm:gap-3 items-center">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5 text-amber-300 animate-spin" />
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-2 shadow-xs">
              <span className="text-xs font-bold text-violet-700">
                {aiLang === 'as' ? 'সাৰথিয়ে চিন্তা কৰি আছে...'
                  : aiLang === 'bn' ? 'সাথী ভাবছেন...'
                  : aiLang === 'hi' ? 'साथी विचार कर रहे हैं...'
                  : 'AI Sathi is answering...'}
              </span>
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── 3. Bottom Two-Way Input Bar ───────────────────────────────── */}
      <div className="mt-2.5 bg-white rounded-3xl border-2 border-gray-200 shadow-elder p-2 flex items-center gap-2">
        {/* Large Tap to Speak Microphone Button */}
        <button
          onClick={toggleListening}
          type="button"
          disabled={!isOnline}
          className={`p-3 sm:p-3.5 rounded-2xl cursor-pointer transition-all flex items-center justify-center shrink-0 ${
            !isOnline
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : isListening
              ? 'bg-red-600 text-white animate-pulse ring-4 ring-red-200 shadow-md scale-105'
              : 'bg-violet-600 hover:bg-violet-700 text-white shadow-sm hover:scale-102'
          }`}
          title={
            !isOnline
              ? 'Voice requires internet connection'
              : isListening
              ? 'Stop microphone'
              : `Tap to speak in ${aiLang.toUpperCase()}`
          }
          aria-label="Voice input"
        >
          {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5 text-amber-300" />}
        </button>

        {/* Text Input (Fallback) */}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
          placeholder={
            isListening
              ? (aiLang === 'as' ? 'কওক...' : aiLang === 'bn' ? 'বলুন...' : aiLang === 'hi' ? 'बोलिए...' : 'Listening...')
              : (aiLang === 'as'
                  ? 'প্ৰশ্ন কৰক বা মাইকত স্পৰ্শ কৰি কওক...'
                  : aiLang === 'bn'
                  ? 'প্রশ্ন করুন বা মাইক চেপে বলুন...'
                  : aiLang === 'hi'
                  ? 'प्रश्न पूछें या माइक दबाकर बोलें...'
                  : 'Ask a question or tap the mic to speak...')
          }
          className="flex-1 bg-transparent text-xs sm:text-sm font-semibold text-gray-900 placeholder:text-gray-400 outline-none px-2"
        />

        {/* Send Button */}
        <button
          onClick={() => sendMessage(input)}
          type="button"
          disabled={!input.trim()}
          className="p-3 sm:p-3.5 rounded-2xl bg-amber-500 hover:bg-amber-600 disabled:bg-gray-200 text-white cursor-pointer transition-all shadow-sm shrink-0"
          title="Send message"
          aria-label="Send"
        >
          <Send className="w-4 h-4 sm:w-5 sm:h-5 text-purple-950" />
        </button>
      </div>

      {/* Safety & Non-Diagnostic Disclaimer */}
      <p className="text-center text-[10px] text-gray-400 mt-1.5 font-medium leading-tight">
        🔒 MIND SATHI AI is a supportive cognitive companion grounded in your verified Supabase records. Does not provide medical diagnoses.
      </p>
    </div>
  );
};
