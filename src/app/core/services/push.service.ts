import { Injectable, signal } from '@angular/core';
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';

/**
 * Push notification service.
 *
 * Handles registration with FCM/APNs and surfaces received notifications as
 * signals for feature code to react to.
 *
 * TODO(phase-7):
 *   - Post the device token to backend (endpoint TBD — confirm with backend)
 *   - Deep-link routing on notification tap
 *   - Foreground vs. background display strategy
 */
@Injectable({ providedIn: 'root' })
export class PushService {
  readonly token = signal<string | null>(null);
  readonly lastReceived = signal<PushNotificationSchema | null>(null);
  readonly lastTapped = signal<ActionPerformed | null>(null);

  async register(): Promise<void> {
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== 'granted') {
      throw new Error('Push permission denied');
    }

    PushNotifications.addListener('registration', (t: Token) => {
      this.token.set(t.value);
      // TODO(phase-7): POST the token to backend for the current user.
    });

    PushNotifications.addListener('registrationError', (err) => {
      // eslint-disable-next-line no-console
      console.warn('Push registration error', err);
    });

    PushNotifications.addListener('pushNotificationReceived', (n) => {
      this.lastReceived.set(n);
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (a) => {
      this.lastTapped.set(a);
    });

    await PushNotifications.register();
  }

  async unregister(): Promise<void> {
    await PushNotifications.removeAllListeners();
    this.token.set(null);
  }
}
