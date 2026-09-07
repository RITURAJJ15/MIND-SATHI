/**
 * Mock Service for ABHA (Ayushman Bharat Health Account) Verification.
 * Note: This is a prototype abstraction. It does NOT connect to official ABDM APIs.
 */
import { VerificationState } from './ayushmanService';

class AbhaService {
  /**
   * Simulates fetching ABHA profile with user consent.
   * In a real app, this would involve OAuth/OTP flows with the ABDM gateway.
   */
  public async getProfileWithConsent(abhaNumber: string): Promise<{ status: VerificationState; message: string }> {
    return new Promise((resolve) => {
      setTimeout(() => {
        // Simple mock logic:
        // Assume format is like XX-XXXX-XXXX-XXXX. We just strip dashes and check length.
        const cleanNumber = abhaNumber.replace(/[^0-9A-Za-z]/g, '');
        
        if (cleanNumber.length >= 14) {
          resolve({ status: 'verified', message: 'ABHA Number verified successfully.' });
        } else if (cleanNumber.startsWith('999')) {
          resolve({ status: 'unable', message: 'Unable to connect to ABHA network. Please try again.' });
        } else {
          resolve({ status: 'unverified', message: 'Invalid ABHA Number format or profile not found.' });
        }
      }, 1500); // simulate network latency
    });
  }
}

export const abhaService = new AbhaService();
