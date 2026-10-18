/**
 * careNavigatorService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Frontend client service for MIND SATHI Care Navigator.
 * Connects securely to /api/caregiver/navigator (backed by TinyFish Search API)
 * with authenticated caregiver credentials and strict patient privacy guarantees.
 */

import { supabase } from '../lib/supabase';
import type { NavigatorSection, NavigatorResultItem, NavigatorResponse } from '../../api/caregiver/navigator';

export interface SearchOptions {
  section: NavigatorSection;
  query: string;
}

class CareNavigatorService {
  /**
   * Helper to retrieve Supabase JWT bearer token for the current caregiver session.
   */
  private async getAuthToken(): Promise<string | null> {
    try {
      const { data } = await supabase.auth.getSession();
      return data?.session?.access_token || null;
    } catch (err) {
      console.warn('[CareNavigatorService] Failed to retrieve session token:', err);
      return null;
    }
  }

  /**
   * Search via the Care Navigator serverless endpoint.
   */
  public async search(options: SearchOptions): Promise<NavigatorResponse> {
    const token = await this.getAuthToken();

    if (!token) {
      return {
        success: false,
        configured: true,
        section: options.section,
        query: options.query,
        results: [],
        totalResults: 0,
        error: 'UNAUTHORIZED',
        message: 'Caregiver session expired or not authenticated. Please log in to search live resources.',
        timestamp: new Date().toISOString(),
      };
    }

    try {
      const response = await fetch('/api/caregiver/navigator', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          section: options.section,
          query: options.query,
        }),
      });

      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}));
        return {
          success: false,
          configured: errorJson.error === 'CONFIG_REQUIRED' ? false : true,
          section: options.section,
          query: options.query,
          results: [],
          totalResults: 0,
          error: errorJson.error || `HTTP_${response.status}`,
          message: errorJson.message || `Server returned error (${response.status})`,
          timestamp: new Date().toISOString(),
        };
      }

      const data: NavigatorResponse = await response.json();
      return data;
    } catch (err: any) {
      console.error('[CareNavigatorService] Network failure:', err);
      return {
        success: false,
        configured: true,
        section: options.section,
        query: options.query,
        results: [],
        totalResults: 0,
        error: 'NETWORK_ERROR',
        message: 'Could not connect to the Care Navigator search service. Please check your network connection.',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Section A: Nearby Care Finder
   * Search hospitals, geriatric clinics, dementia support centers.
   */
  public async findNearbyCare(locationQuery: string): Promise<NavigatorResponse> {
    return this.search({ section: 'care_finder', query: locationQuery });
  }

  /**
   * Section B: Affordable Medicine Locator
   * Search Jan Aushadhi Kendras and official generic medicine stores.
   */
  public async findAffordableMedicine(locationQuery: string): Promise<NavigatorResponse> {
    return this.search({ section: 'medicine', query: locationQuery });
  }

  /**
   * Section C: Government Schemes
   * Search official government websites for senior citizen & health assistance schemes.
   */
  public async findGovernmentSchemes(searchQuery: string): Promise<NavigatorResponse> {
    return this.search({ section: 'schemes', query: searchQuery });
  }

  /**
   * Section D: Health Notices
   * Search official healthcare & government advisories and notices.
   */
  public async findHealthNotices(topicQuery: string = ''): Promise<NavigatorResponse> {
    return this.search({ section: 'notices', query: topicQuery });
  }
}

export const careNavigatorService = new CareNavigatorService();
