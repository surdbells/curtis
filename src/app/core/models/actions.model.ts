/**
 * Central action / status enum constants for DevicePostDto.
 *
 * The TrackingApi accepts arbitrary strings in DevicePostDto.action and
 * DevicePostDto.status. Each endpoint expects a specific vocabulary that
 * has not been documented — we use best-guess values that mirror the
 * endpoint paths.
 *
 * TODO(phase-0): have backend confirm the canonical values. When they do,
 * update this file and every caller picks up the change automatically.
 *
 * Naming convention (assumption):
 *   - `action` values match the endpoint path in lowercase_snake (e.g.
 *     '/Check_In' -> action='check_in')
 *   - `status` is the outcome of that action ('ok' | 'failed' | 'incident')
 */
export const ACTION = {
  START_DAY: 'start_day',
  END_DAY: 'end_day',
  CHECK_IN: 'check_in',
  CHECK_OUT: 'check_out',
  PROCESS: 'process',
  SIGNATURE: 'signature',
  STATUS_BEAT: 'status',
  MANUAL_EVACUATION: 'manual_evacuation',
  EVACUATION_RECEIPT: 'evacuation_receipt',
  INCIDENT: 'incident',
  GPS_PING: 'gps_ping',
} as const;

export const STATUS = {
  OK: 'ok',
  FAILED: 'failed',
  INCIDENT: 'incident',
  PENDING: 'pending',
} as const;

export type ActionValue = typeof ACTION[keyof typeof ACTION];
export type StatusValue = typeof STATUS[keyof typeof STATUS];
