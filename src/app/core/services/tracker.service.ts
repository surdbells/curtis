import { Injectable, inject } from '@angular/core';
import { ConfigService } from './config.service';

/**
 * Background GPS tracker.
 *
 * Starts on start_day, stops on end_day. Posts device location to
 * /PostDeviceLocation at `gpsPingIntervalMs`.
 *
 * Uses @capacitor-community/background-geolocation under the hood on native
 * platforms. On web/dev, falls back to a setInterval over foreground
 * Geolocation (only for developer feedback — not production).
 *
 * TODO(phase-6): full implementation with persistent Android notification,
 * iOS background mode configuration, and POST wiring.
 */
@Injectable({ providedIn: 'root' })
export class TrackerService {
  private readonly config = inject(ConfigService);
  private running = false;

  isRunning(): boolean {
    return this.running;
  }

  async start(): Promise<void> {
    if (this.running) return;
    // TODO(phase-6): register BackgroundGeolocation.addWatcher → POST /PostDeviceLocation
    this.running = true;
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    // TODO(phase-6): BackgroundGeolocation.removeWatcher
    this.running = false;
  }
}
