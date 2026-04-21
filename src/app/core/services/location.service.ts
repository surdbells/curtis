import { Injectable } from '@angular/core';
import { Geolocation, Position } from '@capacitor/geolocation';

export interface Coords {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: number;
}

/**
 * Foreground geolocation wrapper. Used for one-shot reads during login,
 * start_day, check-in, check-out, etc. Continuous background tracking
 * during an active day is handled by TrackerService + BackgroundGeolocation.
 */
@Injectable({ providedIn: 'root' })
export class LocationService {
  /**
   * Request permissions if needed, then read a single position.
   * Rejects if permission denied or no fix within timeout.
   */
  async getCurrent(options?: { timeoutMs?: number; highAccuracy?: boolean }): Promise<Coords> {
    const perm = await Geolocation.checkPermissions();
    if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') {
      const req = await Geolocation.requestPermissions();
      if (req.location !== 'granted' && req.coarseLocation !== 'granted') {
        throw new Error('Location permission denied');
      }
    }

    const pos: Position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: options?.highAccuracy ?? true,
      timeout: options?.timeoutMs ?? 15_000,
      maximumAge: 0,
    });

    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      timestamp: pos.timestamp,
    };
  }

  /** Best-effort read — returns null on any error. Useful for optional stamps. */
  async tryGetCurrent(): Promise<Coords | null> {
    try {
      return await this.getCurrent({ timeoutMs: 5_000, highAccuracy: false });
    } catch {
      return null;
    }
  }
}
