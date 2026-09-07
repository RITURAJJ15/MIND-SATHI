/**
 * Mock Service for PM-JAY (Ayushman Bharat) Verification.
 * Note: This is a prototype abstraction. It does NOT connect to official ABDM/PM-JAY APIs.
 */
export type VerificationState = 'verified' | 'unverified' | 'unable';

class AyushmanService {
  /**
   * Simulates checking PM-JAY eligibility.
   * In a real app, this would securely call a backend proxying to the NHA API.
   */
  public async checkEligibility(pmjayId: string): Promise<{ status: VerificationState; message: string }> {
    return new Promise((resolve) => {
      setTimeout(() => {
        // Simple mock logic:
        // If it starts with 'P', treat it as valid.
        // If it starts with 'X', simulate network error ('unable').
        // Otherwise, invalid ('unverified').
        const cleanId = pmjayId.trim().toUpperCase();
        
        if (cleanId.startsWith('P') && cleanId.length > 5) {
          resolve({ status: 'verified', message: 'PM-JAY Beneficiary verified successfully.' });
        } else if (cleanId.startsWith('X')) {
          resolve({ status: 'unable', message: 'Unable to reach PM-JAY verification server. Please try again later.' });
        } else {
          resolve({ status: 'unverified', message: 'Could not verify the PM-JAY ID. Please check and try again.' });
        }
      }, 1500); // simulate network latency
    });
  }

  public async verifyBeneficiary(pmjayId: string): Promise<{ status: VerificationState; message: string }> {
    return this.checkEligibility(pmjayId);
  }
}

export const ayushmanService = new AyushmanService();
