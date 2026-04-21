import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { parseStringPromise } from 'xml2js';

/**
 * Loads the legacy XML reference files (banks.xml, branches.xml, retail.xml,
 * rtbranch.xml) shipped with the app as an offline fallback for the
 * corresponding /GetBanks, /GetBranchesByState/... endpoints.
 *
 * The original Android app loaded these from `assets/`; we continue the
 * convention by placing them under `src/assets/data/` and fetching via
 * HttpClient from `assets/data/<file>.xml`.
 *
 * TODO(phase-5): obtain the actual XML files from the legacy project and
 * commit them under src/assets/data/. Until then this service is wired but
 * the files are absent — loading will 404 until they exist.
 */
@Injectable({ providedIn: 'root' })
export class XmlLoaderService {
  private readonly http = inject(HttpClient);
  private cache = new Map<string, unknown>();

  async load<T = unknown>(filename: 'banks' | 'branches' | 'retail' | 'rtbranch'): Promise<T> {
    const hit = this.cache.get(filename);
    if (hit) return hit as T;

    const xml = await firstValueFrom(
      this.http.get(`assets/data/${filename}.xml`, { responseType: 'text' }),
    );
    const parsed = await parseStringPromise(xml, { explicitArray: false, trim: true });
    this.cache.set(filename, parsed);
    return parsed as T;
  }

  clearCache(): void {
    this.cache.clear();
  }
}
