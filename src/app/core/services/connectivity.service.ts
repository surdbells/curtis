import { Injectable, signal } from '@angular/core';
import { Network, ConnectionStatus } from '@capacitor/network';

/**
 * Reactive network status. Used by the offline-banner component, the
 * offline interceptor, and the offline-queue replay loop.
 */
@Injectable({ providedIn: 'root' })
export class ConnectivityService {
  /** Best known current network status. */
  readonly status = signal<ConnectionStatus>({ connected: true, connectionType: 'unknown' });
  readonly online = signal<boolean>(true);

  /** Call once at bootstrap to wire listeners. */
  async init(): Promise<void> {
    const current = await Network.getStatus();
    this.status.set(current);
    this.online.set(current.connected);

    await Network.addListener('networkStatusChange', (s) => {
      this.status.set(s);
      this.online.set(s.connected);
    });
  }
}
