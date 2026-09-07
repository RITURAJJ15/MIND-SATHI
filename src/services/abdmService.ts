import { AbhaProfile, EmpanelledHospital, PmjayBeneficiaryInfo } from '../types/abdm';
import { MOCK_ABHA_PROFILE, MOCK_EMPANELLED_HOSPITALS, MOCK_PMJAY_BENEFICIARY } from '../data/mockAbdm';

class AbdmService {
  private abhaProfile: AbhaProfile = MOCK_ABHA_PROFILE;
  private beneficiaryInfo: PmjayBeneficiaryInfo = MOCK_PMJAY_BENEFICIARY;
  private hospitals: EmpanelledHospital[] = MOCK_EMPANELLED_HOSPITALS;

  public getAbhaProfile(): AbhaProfile {
    return this.abhaProfile;
  }

  public getPmjayBeneficiaryInfo(): PmjayBeneficiaryInfo {
    return this.beneficiaryInfo;
  }

  public searchHospitals(params: {
    city?: string;
    specialty?: string;
    query?: string;
  }): EmpanelledHospital[] {
    return this.hospitals.filter((hosp) => {
      if (params.city && params.city !== 'All' && hosp.city.toLowerCase() !== params.city.toLowerCase()) {
        return false;
      }
      if (params.specialty && params.specialty !== 'All') {
        const matchesSpec = hosp.specialties.some((s) => s.toLowerCase().includes(params.specialty!.toLowerCase()));
        if (!matchesSpec) return false;
      }
      if (params.query && params.query.trim()) {
        const q = params.query.toLowerCase();
        const matchesName = hosp.name.toLowerCase().includes(q);
        const matchesAddress = hosp.address.toLowerCase().includes(q);
        if (!matchesName && !matchesAddress) return false;
      }
      return true;
    });
  }

  public getCities(): string[] {
    return Array.from(new Set(this.hospitals.map((h) => h.city)));
  }

  public getSpecialties(): string[] {
    const specs = new Set<string>();
    this.hospitals.forEach((h) => h.specialties.forEach((s) => specs.add(s)));
    return Array.from(specs);
  }
}

export const abdmService = new AbdmService();
