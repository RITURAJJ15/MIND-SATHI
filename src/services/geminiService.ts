/**
 * geminiService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Client-side integration service for Gemini AI features in MIND SATHI:
 * 1. AI Cognitive Personalization (real Supabase game_sessions)
 * 2. AI Sathi Memory Assistant (real Supabase profile, family, reminders)
 * 3. Caregiver AI Insights (real assigned patient & game history)
 *
 * NOTE: All Gemini API calls go through the secure server endpoint `/api/gemini/*`
 * so the API key is NEVER exposed in the client bundle.
 */

import { supabase } from '../lib/supabase';
import { GameSession, CognitiveDomain, DifficultyTier, GameId, GameRecommendation } from '../types/game';
import { UserProfile } from '../types/user';
import { FamilyMember } from '../types/family';
import { Reminder } from '../types/reminder';

export interface AICognitivePersonalizationResult {
  gameId: GameId;
  difficulty: DifficultyTier;
  reason: string;
  domainScores?: Record<CognitiveDomain, number>;
  summary: string;
  source: 'gemini' | 'fallback';
}

export interface CaregiverAIInsightResult {
  cognitiveSummary: string;
  strengths: string[];
  areasForSupport: string[];
  trendAnalysis: string;
  recommendationsForCaregiver: string[];
  riskLevel: 'optimal' | 'stable' | 'attention_recommended';
  generatedAt: string;
  source: 'gemini' | 'fallback';
}

export interface StoredAIChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

class GeminiService {
  /**
   * 1. AI COGNITIVE PERSONALIZATION
   * Analyzes REAL game_sessions from Supabase.
   * Generates personalized game recommendation and difficulty using Gemini.
   * Stores the recommendation in Supabase.
   */
  public async getPersonalizedRecommendation(
    userId: string,
    userName: string,
    language: string = 'en',
    currentScores?: Record<CognitiveDomain, number>
  ): Promise<AICognitivePersonalizationResult> {
    // 1. Fetch real game sessions from Supabase
    let realSessions: any[] = [];
    if (userId && userId.includes('-') && userId.length > 20) {
      try {
        const { data, error } = await supabase
          .from('game_sessions')
          .select('*')
          .eq('patient_id', userId)
          .order('completed_at', { ascending: false })
          .limit(20);

        if (!error && data) {
          realSessions = data.map((d) => ({
            gameId: d.game_id,
            score: d.score,
            accuracy: d.accuracy,
            durationSeconds: d.duration_seconds,
            timestamp: d.completed_at,
            mistakesCount: d.metadata?.mistakesCount ?? 0,
            hintsUsed: d.metadata?.hintsUsed ?? 0,
            difficulty: d.metadata?.difficulty ?? 'saral',
          }));
        }
      } catch (err) {
        console.warn('[GeminiService] Failed to load Supabase game sessions:', err);
      }
    }

    // 2. Call server-side Gemini endpoint
    try {
      const response = await fetch('/api/gemini/personalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          userName,
          language,
          sessions: realSessions,
          currentDomainScores: currentScores,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const validGameId: GameId = [
          'smriti_sangam', 'shabda_mala', 'rangoli_rekha', 'bazaar_hisaab',
          'dhyan_kendra', 'disha_sathi', 'ne_states_memory', 'family_memory'
        ].includes(data.gameId) ? data.gameId : 'smriti_sangam';

        const validDifficulty: DifficultyTier = ['saral', 'madhyam', 'nipun'].includes(data.difficulty)
          ? data.difficulty
          : 'saral';

        const result: AICognitivePersonalizationResult = {
          gameId: validGameId,
          difficulty: validDifficulty,
          reason: data.reason || 'Personalized practice tailored to your cognitive progress today.',
          domainScores: data.domainScores,
          summary: data.summary || 'AI cognitive routine ready.',
          source: 'gemini',
        };

        // 3. Persist recommendation in Supabase
        await this.persistRecommendation(userId, result);
        return result;
      }
    } catch (err) {
      console.warn('[GeminiService] /api/gemini/personalize request failed:', err);
    }

    // Deterministic fallback if offline or server timeout
    return {
      gameId: 'smriti_sangam',
      difficulty: 'saral',
      reason: language === 'hi'
        ? 'दृश्य स्मृति और पारिवारिक यादों के ताज़ातरीन अभ्यास से शुरुआत करें।'
        : 'A gentle visual memory session will boost recall and support cognitive wellness.',
      summary: 'Daily brain stimulation active.',
      source: 'fallback',
    };
  }

  /**
   * Persists AI recommendation into Supabase notifications / recommendations
   */
  private async persistRecommendation(userId: string, rec: AICognitivePersonalizationResult) {
    if (!userId || !userId.includes('-') || userId.length < 20) return;
    try {
      await supabase.from('notifications').insert({
        user_id: userId,
        title: 'AI Game Recommendation',
        message: `${rec.gameId} (${rec.difficulty}): ${rec.reason}`,
        type: 'recommendation',
        is_read: false,
      });
    } catch (e) {
      // Non-blocking
    }
  }

  /**
   * 2. AI SATHI MEMORY ASSISTANT
   * Uses Gemini with the authenticated user's REAL Supabase data:
   * profile, family_members, and reminders.
   * Never invents personal information; stores conversation in Supabase `ai_conversations`.
   */
  public async chatWithMemoryAssistant(params: {
    userId: string;
    message: string;
    history: { role: 'user' | 'assistant'; content: string }[];
    userProfile: UserProfile | null;
    familyMembers: FamilyMember[];
    reminders: Reminder[];
    dailyPlanTasks?: { title: string; completed: boolean }[];
    caregiverName?: string;
    language: string;
    sessionId?: string;
  }): Promise<string> {
    const {
      userId,
      message,
      history,
      userProfile,
      familyMembers,
      reminders,
      dailyPlanTasks = [],
      caregiverName = '',
      language,
      sessionId = 'sathi-session-1'
    } = params;

    // Friendly offline message when internet is unavailable
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      if (language === 'as') {
        return 'নমস্কাৰ! 🙏 AI সাৰথিৰ কণ্ঠ বাৰ্তাৰ বাবে সক্ৰিয় ইন্টাৰনেটৰ প্ৰয়োজন। আপোনাৰ সকলো খেল, দিনলিপি আৰু সোঁৱৰণী অফলাইনত সুৰক্ষিতভাৱে চলি আছে। ইন্টাৰনেট সংযোগ হোৱাৰ লগে লগে মই পুনৰ সাজু হ\'ম!';
      }
      if (language === 'bn') {
        return 'নমস্কার! 🙏 AI সাথীর ভয়েস বার্তার জন্য সক্রিয় ইন্টারনেট সংযোগ প্রয়োজন। আপনার সব খেলা, রুটিন এবং অনুস্মারকগুলি অফলাইনে নিরাপদে কাজ করছে। ইন্টারনেট ফিরলেই আমি আবার কথা বলব!';
      }
      if (language === 'hi') {
        return 'नमस्ते! 🙏 AI साथी की आवाज़ और बातचीत के लिए सक्रिय इंटरनेट की आवश्यकता है। आपके सभी दिमागी खेल, दिनचर्या और दवाएं ऑफलाइन सुरक्षित रूप से काम कर रही हैं। इंटरनेट वापस आते ही मैं आपकी सेवा में उपलब्ध रहूँगा!';
      }
      return 'Namaste! 🙏 AI Sathi voice requires an active internet connection. All your cognitive games, daily activity plans, and reminders continue working smoothly offline! I will be ready to chat as soon as your connection returns.';
    }

    // 1. Persist user message to Supabase ai_conversations
    if (userId && userId.includes('-') && userId.length > 20) {
      try {
        await supabase.from('ai_conversations').insert({
          user_id: userId,
          session_id: sessionId,
          role: 'user',
          message: message,
        });
      } catch (err) {
        console.warn('[GeminiService] Error storing user message in ai_conversations:', err);
      }
    }

    // 2. Call backend Gemini endpoint grounded in real data
    try {
      const response = await fetch('/api/gemini/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          history,
          userProfile: {
            name: userProfile?.name,
            preferredName: userProfile?.preferredName,
            age: userProfile?.age,
            city: userProfile?.city,
            state: userProfile?.state,
            isAyushmanMember: userProfile?.isAyushmanMember,
            abhaId: userProfile?.abhaId,
          },
          familyMembers: familyMembers.map((f) => ({
            name: f.name,
            relationship: f.relationship,
            phone: f.phone,
            isFavorite: f.isFavorite,
          })),
          reminders: reminders.map((r) => ({
            title: r.title,
            time: r.time,
            type: r.type,
            dosageOrDetail: r.dosageOrDetail,
            isCompletedToday: r.isCompletedToday,
          })),
          dailyPlanTasks,
          caregiverName,
          language,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const reply = data.reply || 'Namaste! How may I assist your day?';

        // 3. Persist assistant reply to Supabase ai_conversations
        if (userId && userId.includes('-') && userId.length > 20) {
          try {
            await supabase.from('ai_conversations').insert({
              user_id: userId,
              session_id: sessionId,
              role: 'assistant',
              message: reply,
            });
          } catch (err) {
            console.warn('[GeminiService] Error storing assistant message in ai_conversations:', err);
          }
        }

        return reply;
      }
    } catch (err) {
      console.warn('[GeminiService] /api/gemini/assistant error:', err);
    }

    // Fallback grounded answer
    const localizedFallbacks: Record<string, string> = {
      as: 'নমস্কাৰ! 🙏 মই আপোনাৰ মাইণ্ড সাৰথি AI। মই আপোনাৰ লগত আছোঁ। আপোনাৰ পৰিয়াল, দৰব বা খেলৰ বিষয়ে কিবা জানিব বিচাৰে নেকি?',
      bn: 'নমস্কার! 🙏 আমি আপনার মাইন্ড সাথী AI। আমি আপনার সাথেই আছি। আপনার পরিবার, ওষুধ বা খেলা সম্পর্কে কিছু জানতে চান?',
      hi: 'नमस्ते! 🙏 मैं आपका माइंड साथी AI हूँ। मैं आपके साथ हूँ। आज मैं आपकी दवाओं, परिवार या दिमागी खेल में क्या सहायता करूँ?',
      en: 'Namaste! 🙏 I am your MIND SATHI companion. Your family details, daily tasks, and reminders are safely loaded. How may I support you today?',
    };

    return localizedFallbacks[language] || localizedFallbacks.en;
  }

  /**
   * Load previous conversation history from Supabase `ai_conversations`
   */
  public async getConversationHistory(userId: string, sessionId: string = 'sathi-session-1'): Promise<StoredAIChatMessage[]> {
    if (!userId || !userId.includes('-') || userId.length < 20) return [];
    try {
      const { data, error } = await supabase
        .from('ai_conversations')
        .select('*')
        .eq('user_id', userId)
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })
        .limit(40);

      if (!error && data && data.length > 0) {
        return data.map((d) => ({
          id: d.id,
          role: (d.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
          content: d.message || '',
          createdAt: d.created_at,
        }));
      }
    } catch (err) {
      console.warn('[GeminiService] Error reading ai_conversations:', err);
    }
    return [];
  }

  /**
   * 3. CAREGIVER AI INSIGHTS
   * Analyzes REAL assigned patient's game_sessions and activity history from Supabase.
   * Generates cognitive progress/trend summary via Gemini.
   * Stores the insight in Supabase and returns structured metrics.
   */
  public async generateCaregiverInsights(
    caregiverId: string,
    patientId: string,
    language: string = 'en'
  ): Promise<CaregiverAIInsightResult> {
    // 1. Fetch real patient profile
    let patientProfile: any = null;
    let gameSessions: any[] = [];

    if (patientId && patientId.includes('-') && patientId.length > 20) {
      try {
        const { data: pData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', patientId)
          .single();
        if (pData) patientProfile = pData;

        // Fetch real game sessions for this patient
        const { data: gData } = await supabase
          .from('game_sessions')
          .select('*')
          .eq('patient_id', patientId)
          .order('completed_at', { ascending: false })
          .limit(30);

        if (gData) {
          gameSessions = gData.map((d) => ({
            id: d.id,
            gameId: d.game_id,
            score: d.score,
            accuracy: d.accuracy,
            durationSeconds: d.duration_seconds,
            completedAt: d.completed_at,
            mistakes: d.metadata?.mistakesCount ?? 0,
            hintsUsed: d.metadata?.hintsUsed ?? 0,
            difficulty: d.metadata?.difficulty ?? 'saral',
          }));
        }
      } catch (err) {
        console.warn('[GeminiService] Error fetching patient data for caregiver insights:', err);
      }
    }

    // 2. Call backend Gemini endpoint
    try {
      const response = await fetch('/api/gemini/caregiver-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caregiverId,
          patientId,
          patientProfile: patientProfile || { name: 'Senior Elder', age: 72 },
          gameSessions,
          language,
        }),
      });

      if (response.ok) {
        const parsed = await response.json();
        const result: CaregiverAIInsightResult = {
          cognitiveSummary: parsed.cognitiveSummary || 'Patient displays steady engagement across regular cognitive exercises.',
          strengths: parsed.strengths || ['High accuracy in visual matching exercises', 'Active routine participation'],
          areasForSupport: parsed.areasForSupport || ['Gradual pacing with complex arithmetic', 'Gentle encouragement in language retrieval'],
          trendAnalysis: parsed.trendAnalysis || 'Session consistency remains favorable with low mistake variance.',
          recommendationsForCaregiver: parsed.recommendationsForCaregiver || [
            'Maintain morning sessions after breakfast for highest focus.',
            'Encourage shared reminiscence with family photo albums.'
          ],
          riskLevel: ['optimal', 'stable', 'attention_recommended'].includes(parsed.riskLevel)
            ? parsed.riskLevel
            : 'stable',
          generatedAt: new Date().toISOString(),
          source: 'gemini',
        };

        // 3. Persist insight in Supabase notifications for caregiver & patient audit
        if (caregiverId && caregiverId.includes('-') && caregiverId.length > 20) {
          try {
            await supabase.from('notifications').insert({
              user_id: caregiverId,
              title: `AI Cognitive Insight: ${patientProfile?.full_name || 'Patient'}`,
              message: result.cognitiveSummary,
              type: 'caregiver_insight',
              is_read: false,
            });
          } catch (e) {
            // Non-blocking
          }
        }

        return result;
      }
    } catch (err) {
      console.warn('[GeminiService] /api/gemini/caregiver-insights error:', err);
    }

    // Safe non-diagnostic fallback
    return {
      cognitiveSummary: 'Patient demonstrates active cognitive engagement and stable baseline responses across recent sessions.',
      strengths: ['Consistent daily session attendance', 'Favorable visual memory accuracy'],
      areasForSupport: ['Additional time allowance for multi-step executive math'],
      trendAnalysis: 'Cognitive trends indicate steady maintenance of daily routine and pattern recognition.',
      recommendationsForCaregiver: [
        'Continue regular 10-15 minute daily practice.',
        'Pair brain games with calm morning hydration and family phone calls.'
      ],
      riskLevel: 'stable',
      generatedAt: new Date().toISOString(),
      source: 'fallback',
    };
  }
}

export const geminiService = new GeminiService();
