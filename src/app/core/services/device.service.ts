import { Injectable } from '@angular/core';
import { Device } from '@capacitor/device';
import type { DeviceContext } from '../models';

/**
 * Collects device / runtime metadata used in:
 *   - Login payload (device_Imei, iPaddress, latitude, longitude)
 *   - DevicePostDto (deviceId, batterystatus) on every POST
 *   - GPS tracker pings
 *
 * Caches the static parts (deviceId, platform) after the first read.
 */
@Injectable({ providedIn: 'root' })
export class DeviceService {
  private cached: DeviceContext | null = null;

  /**
   * Returns the current device context. Pass `refreshBattery = true` to
   * re-read volatile fields (battery level, charging state).
   */
  async getContext(refreshBattery = false): Promise<DeviceContext> {
    if (this.cached && !refreshBattery) {
      return this.cached;
    }

    const [info, id, battery] = await Promise.all([
      Device.getInfo(),
      Device.getId(),
      Device.getBatteryInfo().catch(() => ({ batteryLevel: undefined, isCharging: undefined })),
    ]);

    const platform = info.platform as DeviceContext['platform'];

    this.cached = {
      deviceId: id.identifier,
      // On iOS this is the IDFV; on Android it's ANDROID_ID (IMEI is restricted post-Android 10).
      imei: id.identifier,
      platform: platform ?? 'unknown',
      model: info.model,
      osVersion: info.osVersion,
      appVersion: undefined, // TODO(phase-2): pull from @capacitor/app via AppService
      batteryLevel:
        battery.batteryLevel !== undefined ? Math.round(battery.batteryLevel * 100) : undefined,
      isCharging: battery.isCharging,
    };
    return this.cached;
  }

  /** Clears the cache. Useful in tests. */
  resetCache(): void {
    this.cached = null;
  }
}
