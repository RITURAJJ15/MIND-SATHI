import { useState, useEffect } from 'react';
import { UserProfile } from '../types/user';
import { AuthSession } from '../types/auth';
import { authService } from '../services/authService';

export function useCurrentUser(contextTab?: string) {
  const [session, setSession]         = useState<AuthSession | null>(() => authService.getAuthSession());
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => authService.getCurrentUser(contextTab));
  const [allProfiles, setAllProfiles] = useState<UserProfile[]>(() => authService.getAllProfiles());
  // isLoading = true until the Supabase getSession() check on startup completes
  const [isLoading, setIsLoading]     = useState<boolean>(true);

  useEffect(() => {
    // Re-evaluate current user for active contextTab immediately
    setCurrentUser(authService.getCurrentUser(contextTab));

    // Subscribe to auth state changes (login, logout, token refresh)
    const unsub = authService.subscribe((sess) => {
      setSession(sess);
      setCurrentUser(sess ? authService.getCurrentUser(contextTab) : null);
      setAllProfiles(authService.getAllProfiles());
    });

    // Wait for the startup session check to finish
    authService.ready.then(() => {
      setSession(authService.getAuthSession());
      setCurrentUser(authService.getCurrentUser(contextTab));
      setAllProfiles(authService.getAllProfiles());
      setIsLoading(false);
    });

    return unsub;
  }, [contextTab]);

  const switchProfile = (userId: string) => authService.switchUser(userId);

  const isCaregiverSession = session?.user?.role === 'caregiver' || currentUser?.role === 'caregiver';

  // Safe fallback so components that assume non-null don't throw
  const safeUser: UserProfile = currentUser ?? {
    id: 'guest',
    name: 'Guest',
    preferredName: 'Guest',
    role: isCaregiverSession ? 'caregiver' : 'elderly',
    age: 0,
    gender: 'other',
    avatarUrl: '',
    primaryLanguage: 'en',
    city: '',
    state: '',
    caregiverIds: [],
    clinicianIds: [],
    accessibility: { fontSize: 'normal', highContrast: false, textToSpeechAuto: false, soundEffects: false, speechRate: 1.0 },
    streakDays: 0,
    totalXp: 0,
    level: 1,
    levelTitle: isCaregiverSession ? 'Caregiver' : 'Naya Sathi',
    hasCompletedOnboarding: isCaregiverSession ? true : false,
    createdAt: new Date().toISOString(),
  };

  const needsRoleSelection = authService.getNeedsRoleSelection();
  const completeGoogleProfile = (role: any, details?: any) => authService.completeGoogleProfile(role, details);
  const signInWithGoogle = (intendedRole?: any) => authService.signInWithGoogle(intendedRole);

  return {
    currentUser: safeUser,
    session,
    allProfiles,
    switchProfile,
    isLoading,
    isAuthenticated: !isLoading && authService.isAuthenticated(),
    needsRoleSelection,
    completeGoogleProfile,
    signInWithGoogle,
    isElderly:   !isCaregiverSession && safeUser.role === 'elderly',
    isCaregiver: isCaregiverSession || safeUser.role === 'caregiver',
    isClinician: safeUser.role === 'clinician',
    isAdmin:     safeUser.role === 'admin',
  };
}
