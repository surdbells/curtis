import { Injectable, inject, signal } from '@angular/core';
import { Device } from '@capacitor/device';
import { DeviceService } from './device.service';

const POLL_INTERVAL_MS = 60_000; // 1 min
const LOW_THRESHOLD = 20;        // % below which we surface a warning
const CRITICAL_THRESHOLD = 10;   // % below which we escalate

/**
 * Lightweight battery monitor.
 *
 * Polls @capacitor/device every minute and exposes:
 *   - level: current battery percentage (0-100), or null if unknown
 *   - isCharging: whether the device is plugged in
 *   - isLow / isCritical: derived signals for the UI to surface warnings
 *
 * Phase 6: the Dashboard reads `isLow` to badge the day banner. A future
 * incident-correlation feature can also include battery state in the
 * report so dispatch knows the agent's device is dying.
 */
@Injectable({ providedIn: 'root' })
export class BatteryService {
  private readonly device = inject(DeviceService);

  readonly level = signal<number | null>(null);
  readonly isCharging = signal<boolean>(false);

  /** True when level < LOW_THRESHOLD% and not charging. */
  readonly isLow = signal<boolean>(false);
  /** True when level < CRITICAL_THRESHOLD% and not charging. */
  readonly isCritical = signal<boolean>(false);

  private timer: ReturnType<typeof setInterval> | null = null;

  /**
   * Start polling. Idempotent — calling multiple times has no effect.
   * Called once at app initialiser; can also be called by TrackerService
   * on day start to ensure fresh readings during a shift.
   */
  start(): void {
    if (this.timer) return;
    void this.read();
    this.timer = setInterval(() => void this.read(), POLL_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async read(): Promise<void> {
    try {
      const info = await Device.getBatteryInfo();
      const pct =
        info.batteryLevel !== undefined ? Math.round(info.batteryLevel * 100) : null;
      const charging = !!info.isCharging;
      this.level.set(pct);
      this.isCharging.set(charging);
      this.isLow.set(pct !== null && !charging && pct <= LOW_THRESHOLD);
      this.isCritical.set(pct !== null && !charging && pct <= CRITICAL_THRESHOLD);
      // Refresh DeviceService's cached context too so future DTO builds
      // include the latest batterylevel.
      this.device.resetCache();
    } catch {
      // ignore — Device.getBatteryInfo may not be available on all platforms
    }
  }
}
