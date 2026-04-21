import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom, from, map, switchMap, tap } from 'rxjs';
import { ConfigService } from './config.service';
import { TokenService } from './token.service';
import { DeviceService } from './device.service';
import { LocationService } from './location.service';
import { IpLookupService } from './ip-lookup.service';
import { SessionStore } from '../stores/session.store';
import {
  ApiResponse,
  LoginRequest,
  LoginData,
  RefreshData,
  isApiSuccess,
} from '../models';

/**
 * Auth service.
 *
 * Handles login, logout, and token refresh. Persistence is delegated to
 * TokenService; the in-memory SessionStore is updated automatically via
 * TokenService.
 *
 * NOTE: login + refresh deliberately use raw HttpClient (not ApiService)
 * to avoid circular dependencies with interceptors that depend on auth state.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);
  private readonly tokens = inject(TokenService);
  private readonly device = inject(DeviceService);
  private readonly location = inject(LocationService);
  private readonly ipLookup = inject(IpLookupService);
  private readonly session = inject(SessionStore);

  /**
   * Log in with username + password.
   *
   * Before posting the credentials we gather the device context, public IP,
   * and a best-effort coarse geolocation in parallel. Each of these is
   * best-effort — failures fall back to null, they never block the login.
   *
   * Pass `coords` if the caller already has a geolocation fix and wants to
   * skip the in-service lookup (e.g. captured on the login page earlier).
   */
  login(userName: string, password: string, coords?: { latitude?: string; longitude?: string }): Observable<LoginData> {
    return from(this.collectLoginContext(coords)).pipe(
      switchMap((body) => {
        const payload: LoginRequest = {
          ...body,
          userName,
          password,
          appId: this.config.appId,
          loginType: null,
        };
        return this.http.post<ApiResponse<LoginData>>(this.config.url('/login'), payload);
      }),
      map((res) => {
        if (!isApiSuccess(res)) {
          throw res ?? { status: 'unknown', message: 'Login failed' };
        }
        return res.data;
      }),
      tap(async (data) => {
        await this.tokens.persistSession({
          user: data.user,
          accessToken: data.token,
          refreshToken: data.refreshToken,
          expiresAt: data.expiresAt,
        });
        await this.tokens.rememberUsername(userName);
      }),
    );
  }

  /**
   * Gather device context, IP, and geolocation in parallel. Each call is
   * wrapped so a single failure never rejects the whole set.
   */
  private async collectLoginContext(
    coords?: { latitude?: string; longitude?: string },
  ): Promise<Pick<LoginRequest, 'device_Imei' | 'iPaddress' | 'latitude' | 'longitude'>> {
    const [ctx, ip, loc] = await Promise.all([
      this.device.getContext(true).catch(() => null),
      this.ipLookup.getPublicIp().catch(() => null),
      coords ? Promise.resolve(null) : this.location.tryGetCurrent(),
    ]);

    const latitude = coords?.latitude ?? (loc ? String(loc.latitude) : null);
    const longitude = coords?.longitude ?? (loc ? String(loc.longitude) : null);

    return {
      device_Imei: ctx?.imei ?? ctx?.deviceId ?? null,
      iPaddress: ip,
      latitude,
      longitude,
    };
  }

  /**
   * Exchange the refresh token for a new access token.
   *
   * TODO(phase-0): confirm endpoint URL and request body with backend.
   * Current assumption: POST /refresh with { token, refreshToken }.
   * If backend uses a different path/shape, adjust here only.
   */
  refresh(): Observable<RefreshData> {
    const currentAccess = this.session.accessToken();
    const currentRefresh = this.session.refreshToken();

    if (!currentAccess || !currentRefresh) {
      throw new Error('No session to refresh');
    }

    return this.http
      .post<ApiResponse<RefreshData>>(this.config.url('/refresh'), {
        token: currentAccess,
        refreshToken: currentRefresh,
      })
      .pipe(
        map((res) => {
          if (!isApiSuccess(res)) {
            throw res ?? { status: 'unknown', message: 'Refresh failed' };
          }
          return res.data;
        }),
        tap(async (data) => {
          await this.tokens.persistRefreshedTokens({
            accessToken: data.token,
            refreshToken: data.refreshToken,
            expiresAt: data.expiresAt,
          });
        }),
      );
  }

  /**
   * Log out: call server /logout (best-effort) then clear local state.
   * Does not throw on server failure — local cleanup is what matters.
   */
  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.post(this.config.url('/logout'), {}));
    } catch {
      // best-effort: server may be unreachable; we still clear locally.
    }
    await this.tokens.clear();
  }
}
