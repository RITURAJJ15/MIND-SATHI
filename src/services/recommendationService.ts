import { CognitiveDomain, DifficultyTier, GameId, GameRecommendation } from '../types/game';
import { COGNITIVE_GAMES } from '../data/mockGames';
import { gameService } from './gameService';
import { authService } from './authService';
import { geminiService, AICognitivePersonalizationResult } from './geminiService';

class RecommendationService {
  private cachedAiRecommendation: GameRecommendation | null = null;
  private lastFetchedUserId: string | null = null;

  public async fetchAiRecommendation(lang: 'en' | 'hi' | 'as' = 'en'): Promise<GameRecommendation> {
    const user = authService.getCurrentUser();
    if (!user) {
      return this.getNextGameRecommendation();
    }

    try {
      const domainScores = gameService.calculateDomainScores(user.id);
      const aiResult: AICognitivePersonalizationResult = await geminiService.getPersonalizedRecommendation(
        user.id,
        user.preferredName || user.name,
        lang,
        domainScores
      );

      const gameMeta = COGNITIVE_GAMES.find((g) => g.id === aiResult.gameId) || COGNITIVE_GAMES[0];
      const rec: GameRecommendation = {
        gameId: aiResult.gameId,
        priority: 'high',
        reason: {
          en: aiResult.reason,
          hi: aiResult.reason,
          as: aiResult.reason,
        },
        suggestedDifficulty: aiResult.difficulty,
        targetDomain: gameMeta.domain,
      };

      this.cachedAiRecommendation = rec;
      this.lastFetchedUserId = user.id;
      return rec;
    } catch (err) {
      console.warn('[RecommendationService] Error in fetchAiRecommendation:', err);
      return this.getNextGameRecommendation();
    }
  }

  public getNextGameRecommendation(): GameRecommendation {
    if (this.cachedAiRecommendation) {
      return this.cachedAiRecommendation;
    }

    const user = authService.getCurrentUser();
    
    // Fallback if no user is found
    if (!user) {
      return {
        gameId: 'smriti_sangam',
        priority: 'high',
        reason: {
          en: 'A quick visual memory session will boost your recall and strengthen neural pathways today.',
          hi: 'आज की शुरुआत दृश्य स्मृति और पारिवारिक यादों के ताज़ातरीन अभ्यास से करें।',
          as: 'আজিৰ দিনটো দৃশ্য স্মৃতি আৰু মনত ৰখাৰ সুন্দৰ অনুশীলনেৰে আৰম্ভ কৰক।',
        },
        suggestedDifficulty: 'saral',
        targetDomain: 'memory',
      };
    }

    const domainScores = gameService.calculateDomainScores(user.id);
    const recentSessions = gameService.getSessionsForUser(user.id);

    // 1. Identify domain needing practice (lowest domain score)
    const domainEntries = Object.entries(domainScores) as [CognitiveDomain, number][];
    domainEntries.sort((a, b) => a[1] - b[1]);
    const lowestDomain = domainEntries[0][0];

    // Map domain to game
    const domainToGameMap: Record<CognitiveDomain, GameId> = {
      memory: 'smriti_sangam',
      language: 'shabda_mala',
      working_memory: 'rangoli_rekha',
      executive: 'bazaar_hisaab',
      attention: 'dhyan_kendra',
      visuospatial: 'disha_sathi',
      northeast_culture: 'ne_states_memory',
      family_reminiscence: 'family_memory',
    };

    let targetGameId: GameId = domainToGameMap[lowestDomain] || 'smriti_sangam';

    // Check if the lowest domain game was just played in the last session, if so, pick second lowest to avoid repetition
    if (recentSessions.length > 0 && recentSessions[0].gameId === targetGameId && domainEntries.length > 1) {
      targetGameId = domainToGameMap[domainEntries[1][0]] || 'smriti_sangam';
    }

    // Determine adapted difficulty based on recent performance in that game
    const gameHistory = recentSessions.filter((s) => s.gameId === targetGameId);
    let suggestedDifficulty: DifficultyTier = 'saral';

    if (gameHistory.length >= 2) {
      const avgAccuracy = (gameHistory[0].accuracy + gameHistory[1].accuracy) / 2;
      if (avgAccuracy >= 88) {
        suggestedDifficulty = 'nipun';
      } else if (avgAccuracy >= 75) {
        suggestedDifficulty = 'madhyam';
      } else {
        suggestedDifficulty = 'saral';
      }
    } else {
      suggestedDifficulty = 'saral';
    }

    const gameMeta = COGNITIVE_GAMES.find((g) => g.id === targetGameId) || COGNITIVE_GAMES[0];

    const reasons: Partial<Record<GameId, { en: string; hi: string; as: string }>> = {
      smriti_sangam: {
        en: 'A quick visual memory session will boost your recall and strengthen neural pathways today.',
        hi: 'आज की शुरुआत दृश्य स्मृति और पारिवारिक यादों के ताज़ातरीन अभ्यास से करें।',
        as: 'আজিৰ দিনটো দৃশ্য স্মৃতি আৰু মনত ৰখাৰ সুন্দৰ অনুশীলনেৰে আৰম্ভ কৰক।',
      },
      shabda_mala: {
        en: 'Word associations will exercise your language retrieval and enrich semantic fluency.',
        hi: 'शब्द माला खेलकर अपनी भाषा क्षमता और शब्दों के त्वरित स्मरण को सक्रिय करें।',
        as: 'শব্দ মালা খেলি শব্দ চয়ন আৰু ভাষাৰ সঁহাৰি সতেজ কৰি তোলক।',
      },
      rangoli_rekha: {
        en: 'The harmonious lights and chimes will enhance your working memory and sequential recall.',
        hi: 'मधुर संगीत और रंगोली के साथ कार्यकारी स्मृति और क्रमबद्ध सोच को निखारें।',
        as: 'সুৰীয়া সংগীত আৰু ৰঙালীৰ জৰিয়তে কাৰ্যকৰী স্মৃতি আৰু ক্ৰম মনত ৰখা অভ্যাস কৰক।',
      },
      bazaar_hisaab: {
        en: 'Everyday bazaar math provides practical problem-solving for executive brain functions.',
        hi: 'बाज़ार के रोज़मर्रा हिसाब से कार्यकारी निर्णय और व्यावहारिक गणित को चुस्त रखें।',
        as: 'বজাৰৰ দৈনন্দিন হিচাপ-নিকাচে বিবেচনা শক্তি আৰু গণিত চোকা ৰাখে।',
      },
      dhyan_kendra: {
        en: 'Focusing on the pond symbols measures and sharpens your reaction time and selective attention.',
        hi: 'शांत मन से सही चित्रों को पहचान कर अपनी एकाग्रता और प्रतिक्रिया गति बढ़ाएं।',
        as: 'মনোযোগ দি সঠিক চিহ্ন চিনাক্ত কৰি প্ৰতিক্ৰিয়াৰ ক্ষিপ্ৰতা বৃদ্ধি কৰক।',
      },
      disha_sathi: {
        en: 'Reading clock faces and cardinal directions exercises your visuospatial navigation skills.',
        hi: 'घड़ी की सुइयों और दिशाओं की पहचान से स्थानिक समझ और समय बोध को सुदृढ़ बनाएं।',
        as: 'ঘড়ী আৰু দিশ নিৰ্ণয়ৰ অভ্যাসে স্থানিক জ্ঞান আৰু সময়ৰ ধাৰণা বৃদ্ধি কৰে।',
      },
    };

    const defaultReason = {
      en: 'A quick visual memory session will boost your recall and strengthen neural pathways today.',
      hi: 'आज की शुरुआत दृश्य स्मृति और पारिवारिक यादों के ताज़ातरीन अभ्यास से करें।',
      as: 'আজিৰ দিনটো দৃশ্য স্মৃতি আৰু মনত ৰখাৰ সুন্দৰ অনুশীলনেৰে আৰম্ভ কৰক।',
    };

    return {
      gameId: targetGameId,
      priority: 'high',
      reason: (reasons[targetGameId] || reasons.smriti_sangam || defaultReason) as { en: string; hi: string; as: string },
      suggestedDifficulty,
      targetDomain: gameMeta.domain,
    };
  }

  public getDifficultyLabel(diff: DifficultyTier, lang: 'en' | 'hi' | 'as'): string {
    const labels: Record<DifficultyTier, { en: string; hi: string; as: string }> = {
      saral: { en: 'Saral (Gentle)', hi: 'सरल (सुगम)', as: 'সহজ (মৃদু)' },
      madhyam: { en: 'Madhyam (Balanced)', hi: 'मध्यम (संतुलित)', as: 'মধ্যম (সুষম)' },
      nipun: { en: 'Nipun (Challenging)', hi: 'निपुण (चुनौतीपूर्ण)', as: 'নিপুণ (পৰীক্ষামূলক)' },
    };
    return labels[diff][lang];
  }
}

export const recommendationService = new RecommendationService();
