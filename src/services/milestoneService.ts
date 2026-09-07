import { GameSession } from '../types/game';
import { UserProfile, AccessibilitySettings } from '../types/user';
import { FamilyMember } from '../types/family';
import { DailyPlan } from '../types/plan';
import { supabase } from '../lib/supabase';
import { authService } from './authService';

export interface MilestoneBadge {
  id: string;
  title: { en: string; hi: string; as: string; [key: string]: string };
  desc: { en: string; hi: string; as: string; [key: string]: string };
  icon: string;
  category: 'starter' | 'streak' | 'mastery' | 'family' | 'focus' | 'plan';
  unlocked: boolean;
  progress: {
    current: number;
    target: number;
    fractionText: string;
    percent: number;
  };
  unlockedAt?: string;
}

class MilestoneService {
  /**
   * Calculates and evaluates all milestone badges dynamically based on
   * actual user activity: game sessions, streak, XP, family members, and daily plan.
   */
  public evaluateBadges(
    user: UserProfile,
    sessions: GameSession[],
    familyMembers: FamilyMember[],
    todayPlan?: DailyPlan
  ): MilestoneBadge[] {
    const userSessions = sessions.filter((s) => s.userId === user.id);

    // Smriti Sangam stats
    const smritiSessions = userSessions.filter((s) => s.gameId === 'smriti_sangam');
    const smritiMaxAcc = smritiSessions.reduce((max, s) => Math.max(max, s.accuracy), 0);

    // Bazaar Hisaab stats
    const bazaarSessions = userSessions.filter((s) => s.gameId === 'bazaar_hisaab');
    const bazaarMaxAcc = bazaarSessions.reduce((max, s) => Math.max(max, s.accuracy), 0);

    // Dhyan Kendra focus speed stats
    const dhyanSessions = userSessions.filter((s) => s.gameId === 'dhyan_kendra');
    const hasFastFocus = dhyanSessions.some(
      (s) => s.reactionTimeMs && s.reactionTimeMs > 0 && s.reactionTimeMs < 1000
    );

    // Plan stats
    const planTasksCount = todayPlan?.tasks?.length || 6;
    const planCompletedCount = todayPlan?.tasks?.filter((t) => t.completed).length || 0;
    const isPlanAllDone = todayPlan?.isAllCompleted || false;

    // Badges definitions with verifiable metrics
    const badges: MilestoneBadge[] = [
      {
        id: 'b-first-game',
        title: { en: 'Pratham Kadam', hi: 'प्रथम कदम', as: 'প্ৰথম পদক্ষেপ' },
        desc: {
          en: 'Complete your first cognitive game session',
          hi: 'पहला दिमागी खेल सफलतापूर्वक पूरा करें',
          as: 'প্ৰথম খেল সফলতাৰে সমাপ্ত কৰক',
        },
        icon: '🌱',
        category: 'starter',
        unlocked: userSessions.length >= 1,
        progress: {
          current: Math.min(1, userSessions.length),
          target: 1,
          fractionText: `${Math.min(1, userSessions.length)} / 1 game`,
          percent: userSessions.length >= 1 ? 100 : 0,
        },
      },
      {
        id: 'b-streak-6',
        title: { en: 'Saptahik Sadhana', hi: 'साप्ताहिक साधना', as: 'সাপ্তাহিক সাধনা' },
        desc: {
          en: 'Practice 6 consecutive days without missing a routine',
          hi: 'लगातार 6 दिन बिना रुके दिमागी अभ्यास करें',
          as: 'ধাৰাবাহিক ৬ দিন খেল সমাপ্ত কৰক',
        },
        icon: '🔥',
        category: 'streak',
        unlocked: user.streakDays >= 6,
        progress: {
          current: Math.min(6, user.streakDays),
          target: 6,
          fractionText: `${user.streakDays} / 6 days`,
          percent: Math.min(100, Math.round((user.streakDays / 6) * 100)),
        },
      },
      {
        id: 'b-smriti-master',
        title: { en: 'Smriti Ratna', hi: 'स्मृति रत्न', as: 'স্মৃতি ৰত্ন' },
        desc: {
          en: 'Achieve 90%+ accuracy in Smriti Sangam (Memory Match)',
          hi: 'स्मृति संगम में 90% से अधिक सही जोड़ियां बनाएं',
          as: 'স্মৃতি সংগমত ৯০% সঠিক উত্তৰ দিয়ক',
        },
        icon: '🧠',
        category: 'mastery',
        unlocked: smritiMaxAcc >= 90,
        progress: {
          current: smritiMaxAcc,
          target: 90,
          fractionText: `${smritiMaxAcc}% / 90% accuracy`,
          percent: Math.min(100, Math.round((smritiMaxAcc / 90) * 100)),
        },
      },
      {
        id: 'b-bazaar-100',
        title: { en: 'Bazaar Master', hi: 'बाज़ार सम्राट', as: 'বজাৰ বিশেষজ্ঞ' },
        desc: {
          en: 'Score 100% in Daily Market Math with accurate change calculation',
          hi: 'बाज़ार हिसाब में शत-प्रतिशत सही उत्तर दें',
          as: 'বজাৰৰ হিচাপত ১০০% শুদ্ধতা লাভ কৰক',
        },
        icon: '🛍️',
        category: 'mastery',
        unlocked: bazaarMaxAcc >= 100,
        progress: {
          current: bazaarMaxAcc,
          target: 100,
          fractionText: `${bazaarMaxAcc}% / 100%`,
          percent: bazaarMaxAcc >= 100 ? 100 : bazaarMaxAcc,
        },
      },
      {
        id: 'b-family-connect',
        title: { en: 'Pariwar Premi', hi: 'परिवार प्रेमी', as: 'পৰিয়াল প্ৰেমী' },
        desc: {
          en: 'Register at least 2 family members with photos and contact details',
          hi: 'कम से कम 2 पारिवारिक सदस्यों को फोटो सहित जोड़ें',
          as: 'কমপক্ষে ২ জন পৰিয়ালৰ সদস্যক ফটোসহ যোগ কৰক',
        },
        icon: '❤️',
        category: 'family',
        unlocked: familyMembers.length >= 2,
        progress: {
          current: Math.min(2, familyMembers.length),
          target: 2,
          fractionText: `${familyMembers.length} / 2 members`,
          percent: Math.min(100, Math.round((familyMembers.length / 2) * 100)),
        },
      },
      {
        id: 'b-fast-focus',
        title: { en: 'Tej Dhyan (Sharp Focus)', hi: 'तेज ध्यान', as: 'তীক্ষ্ণ মনোযোগ' },
        desc: {
          en: 'Achieve quick reaction speed under 1000ms in Focus Pond (Dhyan Kendra)',
          hi: 'ध्यान केंद्र में 1 सेकंड (1000ms) से कम में सही निर्णय लें',
          as: '১ চেকেণ্ডৰ ভিতৰত সঠিক সঁহাৰি দিয়ক',
        },
        icon: '⚡',
        category: 'focus',
        unlocked: hasFastFocus,
        progress: {
          current: hasFastFocus ? 1 : 0,
          target: 1,
          fractionText: hasFastFocus ? '< 1000ms achieved' : 'Pending < 1000ms reaction',
          percent: hasFastFocus ? 100 : 0,
        },
      },
      {
        id: 'b-daily-plan-all',
        title: { en: 'Nitya Sadhak', hi: 'नित्य साधक', as: 'নিত্য সাধক' },
        desc: {
          en: 'Complete all personalized activity plan tasks for the day',
          hi: 'आज की दिनचर्या के सभी निर्धारित कार्यों को पूरा करें',
          as: 'আজিৰ দিনলিপিৰ সকলো কাম সম্পূৰ্ণ কৰক',
        },
        icon: '🎯',
        category: 'plan',
        unlocked: isPlanAllDone,
        progress: {
          current: planCompletedCount,
          target: planTasksCount,
          fractionText: `${planCompletedCount} / ${planTasksCount} tasks`,
          percent: Math.min(100, Math.round((planCompletedCount / planTasksCount) * 100)),
        },
      },
      {
        id: 'b-centurion-xp',
        title: { en: 'Shatak Sathi (Centurion)', hi: 'शतक साथी', as: 'শতক সাথী' },
        desc: {
          en: 'Accumulate 500 or more cognitive vitality points (XP)',
          hi: '500 या उससे अधिक कुल साथी अंक (XP) अर्जित करें',
          as: '৫০০ বা অধিক পইন্ট (XP) অৰ্জন কৰক',
        },
        icon: '🌟',
        category: 'starter',
        unlocked: user.totalXp >= 500,
        progress: {
          current: Math.min(500, user.totalXp),
          target: 500,
          fractionText: `${user.totalXp} / 500 XP`,
          percent: Math.min(100, Math.round((user.totalXp / 500) * 100)),
        },
      },
    ];

    // Asynchronously synchronize unlocked badges to DB if real user
    this.persistBadgesToDb(user.id, badges.filter((b) => b.unlocked).map((b) => b.id));

    return badges;
  }

  private async persistBadgesToDb(userId: string, unlockedBadgeIds: string[]) {
    if (!userId || !userId.includes('-') || userId.length <= 20) return;
    try {
      const defaultAcc: AccessibilitySettings = {
        fontSize: 'normal',
        highContrast: false,
        textToSpeechAuto: false,
        soundEffects: true,
        speechRate: 0.85,
      };
      const user = authService.getCurrentUser();
      const currentAcc = user?.accessibility || defaultAcc;
      const storedBadges = currentAcc.earned_badges || [];

      // Check if there are newly unlocked badges
      const merged = Array.from(new Set([...storedBadges, ...unlockedBadgeIds]));
      if (merged.length !== storedBadges.length) {
        const updatedAcc = { ...defaultAcc, ...currentAcc, earned_badges: merged };
        await supabase
          .from('profiles')
          .update({
            accessibility: updatedAcc,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId);

        authService.updateCurrentUserProfile({ accessibility: updatedAcc });
      }
    } catch (err) {
      console.warn('[MilestoneService] Error saving badges to Supabase:', err);
    }
  }
}

export const milestoneService = new MilestoneService();
