/**
 * mobileBridgeService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Cross-platform native bridge for MIND SATHI.
 * Integrates Capacitor App lifecycle, Deep-link OAuth callbacks,
 * Hardware back button, Native network monitoring, and Splash screen.
 * Safely no-ops when executed in regular web browsers (production website).
 */

import { Capacitor } from '@capacitor/core';
import { supabase } from '../lib/supabase';
import { syncService } from './syncService';
import { navigate, getCleanHashPath } from '../router';

export class MobileBridgeService {
  private static initialized = false;

  public static async init(): Promise<void> {
    if (this.initialized || !Capacitor.isNativePlatform()) {
      return;
    }
    this.initialized = true;

    try {
      // 1. Dynamic imports to ensure web bundle remains lightweight
      const { App } = await import('@capacitor/app');
      const { Browser } = await import('@capacitor/browser');
      const { SplashScreen } = await import('@capacitor/splash-screen');
      const { StatusBar, Style } = await import('@capacitor/status-bar');
      const { Network } = await import('@capacitor/network');

      // Configure Status Bar
      try {
        await StatusBar.setStyle({ style: Style.Light });
        await StatusBar.setBackgroundColor({ color: '#FAF7F2' });
      } catch (sbErr) {
        console.warn('[MobileBridge] StatusBar setup note:', sbErr);
      }

      // Hide Splash Screen after brief mount delay
      setTimeout(() => {
        SplashScreen.hide().catch(() => {});
      }, 600);

      // ── 2. Deep-Link Handler (Google OAuth redirect: com.mindsathi.app://auth/callback) ──
      App.addListener('appUrlOpen', async (data) => {
        console.log('[MobileBridge] appUrlOpen received:', data.url);

        try {
          // Close in-app browser sheet if still open
          await Browser.close().catch(() => {});

          const rawUrl = data.url;
          if (rawUrl.includes('auth/callback') || rawUrl.includes('access_token=') || rawUrl.includes('code=')) {
            // Parse tokens or code from deep link
            const urlObj = new URL(rawUrl.replace('com.mindsathi.app://', 'https://localhost/'));
            
            // Check hash fragment first (access_token & refresh_token)
            let hashParams = new URLSearchParams();
            if (urlObj.hash && urlObj.hash.includes('=')) {
              hashParams = new URLSearchParams(urlObj.hash.replace(/^#\/?/, ''));
            }

            const accessToken = hashParams.get('access_token');
            const refreshToken = hashParams.get('refresh_token');
            const code = urlObj.searchParams.get('code');

            if (accessToken && refreshToken) {
              const { error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });
              if (!error) {
                navigate('/patient/dashboard', true);
                return;
              }
            } else if (code) {
              const { error } = await supabase.auth.exchangeCodeForSession(code);
              if (!error) {
                navigate('/patient/dashboard', true);
                return;
              }
            }

            // Fallback: navigate to callback route so AuthCallbackPage processes it
            navigate('/auth/callback', true);
          }
        } catch (linkErr) {
          console.error('[MobileBridge] Deep link processing error:', linkErr);
        }
      });

      // ── 3. App Lifecycle (Foreground / Resume) ──
      App.addListener('appStateChange', async ({ isActive }) => {
        if (isActive) {
          console.log('[MobileBridge] App returned to foreground, checking sync and session...');
          try {
            // Trigger offline mutation sync
            await syncService.syncOfflineChanges();
            // Validate auth session freshness
            await supabase.auth.getSession();
          } catch (resumeErr) {
            console.warn('[MobileBridge] Resume sync note:', resumeErr);
          }
        }
      });

      // ── 4. Hardware Back Button (Android) ──
      App.addListener('backButton', ({ canGoBack }) => {
        const current = getCleanHashPath();
        if (current === '/' || current === '/patient/dashboard' || current === '/caregiver/dashboard') {
          // On main screens, exit app
          App.exitApp();
        } else if (current === '/patient/auth' || current === '/caregiver/auth' || current === '/doctor/auth') {
          navigate('/', true);
        } else if (canGoBack) {
          window.history.back();
        } else {
          navigate('/', true);
        }
      });

      // ── 5. Native Network Monitoring ──
      Network.addListener('networkStatusChange', (status) => {
        console.log('[MobileBridge] Network status changed. Connected:', status.connected);
        if (status.connected) {
          syncService.syncOfflineChanges();
        }
      });

    } catch (err) {
      console.warn('[MobileBridge] Native bridge initialization note:', err);
    }
  }
}

export const initMobileBridge = () => MobileBridgeService.init();
