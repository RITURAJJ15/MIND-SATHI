import { supabase } from '../lib/supabase';
import { GeolocationCoordinates, LiveLocationSession, LiveLocationStatus } from '../types/location';

class LiveLocationService {
  private activeWatchId: number | null = null;
  private heartbeatTimer: any = null;
  private lastSentTime: number = 0;
  private lastLat: number | null = null;
  private lastLon: number | null = null;
  private currentSessionId: string | null = null;
  private beforeUnloadHandler: (() => void) | null = null;

  /**
   * Transforms raw Supabase row into strongly-typed LiveLocationSession
   */
  public mapRowToSession(row: any): LiveLocationSession {
    return {
      id: row.id,
      caregiverId: row.caregiver_id,
      patientId: row.patient_id,
      status: (row.status as LiveLocationStatus) || 'stopped',
      requestedAt: row.requested_at,
      startedAt: row.started_at,
      lastSeenAt: row.last_seen_at,
      stoppedAt: row.stopped_at,
      expiresAt: row.expires_at,
      lastLatitude: row.last_latitude != null ? Number(row.last_latitude) : undefined,
      lastLongitude: row.last_longitude != null ? Number(row.last_longitude) : undefined,
      accuracyMeters: row.accuracy_meters != null ? Number(row.accuracy_meters) : undefined,
      caregiverName: row.caregiver_name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Caregiver initiates a live location request to the connected patient.
   */
  public async requestLiveLocation(patientId: string): Promise<{ success: boolean; session?: LiveLocationSession; error?: string }> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { success: false, error: 'Live location unavailable while offline.' };
    }

    if (!patientId) {
      return { success: false, error: 'Patient ID is required.' };
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !session.user) {
      return { success: false, error: 'Authentication required. Please sign in as a caregiver.' };
    }

    try {
      const { data, error } = await supabase.rpc('request_live_location', {
        p_patient_id: patientId,
      });

      if (error) {
        console.warn('[LiveLocationService] request_live_location RPC error:', error);
        if (error.code === '42501') {
          return { success: false, error: 'Access denied: You are not connected to this patient or lack caregiver permissions.' };
        }
        return { success: false, error: error.message || 'Failed to send live location request.' };
      }

      const row = Array.isArray(data) ? data[0] : data;
      if (!row || !row.id) {
        return { success: false, error: 'Failed to create live location session.' };
      }

      return { success: true, session: this.mapRowToSession(row) };
    } catch (e: any) {
      console.error('[LiveLocationService] requestLiveLocation error:', e);
      return { success: false, error: e?.message || 'An unexpected error occurred.' };
    }
  }

  /**
   * Patient accepts or declines a live location request.
   */
  public async respondToRequest(sessionId: string, accept: boolean): Promise<{ success: boolean; session?: LiveLocationSession; error?: string }> {
    if (!sessionId) {
      return { success: false, error: 'Session ID is required.' };
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !session.user) {
      return { success: false, error: 'Authentication required.' };
    }

    try {
      const { data, error } = await supabase.rpc('respond_live_location_request', {
        p_session_id: sessionId,
        p_accept: accept,
      });

      if (error) {
        console.warn('[LiveLocationService] respond_live_location_request RPC error:', error);
        return { success: false, error: error.message || 'Failed to respond to location request.' };
      }

      const row = Array.isArray(data) ? data[0] : data;
      if (!row) {
        return { success: false, error: 'Session not found.' };
      }

      return { success: true, session: this.mapRowToSession(row) };
    } catch (e: any) {
      return { success: false, error: e?.message || 'An unexpected error occurred.' };
    }
  }

  /**
   * Patient initiates live location sharing with their connected caregiver.
   */
  public async patientStartSharing(): Promise<{ success: boolean; session?: LiveLocationSession; error?: string }> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { success: false, error: 'Live location unavailable while offline.' };
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !session.user) {
      return { success: false, error: 'Authentication required. Please sign in.' };
    }

    try {
      const { data, error } = await supabase.rpc('patient_start_live_location');

      if (error) {
        console.warn('[LiveLocationService] patient_start_live_location RPC error:', error);
        return { success: false, error: error.message || 'Failed to start live location sharing.' };
      }

      const row = Array.isArray(data) ? data[0] : data;
      if (!row || !row.id) {
        return { success: false, error: 'Failed to initiate location session.' };
      }

      return { success: true, session: this.mapRowToSession(row) };
    } catch (e: any) {
      return { success: false, error: e?.message || 'An unexpected error occurred.' };
    }
  }

  /**
   * Starts high-accuracy GPS tracking with throttled streaming and active heartbeat.
   */
  public startSharing(
    sessionId: string,
    onCoordsUpdate?: (coords: GeolocationCoordinates) => void,
    onError?: (err: Error) => void
  ): boolean {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      onError?.(new Error('Geolocation is not supported by your browser.'));
      return false;
    }

    // Stop any existing watch
    this.stopSharing();
    this.currentSessionId = sessionId;

    let latestCoords: GeolocationCoordinates | null = null;

    // Send location update to Supabase
    const sendUpdate = async (coords: GeolocationCoordinates, isHeartbeat = false) => {
      if (!this.currentSessionId) return;

      const now = Date.now();
      // Throttle: don't send more frequently than every 4 seconds unless it's a heartbeat or significant jump
      if (!isHeartbeat && now - this.lastSentTime < 4000) {
        return;
      }

      this.lastSentTime = now;
      this.lastLat = coords.latitude;
      this.lastLon = coords.longitude;

      try {
        await supabase.rpc('update_live_location', {
          p_session_id: this.currentSessionId,
          p_lat: coords.latitude,
          p_lon: coords.longitude,
          p_accuracy: coords.accuracy || 10,
        });
      } catch (err) {
        console.warn('[LiveLocationService] update_live_location error:', err);
      }
    };

    // 1. Browser watchPosition
    try {
      this.activeWatchId = navigator.geolocation.watchPosition(
        (pos) => {
          const coords: GeolocationCoordinates = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          };
          latestCoords = coords;
          onCoordsUpdate?.(coords);
          sendUpdate(coords, false);
        },
        (err) => {
          let msg = 'Unable to access location.';
          if (err.code === err.PERMISSION_DENIED) {
            msg = 'Location permission was denied. Please allow location access in your browser settings to share your live location.';
          } else if (err.code === err.POSITION_UNAVAILABLE) {
            msg = 'Location information is currently unavailable. Please verify GPS and network connection.';
          } else if (err.code === err.TIMEOUT) {
            msg = 'Location request timed out.';
          }
          onError?.(new Error(msg));
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 3000,
        }
      );
    } catch (watchErr: any) {
      onError?.(new Error(watchErr?.message || 'Failed to start geolocation watcher.'));
      return false;
    }

    // 2. Heartbeat interval: guarantees last_seen_at updates every 7 seconds even if stationary
    this.heartbeatTimer = setInterval(() => {
      if (latestCoords) {
        sendUpdate(latestCoords, true);
      }
    }, 7000);

    // 3. Best-effort unload & visibility cleanup
    this.beforeUnloadHandler = () => {
      if (this.currentSessionId) {
        // Stop session on close
        this.stopSharing(this.currentSessionId);
      }
    };
    window.addEventListener('beforeunload', this.beforeUnloadHandler);

    return true;
  }

  /**
   * Halts location watching, stops heartbeat, and updates session status to 'stopped'.
   */
  public async stopSharing(sessionId?: string): Promise<boolean> {
    const targetId = sessionId || this.currentSessionId;

    // 1. Clear watcher
    if (this.activeWatchId !== null && typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(this.activeWatchId);
      this.activeWatchId = null;
    }

    // 2. Clear heartbeat
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    // 3. Remove window event listener
    if (this.beforeUnloadHandler && typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', this.beforeUnloadHandler);
      this.beforeUnloadHandler = null;
    }

    this.currentSessionId = null;
    this.lastLat = null;
    this.lastLon = null;
    this.lastSentTime = 0;

    // 4. Update database status
    if (targetId) {
      try {
        await supabase.rpc('stop_live_location', { p_session_id: targetId });
        return true;
      } catch (e) {
        console.warn('[LiveLocationService] stop_live_location notice:', e);
      }
    }

    return true;
  }

  /**
   * Retrieves the current session between a caregiver and patient if one exists.
   */
  public async getActiveSession(caregiverId: string, patientId: string): Promise<LiveLocationSession | null> {
    if (!caregiverId || !patientId) return null;

    try {
      const { data, error } = await supabase
        .from('live_location_sessions')
        .select('*')
        .eq('caregiver_id', caregiverId)
        .eq('patient_id', patientId)
        .maybeSingle();

      if (error || !data) return null;
      return this.mapRowToSession(data);
    } catch {
      return null;
    }
  }

  /**
   * Retrieves the current live location session for a patient (authenticated caller can be caregiver or patient).
   */
  public async getSessionForPatient(patientId: string): Promise<LiveLocationSession | null> {
    if (!patientId || patientId === 'guest') return null;
    try {
      const { data, error } = await supabase
        .from('live_location_sessions')
        .select('*')
        .eq('patient_id', patientId)
        .maybeSingle();

      if (error || !data) return null;
      return this.mapRowToSession(data);
    } catch {
      return null;
    }
  }

  /**
   * Subscribes via Supabase Realtime to updates for a specific live location session (for Caregiver).
   */
  public subscribeToLiveLocation(
    sessionId: string,
    onUpdate: (session: LiveLocationSession) => void
  ): () => void {
    if (!sessionId) return () => {};

    const channelName = `live_loc_session_${sessionId}_${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_location_sessions',
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          if (payload.new) {
            onUpdate(this.mapRowToSession(payload.new));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  /**
   * Subscribes via Supabase Realtime for incoming location requests directed at this patient.
   */
  public subscribeToIncomingRequests(
    patientId: string,
    onRequest: (session: LiveLocationSession) => void
  ): () => void {
    if (!patientId) return () => {};

    const channelName = `patient_requests_${patientId}_${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_location_sessions',
          filter: `patient_id=eq.${patientId}`,
        },
        (payload) => {
          if (payload.new) {
            const session = this.mapRowToSession(payload.new);
            onRequest(session);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  /**
   * Retrieves any pending incoming request for a patient.
   */
  public async getPendingIncomingRequest(patientId: string): Promise<LiveLocationSession | null> {
    if (!patientId || patientId === 'guest') return null;
    try {
      const { data, error } = await supabase
        .from('live_location_sessions')
        .select('*')
        .eq('patient_id', patientId)
        .eq('status', 'requested')
        .maybeSingle();

      if (error || !data) return null;
      return this.mapRowToSession(data);
    } catch {
      return null;
    }
  }

  /**
   * Evaluates whether a session's heartbeat is alive.
   * If last_seen_at is older than timeoutSeconds, the connection is considered disconnected.
   */
  public isHeartbeatAlive(lastSeenAt?: string | null, timeoutSeconds = 25): boolean {
    if (!lastSeenAt) return false;
    const diffMs = Date.now() - new Date(lastSeenAt).getTime();
    return diffMs >= 0 && diffMs <= timeoutSeconds * 1000;
  }
}

export const liveLocationService = new LiveLocationService();
