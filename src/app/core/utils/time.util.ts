/**
 * Returns the current UTC time as ISO 8601 string.
 * Matches the format used by backend `expiresAt` / `utcDateTime` fields.
 */
export function nowIsoUtc(): string {
  return new Date().toISOString();
}

/**
 * Returns a short, human-readable time string for debug logs.
 * e.g. "08:14:23.001"
 */
export function debugTime(): string {
  const d = new Date();
  return d.toISOString().slice(11, 23);
}

/**
 * Formats a Date for the legacy TrackingApi backend's `DateTime` field.
 *
 * Backend expects: `dd/MM/yyyy hh:mm tt`
 * Example:         `16/09/2017 06:55 PM`
 *
 * Notes:
 *   - 12-hour clock with AM/PM (`tt`), not 24-hour. Midnight is `12:00 AM`,
 *     noon is `12:00 PM`.
 *   - Two-digit day, month, hour, and minute (zero-padded).
 *   - No timezone marker — backend (.NET `DateTime.Parse`) interprets this
 *     as local time. We use device-local time, matching what the legacy
 *     Android client almost certainly did.
 *
 * This format exists ONLY at the wire boundary. Internal timestamps use
 * ISO 8601 (`nowIsoUtc`). `ActionBuilderService` does the conversion in
 * one place before serialising the DTO.
 */
export function formatLegacyDateTime(date: Date): string {
  const pad2 = (n: number): string => (n < 10 ? `0${n}` : String(n));

  const dd = pad2(date.getDate());
  const mm = pad2(date.getMonth() + 1);
  const yyyy = date.getFullYear();

  const rawHour = date.getHours();              // 0..23 local
  const tt = rawHour >= 12 ? 'PM' : 'AM';
  // Convert to 12-hour: 0 -> 12 (AM), 12 -> 12 (PM), else mod 12
  const hour12 = rawHour % 12 === 0 ? 12 : rawHour % 12;
  const hh = pad2(hour12);

  const min = pad2(date.getMinutes());

  return `${dd}/${mm}/${yyyy} ${hh}:${min} ${tt}`;
}
