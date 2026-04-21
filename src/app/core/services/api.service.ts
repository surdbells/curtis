import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, throwError } from 'rxjs';
import { ConfigService } from './config.service';
import { ApiResponse, isApiSuccess } from '../models';

/**
 * Thin wrapper around HttpClient that:
 *   - Prepends the configured API base URL
 *   - Unwraps the ApiResponse<T> envelope ({status, message, data}) → T
 *   - Converts `status !== "0"` into an error stream
 *
 * Auth headers, refresh, offline queueing, and error toasts are all handled
 * by interceptors — this service stays focused on the envelope contract.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);

  get<T>(path: string, params?: Record<string, string | number | boolean>): Observable<T> {
    return this.http
      .get<ApiResponse<T>>(this.config.url(path), { params: this.toHttpParams(params) })
      .pipe(map((r) => this.unwrap<T>(r)));
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.http
      .post<ApiResponse<T>>(this.config.url(path), body)
      .pipe(map((r) => this.unwrap<T>(r)));
  }

  /** For endpoints that do NOT use the ApiResponse envelope (e.g. /login pre-unwrap flows). */
  raw<T>(method: 'GET' | 'POST', path: string, body?: unknown): Observable<T> {
    if (method === 'GET') return this.http.get<T>(this.config.url(path));
    return this.http.post<T>(this.config.url(path), body ?? {});
  }

  private unwrap<T>(res: ApiResponse<T>): T {
    if (isApiSuccess(res)) return res.data;
    // Throwing the envelope gives error interceptor access to status + message.
    throw res ?? { status: 'unknown', message: 'Empty response' };
  }

  private toHttpParams(params?: Record<string, string | number | boolean>): HttpParams | undefined {
    if (!params) return undefined;
    let p = new HttpParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) p = p.set(k, String(v));
    }
    return p;
  }
}
