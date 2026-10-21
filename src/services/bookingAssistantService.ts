/**
 * bookingAssistantService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Frontend client service for MIND SATHI "Help Me Book" Assistant &
 * Caregiver-Confirmed Appointment Booking.
 * Connects securely to /api/caregiver/booking-assistant (powered by TinyFish Agent)
 * with authenticated caregiver credentials, strict consent rules, and zero PII leakage.
 */

import { supabase } from '../lib/supabase';
import type {
  BookingAssistanceType,
  BookingAssistantResponse,
  BookingAssistantResult,
  BookingProposal,
  BookingConfirmationResult,
} from '../../api/caregiver/booking-assistant';

export interface BookingAssistantRequestOptions {
  providerUrl: string;
  providerName: string;
  assistanceType?: BookingAssistanceType;
}

export interface PrepareProposalOptions {
  providerUrl: string;
  providerName: string;
  patientId: string;
  department?: string;
}

export interface ConfirmBookingOptions {
  proposalId: string;
  signature: string;
  patientId: string;
  providerUrl: string;
  appointmentSlot: string;
  department?: string;
  providerName?: string;
  expiresAt: number;
  caregiverConfirmed: boolean;
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
   * Request guided read-only booking lookup via the TinyFish Agent serverless endpoint.
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
          action: 'lookup',
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
      console.error('[BookingAssistantService] Network failure during lookup:', err);
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

  /**
   * Stage 1: Inspect availability and prepare a structured booking proposal.
   * Mandate: Stops strictly before final submission or payment.
   */
  public async prepareBookingProposal(
    options: PrepareProposalOptions
  ): Promise<BookingAssistantResponse> {
    const token = await this.getAuthToken();

    if (!token) {
      return {
        success: false,
        configured: true,
        providerName: options.providerName,
        sourceUrl: options.providerUrl,
        error: 'UNAUTHORIZED',
        message: 'Caregiver session expired or not authenticated. Please log in to proceed.',
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
          action: 'prepare_proposal',
          providerUrl: options.providerUrl,
          providerName: options.providerName,
          patientId: options.patientId,
          department: options.department || 'General Medicine / OPD',
        }),
      });

      const data: BookingAssistantResponse = await response.json().catch(() => ({
        success: false,
        configured: true,
        error: `HTTP_${response.status}`,
        message: `Server returned HTTP status ${response.status}`,
        timestamp: new Date().toISOString(),
      }));

      return data;
    } catch (err: any) {
      console.error('[BookingAssistantService] Network failure during proposal preparation:', err);
      return {
        success: false,
        configured: true,
        providerName: options.providerName,
        sourceUrl: options.providerUrl,
        error: 'NETWORK_ERROR',
        message: 'Network error connecting to booking assistant. Please try again.',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Stage 2: Explicit caregiver confirmation of the signed proposal.
   * Submits single confirmed booking action with HMAC token and idempotency protection.
   */
  public async confirmBooking(
    options: ConfirmBookingOptions
  ): Promise<BookingAssistantResponse> {
    const token = await this.getAuthToken();

    if (!token) {
      return {
        success: false,
        configured: true,
        providerName: options.providerName,
        sourceUrl: options.providerUrl,
        error: 'UNAUTHORIZED',
        message: 'Caregiver session expired or not authenticated. Please log in to confirm booking.',
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
          action: 'confirm_booking',
          proposalId: options.proposalId,
          signature: options.signature,
          patientId: options.patientId,
          providerUrl: options.providerUrl,
          appointmentSlot: options.appointmentSlot,
          department: options.department,
          providerName: options.providerName,
          expiresAt: options.expiresAt,
          caregiverConfirmed: options.caregiverConfirmed,
        }),
      });

      const data: BookingAssistantResponse = await response.json().catch(() => ({
        success: false,
        configured: true,
        error: `HTTP_${response.status}`,
        message: `Server returned HTTP status ${response.status}`,
        timestamp: new Date().toISOString(),
      }));

      return data;
    } catch (err: any) {
      console.error('[BookingAssistantService] Network failure during booking confirmation:', err);
      return {
        success: false,
        configured: true,
        providerName: options.providerName,
        sourceUrl: options.providerUrl,
        error: 'NETWORK_ERROR',
        message: 'Network error submitting confirmed booking. Please check your connection or contact the hospital directly.',
        timestamp: new Date().toISOString(),
      };
    }
  }
}

export const bookingAssistantService = new BookingAssistantService();
export type {
  BookingAssistanceType,
  BookingAssistantResponse,
  BookingAssistantResult,
  BookingProposal,
  BookingConfirmationResult,
};
