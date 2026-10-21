/**
 * bookingAssistantService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Frontend client service for MIND SATHI "Help Me Book" Assistant.
 * Connects securely to /api/caregiver/booking-assistant (powered by TinyFish Agent)
 * with authenticated caregiver credentials and strict privacy guarantees.
 */

import { supabase } from '../lib/supabase';
import type {
  BookingAssistanceType,
  BookingAssistantResponse,
  BookingAssistantResult,
} from '../../api/caregiver/booking-assistant';

export interface BookingAssistantRequestOptions {
  providerUrl: string;
  providerName: string;
  assistanceType?: BookingAssistanceType;
}

class BookingAssistantService {
  /**
   * Helper to retrieve Supabase JWT bearer token for the current caregiver session.
   */
  private async getAuthToken(): Promise<string | null> {
    try {
      const { data } = await supabase.auth.getSession();
      return data?.session?.access_token || null;
    } catch (err) {
      console.warn('[BookingAssistantService] Failed to retrieve session token:', err);
      return null;
    }
  }

  /**
   * Request guided booking lookup via the TinyFish Agent serverless endpoint.
   */
  public async getBookingAssistance(
    options: BookingAssistantRequestOptions
  ): Promise<BookingAssistantResponse> {
    const token = await this.getAuthToken();

    if (!token) {
      return {
        success: false,
        configured: true,
        providerName: options.providerName,
        sourceUrl: options.providerUrl,
        assistanceType: options.assistanceType || 'all',
        error: 'UNAUTHORIZED',
        message: 'Caregiver session expired or not authenticated. Please log in to request booking assistance.',
        timestamp: new Date().toISOString(),
      };
    }

    try {
      const response = await fetch('/api/caregiver/booking-assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          providerUrl: options.providerUrl,
          providerName: options.providerName,
          assistanceType: options.assistanceType || 'all',
        }),
      });

      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}));
        return {
          success: false,
          configured: errorJson.error === 'CONFIG_REQUIRED' ? false : true,
          providerName: options.providerName,
          sourceUrl: options.providerUrl,
          assistanceType: options.assistanceType || 'all',
          error: errorJson.error || `HTTP_${response.status}`,
          message: errorJson.message || `Server returned error (${response.status})`,
          timestamp: new Date().toISOString(),
        };
      }

      const data: BookingAssistantResponse = await response.json();
      return data;
    } catch (err: any) {
      console.error('[BookingAssistantService] Network failure:', err);
      return {
        success: false,
        configured: true,
        providerName: options.providerName,
        sourceUrl: options.providerUrl,
        assistanceType: options.assistanceType || 'all',
        error: 'NETWORK_ERROR',
        message: 'Could not connect to the Booking Assistance service. Please check your network connection.',
        timestamp: new Date().toISOString(),
      };
    }
  }
}

export const bookingAssistantService = new BookingAssistantService();
export type { BookingAssistanceType, BookingAssistantResponse, BookingAssistantResult };
