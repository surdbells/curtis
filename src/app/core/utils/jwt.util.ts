import { jwtDecode } from 'jwt-decode';
import type { JwtClaims } from '../models';

/**
 * Safely decode a JWT. Returns null if the token is malformed.
 * Does not verify the signature — that's the server's job.
 */
export function decodeJwt(token: string | null | undefined): JwtClaims | null {
  if (!token) return null;
  try {
    return jwtDecode<JwtClaims>(token);
  } catch {
    return null;
  }
}

/** Returns the `sub` claim (user GUID) from the JWT, or null. */
export function subjectOf(token: string | null | undefined): string | null {
  return decodeJwt(token)?.sub ?? null;
}

/**
 * Returns true if the token is expired or within `skewSeconds` of expiring.
 * A null/undefined/invalid token is treated as expired.
 */
export function isExpired(token: string | null | undefined, skewSeconds = 30): boolean {
  const claims = decodeJwt(token);
  if (!claims?.exp) return true;
  const nowSec = Math.floor(Date.now() / 1000);
  return claims.exp - skewSeconds <= nowSec;
}
