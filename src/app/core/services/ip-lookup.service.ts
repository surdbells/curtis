import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, timeout, catchError, of } from 'rxjs';

/**
 * Best-effort public IP lookup via ipify.
 *
 * Used once on login to populate LoginRequest.iPaddress for audit.
 * Timeout is short (3 s) and failure is silent — login must not be
 * blocked by an IP lookup.
 */
@Injectable({ providedIn: 'root' })
export class IpLookupService {
  private readonly http = inject(HttpClient);
  private cached: string | null = null;
  private cachedAt = 0;
  private static readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

  /**
   * Returns the current public IP address, or null on failure.
   * Cached in-memory for CACHE_TTL_MS.
   */
  async getPublicIp(): Promise<string | null> {
    if (this.cached && Date.now() - this.cachedAt < IpLookupService.CACHE_TTL_MS) {
      return this.cached;
    }

    try {
      const res = await firstValueFrom(
        this.http.get<{ ip: string }>('https://api.ipify.org?format=json').pipe(
          timeout(3_000),
          catchError(() => of(null)),
        ),
      );
      const ip = res?.ip ?? null;
      if (ip) {
        this.cached = ip;
        this.cachedAt = Date.now();
      }
      return ip;
    } catch {
      return null;
    }
  }
}
