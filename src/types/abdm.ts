export interface AbhaProfile {
  abhaNumber: string; // "91-4829-1029-4820"
  abhaAddress: string; // "shanti.devi@abdm"
  fullName: string;
  dateOfBirth: string;
  gender: 'Female' | 'Male' | 'Other';
  mobile: string;
  state: string;
  district: string;
  pincode: string;
  photoUrl: string;
  isVerified: boolean;
  kycCompletedDate: string;
}

export interface PmjayBeneficiaryInfo {
  pmjayId: string;
  schemeTitle: string; // "Ayushman Bharat PM-JAY Senior Citizen 70+ Coverage"
  coverageLimit: number; // 500000 (₹5 Lakhs)
  availableBalance: number;
  validUpto: string;
  status: 'Active' | 'Pending Renewal';
  eligiblePackages: string[];
}

export interface EmpanelledHospital {
  id: string;
  name: string;
  category: 'Government' | 'Private Empanelled';
  address: string;
  city: string;
  state: string;
  distance: string;
  phone: string;
  specialties: string[];
  hasGeriatricWard: boolean;
  hasNeurology: boolean;
  pmjayDeskPhone: string;
}
