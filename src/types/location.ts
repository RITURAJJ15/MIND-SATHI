export interface PatientLocation {
  id?: string;
  patientId: string;
  latitude: number;
  longitude: number;
  locationName?: string;
  locality?: string;
  city?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface GeolocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
}
