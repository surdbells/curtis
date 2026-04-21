/**
 * Device / runtime context captured by DeviceService and reused across
 * login, POSTs, and GPS pings.
 */
export interface DeviceContext {
  /** Stable unique identifier for this install. */
  deviceId: string;

  /**
   * Platform-specific hardware identifier if available.
   * - Android: androidId / IMEI where permitted
   * - iOS: identifierForVendor (no IMEI — Apple restricts it)
   */
  imei?: string;

  platform: 'android' | 'ios' | 'web' | 'unknown';
  model?: string;
  osVersion?: string;
  appVersion?: string;

  /** Approximate outbound IP (best-effort, may be unavailable offline). */
  ipAddress?: string;

  /** Battery as percentage, 0-100. */
  batteryLevel?: number;
  isCharging?: boolean;
}
