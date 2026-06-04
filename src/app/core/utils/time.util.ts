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
 * Formats a Date for the TrackingApi backend's `utcDateTime` field using
 * the canonical wire pattern `dd/MM/yyyy hh:mm tt` (12-hour clock with
 * AM/PM).
 *
 * Example output: `04/06/2026 05:30 PM`
 *
 * Components come from the UTC parts of the date (`getUTCDate`,
 * `getUTCHours`, etc.) — not device-local — because the field name is
 * `utcDateTime`. Server-side parsers that ignore the timezone marker
 * will then see a consistent value regardless of which timezone the
 * device is in.
 *
 * Rules:
 *   - Two-digit day, month, hour, minute (zero-padded)
 *   - Four-digit year
 *   - 12-hour clock: 0 -> 12 AM, 12 -> 12 PM, otherwise mod 12
 *   - No timezone marker in the output
 */
export function formatLegacyDateTimeUtc(date: Date): string {
  const pad2 = (n: number): string => (n < 10 ? `0${n}` : String(n));

  const dd = pad2(date.getUTCDate());
  const mm = pad2(date.getUTCMonth() + 1);
  const yyyy = date.getUTCFullYear();

  const rawHour = date.getUTCHours();          // 0..23 UTC
  const tt = rawHour >= 12 ? 'PM' : 'AM';
  // Convert to 12-hour: 0 -> 12 (AM), 12 -> 12 (PM), else mod 12
  const hour12 = rawHour % 12 === 0 ? 12 : rawHour % 12;
  const hh = pad2(hour12);

  const min = pad2(date.getUTCMinutes());

  return `${dd}/${mm}/${yyyy} ${hh}:${min} ${tt}`;
}
