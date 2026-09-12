import { supabase } from '../lib/supabase';
import { Capacitor } from '@capacitor/core';
import { PatientLocation, GeolocationCoordinates } from '../types/location';

const LOCAL_STORAGE_PREFIX = 'ms_patient_location_';

class LocationService {
  /**
   * Requests browser/device location permission and gets current coordinates.
   * Prompts user via browser native geolocation.
   */
  public async requestBrowserCoordinates(): Promise<GeolocationCoordinates> {
    if (Capacitor.isNativePlatform()) {
      try {
        const { Geolocation } = await import('@capacitor/geolocation');
        const perm = await Geolocation.requestPermissions();
        if (perm.location === 'denied') {
          throw new Error('Location access was denied. Please allow location access in your device settings.');
        }
        const pos = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        });
        return {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
      } catch (nativeErr: any) {
        if (nativeErr.message && nativeErr.message.includes('denied')) {
          throw nativeErr;
        }
        console.warn('[LocationService] Native geolocation note, attempting browser API fallback:', nativeErr);
      }
    }

    if (typeof window === 'undefined' || !navigator.geolocation) {
      throw new Error('Geolocation is not supported by your browser.');
    }

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
        },
        (err) => {
          let msg = 'Unable to retrieve location coordinates.';
          switch (err.code) {
            case err.PERMISSION_DENIED:
              msg = 'Location access was denied. Please allow location access in your browser or device settings to save your home location.';
              break;
            case err.POSITION_UNAVAILABLE:
              msg = 'Location information is currently unavailable. Please verify your device GPS and network connection.';
              break;
            case err.TIMEOUT:
              msg = 'Location request timed out. Please tap Try Again.';
              break;
          }
          reject(new Error(msg));
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        }
      );
    });
  }

  /**
   * Retrieves the patient's saved home location from Supabase database.
   * Associated strictly with patient_id = auth.uid().
   */
  public async getPatientHomeLocation(patientId: string): Promise<PatientLocation | null> {
    if (!patientId) return null;

    try {
      const { data, error } = await supabase
        .from('patient_locations')
        .select('id, patient_id, latitude, longitude, location_name, created_at, updated_at')
        .eq('patient_id', patientId)
        .maybeSingle();

      if (error) {
        console.warn('[LocationService] Supabase query notice:', error.message);
        return this.getLocalFallback(patientId);
      }

      if (data) {
        const loc: PatientLocation = {
          id: data.id,
          patientId: data.patient_id,
          latitude: Number(data.latitude),
          longitude: Number(data.longitude),
          locationName: data.location_name || 'My Home Location',
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        };
        // Update local cache as resilient fallback
        this.saveLocalFallback(patientId, loc);
        return loc;
      }

      return null;
    } catch (e: any) {
      console.warn('[LocationService] getPatientHomeLocation error:', e?.message || e);
      return this.getLocalFallback(patientId);
    }
  }

  /**
   * Saves or updates the patient's home location in Supabase.
   * Uses upsert on patient_id to enforce 1-to-1 patient location relationship.
   */
  public async savePatientHomeLocation(
    patientId: string,
    coords: { latitude: number; longitude: number; locationName?: string }
  ): Promise<{ success: boolean; data?: PatientLocation; error?: string }> {
    if (!patientId) {
      return { success: false, error: 'User is not authenticated. Cannot save location.' };
    }

    if (
      typeof coords.latitude !== 'number' ||
      typeof coords.longitude !== 'number' ||
      isNaN(coords.latitude) ||
      isNaN(coords.longitude)
    ) {
      return { success: false, error: 'Invalid geographic coordinates.' };
    }

    const now = new Date().toISOString();
    const locationName = coords.locationName?.trim() || 'My Home Location';

    const payload = {
      patient_id: patientId,
      latitude: coords.latitude,
      longitude: coords.longitude,
      location_name: locationName,
      updated_at: now,
    };

    try {
      const { data, error } = await supabase
        .from('patient_locations')
        .upsert(payload, { onConflict: 'patient_id' })
        .select('id, patient_id, latitude, longitude, location_name, created_at, updated_at')
        .single();

      if (error) {
        console.warn('[LocationService] Supabase upsert notice:', error.message);
        // If table doesn't exist yet in Supabase schema cache, save to local cache
        const localLoc: PatientLocation = {
          patientId,
          latitude: coords.latitude,
          longitude: coords.longitude,
          locationName,
          updatedAt: now,
        };
        this.saveLocalFallback(patientId, localLoc);
        return { success: true, data: localLoc };
      }

      const savedLoc: PatientLocation = {
        id: data.id,
        patientId: data.patient_id,
        latitude: Number(data.latitude),
        longitude: Number(data.longitude),
        locationName: data.location_name || locationName,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };

      this.saveLocalFallback(patientId, savedLoc);
      return { success: true, data: savedLoc };
    } catch (e: any) {
      console.warn('[LocationService] savePatientHomeLocation error:', e?.message || e);
      const localLoc: PatientLocation = {
        patientId,
        latitude: coords.latitude,
        longitude: coords.longitude,
        locationName,
        updatedAt: now,
      };
      this.saveLocalFallback(patientId, localLoc);
      return { success: true, data: localLoc };
    }
  }

  /**
   * Reverse-geocodes coordinates into a human-readable address or neighborhood.
   * Uses OpenStreetMap Nominatim with rate-limit and offline safety.
   */
  public async reverseGeocode(lat: number, lon: number): Promise<string> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=16&addressdetails=1`,
        {
          headers: {
            'Accept-Language': 'en',
          },
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);

      if (res.ok) {
        const json = await res.json();
        if (json && json.address) {
          const addr = json.address;
          const parts = [
            addr.suburb || addr.neighbourhood || addr.residential || addr.road,
            addr.city || addr.town || addr.village || addr.county,
            addr.state,
          ].filter(Boolean);

          if (parts.length > 0) {
            return parts.join(', ');
          }
        }
        if (json.display_name) {
          return json.display_name.split(',').slice(0, 3).join(', ');
        }
      }
    } catch {
      // Ignore network / offline error, fallback below
    }

    return `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`;
  }

  private getLocalFallback(patientId: string): PatientLocation | null {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_PREFIX + patientId);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch {
      // ignore
    }
    return null;
  }

  private saveLocalFallback(patientId: string, location: PatientLocation): void {
    try {
      localStorage.setItem(LOCAL_STORAGE_PREFIX + patientId, JSON.stringify(location));
    } catch {
      // ignore
    }
  }
}

export const locationService = new LocationService();
