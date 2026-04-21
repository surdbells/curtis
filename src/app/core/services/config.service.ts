import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * Thin wrapper around the environment object. Exists so anything that
 * needs config can inject a service (testable, mockable) rather than
 * importing the environment module directly.
 */
@Injectable({ providedIn: 'root' })
export class ConfigService {
  readonly apiBaseUrl = environment.apiBaseUrl;
  readonly appId = environment.appId;
  readonly env = environment.env;
  readonly production = environment.production;
  readonly tokenRefreshThresholdSec = environment.tokenRefreshThresholdSec;
  readonly gpsPingIntervalMs = environment.gpsPingIntervalMs;
  readonly offlineQueueMaxRetries = environment.offlineQueueMaxRetries;
  readonly mapTileUrl = environment.mapTileUrl;
  readonly mapAttribution = environment.mapAttribution;

  /** Builds an absolute API URL from a relative path. */
  url(path: string): string {
    const p = path.startsWith('/') ? path : `/${path}`;
    return `${this.apiBaseUrl}${p}`;
  }
}
