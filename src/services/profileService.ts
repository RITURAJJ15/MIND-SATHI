import { AccessibilitySettings, UserProfile } from '../types/user';
import { authService } from './authService';

class ProfileService {
  private levelTitles = [
    { level: 1, minXp: 0, title: 'Aarambh Sathi (Beginner)' },
    { level: 2, minXp: 400, title: 'Sadhak Sathi (Seeker)' },
    { level: 3, minXp: 1000, title: 'Pragya Sathi (Wise)' },
    { level: 4, minXp: 1800, title: 'Gyani Sathi (Scholar)' },
    { level: 5, minXp: 3000, title: 'Param Gyani (Master)' },
  ];

  public addXpToCurrentUser(amount: number): { newTotalXp: number; newLevel: number; leveledUp: boolean } {
    const user = authService.getCurrentUser();
    if (!user) return { newTotalXp: 0, newLevel: 1, leveledUp: false };
    const newTotalXp = user.totalXp + amount;
    
    // Calculate new level
    let newLevel = 1;
    let newLevelTitle = this.levelTitles[0].title;
    for (let i = this.levelTitles.length - 1; i >= 0; i--) {
      if (newTotalXp >= this.levelTitles[i].minXp) {
        newLevel = this.levelTitles[i].level;
        newLevelTitle = this.levelTitles[i].title;
        break;
      }
    }

    const leveledUp = newLevel > user.level;

    authService.updateCurrentUserProfile({
      totalXp: newTotalXp,
      level: newLevel,
      levelTitle: newLevelTitle,
    });

    return { newTotalXp, newLevel, leveledUp };
  }

  public updateAccessibility(settings: Partial<AccessibilitySettings>): UserProfile {
    const user = authService.getCurrentUser();
    if (!user) throw new Error("Not authenticated");
    const updatedAccessibility = {
      ...user.accessibility,
      ...settings,
    };
    return authService.updateCurrentUserProfile({
      accessibility: updatedAccessibility,
    });
  }

  public incrementStreak(): number {
    const user = authService.getCurrentUser();
    if (!user) return 0;
    const newStreak = user.streakDays + 1;
    authService.updateCurrentUserProfile({ streakDays: newStreak });
    return newStreak;
  }
}

export const profileService = new ProfileService();
