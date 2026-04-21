import { Injectable, inject } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { SessionStore } from '../stores/session.store';
import type { AuthUser } from '../models';

const KEY_ACCESS = 'curtis.auth.access';
const KEY_REFRESH = 'curtis.auth.refresh';
const KEY_EXPIRES = 'curtis.auth.expiresAt';
const KEY_USER = 'curtis.auth.user';
const KEY_LAST_USERNAME = 'curtis.auth.lastUsername';

/**
 * Persists auth tokens and rehydrates the in-memory SessionStore on app start.
 *
 * Uses @capacitor/preferences which maps to:
 *   - iOS: UserDefaults (in the app sandbox)
 *   - Android: SharedPreferences
 *   - Web: localStorage (dev/browser only)
 *
 * TODO(security-hardening): for Phase 2 consider @capacitor-community/secure-storage
 * or storing under an Android Keystore-backed preferences group. Preferences alone
 * is acceptable for MVP but not ideal for a CIT app.
 */
@Injectable({ providedIn: 'root' })
export class TokenService {
  private readonly session = inject(SessionStore);

  /**
   * Load any persisted session into the SessionStore.
   * Called once at bootstrap by AppInitializer.
   */
  async hydrate(): Promise<void> {
    const [access, refresh, expires, userJson] = await Promise.all([
      Preferences.get({ key: KEY_ACCESS }),
      Preferences.get({ key: KEY_REFRESH }),
      Preferences.get({ key: KEY_EXPIRES }),
      Preferences.get({ key: KEY_USER }),
    ]);

    if (!access.value || !refresh.value || !expires.value || !userJson.value) {
      return;
    }

    let user: AuthUser;
    try {
      user = JSON.parse(userJson.value);
    } catch {
      await this.clear();
      return;
    }

    this.session.setSession({
      user,
      accessToken: access.value,
      refreshToken: refresh.value,
      expiresAt: expires.value,
    });
  }

  /** Persist a fresh session. Call after successful login. */
  async persistSession(args: {
    user: AuthUser;
    accessToken: string;
    refreshToken: string;
    expiresAt: string;
  }): Promise<void> {
    await Promise.all([
      Preferences.set({ key: KEY_ACCESS, value: args.accessToken }),
      Preferences.set({ key: KEY_REFRESH, value: args.refreshToken }),
      Preferences.set({ key: KEY_EXPIRES, value: args.expiresAt }),
      Preferences.set({ key: KEY_USER, value: JSON.stringify(args.user) }),
    ]);
    this.session.setSession(args);
  }

  /** Persist refreshed tokens without changing the user. */
  async persistRefreshedTokens(args: {
    accessToken: string;
    refreshToken: string;
    expiresAt: string;
  }): Promise<void> {
    await Promise.all([
      Preferences.set({ key: KEY_ACCESS, value: args.accessToken }),
      Preferences.set({ key: KEY_REFRESH, value: args.refreshToken }),
      Preferences.set({ key: KEY_EXPIRES, value: args.expiresAt }),
    ]);
    this.session.updateTokens(args);
  }

  /**
   * Clear all persisted auth state (on logout / auth failure).
   * NOTE: `lastUsername` is intentionally preserved so the login page can
   * pre-fill the username on the next launch. Use `clearAll()` to wipe
   * everything including that convenience.
   */
  async clear(): Promise<void> {
    await Promise.all([
      Preferences.remove({ key: KEY_ACCESS }),
      Preferences.remove({ key: KEY_REFRESH }),
      Preferences.remove({ key: KEY_EXPIRES }),
      Preferences.remove({ key: KEY_USER }),
    ]);
    this.session.clear();
  }

  /** Persist the last-used username for pre-fill convenience on login. */
  async rememberUsername(username: string): Promise<void> {
    await Preferences.set({ key: KEY_LAST_USERNAME, value: username });
  }

  /** Read the last-used username, or null if none. */
  async lastUsername(): Promise<string | null> {
    const res = await Preferences.get({ key: KEY_LAST_USERNAME });
    return res.value ?? null;
  }

  /** Full wipe including last-username convenience. */
  async clearAll(): Promise<void> {
    await Promise.all([
      this.clear(),
      Preferences.remove({ key: KEY_LAST_USERNAME }),
    ]);
  }
}
