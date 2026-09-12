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

export type LiveLocationStatus = 'requested' | 'active' | 'stopped' | 'disconnected' | 'expired';

export interface LiveLocationSession {
  id: string;
  caregiverId: string;
  patientId: string;
  status: LiveLocationStatus;
  requestedAt?: string;
  startedAt?: string;
  lastSeenAt?: string;
  stoppedAt?: string;
  expiresAt?: string;
  lastLatitude?: number;
  lastLongitude?: number;
  accuracyMeters?: number;
  caregiverName?: string;
  createdAt?: string;
  updatedAt?: string;
}
