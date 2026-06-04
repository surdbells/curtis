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
