/**
 * Request payload sent to POST /login.
 *
 * Mirrors the LoginModel schema in the OpenAPI spec. `userName`, `password`,
 * and `appId` are required; the rest are collected client-side for audit.
 */
export interface LoginRequest {
  userName: string;
  password: string;
  appId: string; // environment.appId — currently "ViewHot"
  loginType?: string | null;
  device_Imei?: string | null;
  iPaddress?: string | null;
  latitude?: string | null;
  longitude?: string | null;
}

/**
 * Response body from POST /login on success.
 *
 * Wrapped in ApiResponse<LoginData>. `status === "0"` on success.
 * See sample in the repo README.
 */
export interface LoginData {
  token: string;
  refreshToken: string;
  /** ISO 8601 UTC timestamp at which the access token expires. */
  expiresAt: string;
  requiresTwoFactor: boolean;
  requiresProfileCreation: boolean;
  user: AuthUser;
}

export interface AuthUser {
  id: string;       // GUID — matches JWT `sub` claim
  email: string;
  roles: string[];
}

/**
 * Decoded JWT claim set for the TrackingApi access token.
 * Based on the sample token inspected during Phase 0 (HS256, iss/aud = https://bw.com).
 */
export interface JwtClaims {
  sub: string;            // user GUID
  email: string;
  jti: string;
  exp: number;            // unix timestamp (seconds)
  iss: string;
  aud: string;
  // Long XML-schema claim URIs also present in the sample; captured verbatim:
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'?: string;
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'?: string;
}

/**
 * Refresh request payload.
 *
 * TODO(phase-0): confirm exact endpoint URL and body shape with backend.
 * Assumed to be POST /refresh with { token, refreshToken }. Adjust when confirmed.
 */
export interface RefreshRequest {
  token: string;
  refreshToken: string;
}

/**
 * Refresh response. Assumed to mirror LoginData but may be slimmer.
 * TODO(phase-0): confirm shape.
 */
export type RefreshData = LoginData;
