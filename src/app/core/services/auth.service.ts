import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom, from, map, switchMap, tap } from 'rxjs';
import { ConfigService } from './config.service';
import { TokenService } from './token.service';
import { DeviceService } from './device.service';
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
  private readonly session = inject(SessionStore);

  /**
   * Log in with username + password.
   * Captures device context and current geolocation for audit.
   */
  login(userName: string, password: string, coords?: { latitude?: string; longitude?: string }): Observable<LoginData> {
    return from(this.device.getContext(true)).pipe(
      switchMap((ctx) => {
        const body: LoginRequest = {
          userName,
          password,
          appId: this.config.appId,
          device_Imei: ctx.imei ?? ctx.deviceId,
          iPaddress: ctx.ipAddress ?? null,
          latitude: coords?.latitude ?? null,
          longitude: coords?.longitude ?? null,
          loginType: null,
        };
        return this.http.post<ApiResponse<LoginData>>(this.config.url('/login'), body);
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
      }),
    );
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
