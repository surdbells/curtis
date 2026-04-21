import { Injectable, computed, signal } from '@angular/core';
import type { AuthUser } from '../models';

/**
 * Signal-based session store.
 *
 * Holds the currently-authenticated user and access/refresh tokens in memory.
 * Persisted copy lives in Capacitor Preferences via TokenService; this store
 * is the fast-path in-memory mirror used by interceptors, guards, and UI.
 *
 * NOTE: This store is intentionally framework-free (no RxJS, no NgRx) —
 * Angular signals give us reactivity with zero dependencies.
 */
@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly _user = signal<AuthUser | null>(null);
  private readonly _accessToken = signal<string | null>(null);
  private readonly _refreshToken = signal<string | null>(null);
  /** ISO 8601 UTC. */
  private readonly _expiresAt = signal<string | null>(null);

  readonly user = this._user.asReadonly();
  readonly accessToken = this._accessToken.asReadonly();
  readonly refreshToken = this._refreshToken.asReadonly();
  readonly expiresAt = this._expiresAt.asReadonly();

  readonly isAuthenticated = computed(() => !!this._accessToken() && !!this._user());
  readonly userId = computed(() => this._user()?.id ?? null);

  /**
   * Milliseconds until the access token expires. Negative if already expired.
   * Returns null when no token is loaded.
   */
  readonly msUntilExpiry = computed(() => {
    const exp = this._expiresAt();
    if (!exp) return null;
    return new Date(exp).getTime() - Date.now();
  });

  setSession(args: {
    user: AuthUser;
    accessToken: string;
    refreshToken: string;
    expiresAt: string;
  }): void {
    this._user.set(args.user);
    this._accessToken.set(args.accessToken);
    this._refreshToken.set(args.refreshToken);
    this._expiresAt.set(args.expiresAt);
  }

  updateTokens(args: { accessToken: string; refreshToken: string; expiresAt: string }): void {
    this._accessToken.set(args.accessToken);
    this._refreshToken.set(args.refreshToken);
    this._expiresAt.set(args.expiresAt);
  }

  clear(): void {
    this._user.set(null);
    this._accessToken.set(null);
    this._refreshToken.set(null);
    this._expiresAt.set(null);
  }
}
