import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import {
  PushNotifications,
  Token,
  PushNotificationSchema,
  ActionPerformed,
} from '@capacitor/push-notifications';
import { Haptics, NotificationType } from '@capacitor/haptics';

import { SessionStore } from '../stores/session.store';
import {
  PUSH_DEFAULT_ROUTES,
  type PushCategory,
  type PushPayload,
} from '../models/push.model';

const STORAGE_KEY_TOKEN = 'curtis.push.token';
const STORAGE_KEY_TOKEN_REGISTERED_FOR_USER = 'curtis.push.tokenRegisteredFor';

/**
 * Push notification service — Phase 7.
 *
 * Responsibilities:
 *   1. Request permission and register with FCM (Android) / APNs (iOS).
 *   2. Persist the device token in @capacitor/preferences so we can
 *      compare across launches and avoid re-registering with the
 *      backend unnecessarily.
 *   3. POST the token to the backend so dispatch can address pushes
 *      to the right device. **DEFERRED — endpoint not yet defined.**
 *      The intended shape is POST /RegisterPushToken with
 *      {token, platform, userId}. Phase 7 stops at writing the
 *      token to local storage and exposing it as a signal; the actual
 *      backend POST is a marked TODO so the developer can wire it
 *      against whatever endpoint the team chooses later.
 *   4. Parse incoming push payloads against the PushPayload union and
 *      surface them via the `incoming` signal for the in-app banner
 *      and any feature code that wants to react (e.g. RouteService
 *      should hot-reload on a 'route_changed' push).
 *   5. Handle taps in both foreground and background — read the
 *      payload's `route` override (or fall back to PUSH_DEFAULT_ROUTES)
 *      and navigate.
 *
 * On the web platform the entire service is a no-op — push notifications
 * are not supported in the Capacitor web shim and feature code can call
 * register() / clearIncoming() safely.
 */
@Injectable({ providedIn: 'root' })
export class PushService {
  private readonly router = inject(Router);
  private readonly session = inject(SessionStore);

  /** Device token (FCM registration id on Android, APNs token on iOS). */
  readonly token = signal<string | null>(null);
  /** Permission state from the OS. */
  readonly permission = signal<'unknown' | 'granted' | 'denied'>('unknown');
  /** True once register() has wired up the listeners. */
  readonly registered = signal<boolean>(false);

  /** Most recent successfully parsed payload (for the in-app banner). */
  readonly incoming = signal<PushPayload | null>(null);
  /** Last raw notification — useful for debug; the banner uses `incoming`. */
  readonly lastReceived = signal<PushNotificationSchema | null>(null);
  /** Last tap action — `incoming` triggers deep-link; this is for debug. */
  readonly lastTapped = signal<ActionPerformed | null>(null);

  /**
   * Register for push notifications. Idempotent — calling twice is a no-op.
   * Failure is non-fatal: the service stays in `registered=false` and the
   * agent gets an opportunity to enable permission later via app settings.
   */
  async register(): Promise<void> {
    if (this.registered()) return;
    if (!Capacitor.isNativePlatform()) {
      // Web shim — pretend success so feature code doesn't branch.
      this.registered.set(true);
      return;
    }

    try {
      // Wire listeners first so we don't race a registration callback.
      await this.attachListeners();

      // Check current permission state; request if not yet granted.
      const status = await PushNotifications.checkPermissions();
      let granted = status.receive === 'granted';
      if (!granted) {
        const request = await PushNotifications.requestPermissions();
        granted = request.receive === 'granted';
      }
      this.permission.set(granted ? 'granted' : 'denied');

      if (granted) {
        await PushNotifications.register();
      }
      this.registered.set(true);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[PushService] register failed', err);
    }
  }

  /** Clear the most-recent banner. Called after the agent dismisses it. */
  clearIncoming(): void {
    this.incoming.set(null);
  }

  /**
   * Navigate to the deep-link route for the most recent push. Called
   * when the agent taps the in-app banner.
   */
  async followIncomingDeepLink(): Promise<void> {
    const p = this.incoming();
    if (!p) return;
    const target = p.route ?? PUSH_DEFAULT_ROUTES[p.category];
    this.clearIncoming();
    await this.router.navigateByUrl(target);
  }

  // ---------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------

  private async attachListeners(): Promise<void> {
    await PushNotifications.removeAllListeners().catch(() => undefined);

    await PushNotifications.addListener('registration', async (t: Token) => {
      // eslint-disable-next-line no-console
      console.log('[PushService] registered, token len:', t.value?.length);
      await this.persistToken(t.value);
      await this.maybeSendTokenToBackend(t.value);
    });

    await PushNotifications.addListener('registrationError', (err) => {
      // eslint-disable-next-line no-console
      console.warn('[PushService] registration error', err);
    });

    await PushNotifications.addListener(
      'pushNotificationReceived',
      (n: PushNotificationSchema) => {
        this.lastReceived.set(n);
        const parsed = this.parsePayload(n);
        if (parsed) {
          this.incoming.set(parsed);
          void this.maybeHaptic(parsed.category);
          void this.maybeRunSystemAction(parsed);
        }
      },
    );

    await PushNotifications.addListener(
      'pushNotificationActionPerformed',
      async (a: ActionPerformed) => {
        this.lastTapped.set(a);
        // Background tap — the notification body lives at a.notification.data,
        // matching the foreground path.
        const parsed = this.parsePayload(a.notification);
        if (parsed) {
          const target = parsed.route ?? PUSH_DEFAULT_ROUTES[parsed.category];
          await this.router.navigateByUrl(target);
        }
      },
    );
  }

  /**
   * Persist the FCM/APNs token. If the token has changed since the last
   * launch, the cached "registered for user" marker is cleared so the
   * backend POST runs again.
   */
  private async persistToken(value: string): Promise<void> {
    this.token.set(value);

    const existing = await Preferences.get({ key: STORAGE_KEY_TOKEN }).catch(() => ({ value: null }));
    if (existing.value !== value) {
      await Preferences.set({ key: STORAGE_KEY_TOKEN, value });
      // Token rotated — backend must be re-notified.
      await Preferences.remove({ key: STORAGE_KEY_TOKEN_REGISTERED_FOR_USER });
    }
  }

  /**
   * Best-effort backend registration.
   *
   * TODO(backend): wire this to the real /RegisterPushToken endpoint once
   * the API team confirms the shape. Current placeholder logs the intent
   * and stores a "registered for {userId}+{token}" marker locally so we
   * don't try to re-register the same token on every app launch.
   *
   * The intended payload:
   *   POST /RegisterPushToken
   *   {
   *     "userid":   "<jwt user id>",
   *     "token":    "<FCM or APNs token>",
   *     "platform": "android" | "ios",
   *     "appId":    "ViewHot"
   *   }
   *
   * On 2xx the marker is written; if the call fails we leave it unwritten
   * so the next launch retries. Network failures go through the offline
   * interceptor's queue automatically.
   */
  private async maybeSendTokenToBackend(token: string): Promise<void> {
    const userId = this.session.userId();
    if (!userId) {
      // Not logged in yet — register() runs again after login.
      return;
    }

    const markerKey = `${userId}::${token}`;
    const cached = await Preferences.get({ key: STORAGE_KEY_TOKEN_REGISTERED_FOR_USER }).catch(() => ({ value: null }));
    if (cached.value === markerKey) return;

    // eslint-disable-next-line no-console
    console.info(
      '[PushService] TODO: POST /RegisterPushToken',
      { userId, token: token.slice(0, 8) + '…', platform: Capacitor.getPlatform() },
    );

    // Once the endpoint is wired, uncomment something like:
    //
    //   await firstValueFrom(this.api.post('/RegisterPushToken', {
    //     userid: userId, token, platform: Capacitor.getPlatform(), appId: this.config.appId,
    //   }));
    //
    // and then mark as registered:
    await Preferences.set({ key: STORAGE_KEY_TOKEN_REGISTERED_FOR_USER, value: markerKey });
  }

  /**
   * Parse a raw notification's `data` field against the PushPayload
   * contract. Returns null if it can't be coerced into a valid shape —
   * such notifications are still logged but not surfaced to the UI.
   */
  private parsePayload(n: PushNotificationSchema | ActionPerformed['notification']): PushPayload | null {
    const data = (n.data ?? {}) as Record<string, unknown>;
    const category = data['category'] as string | undefined;
    if (!this.isValidCategory(category)) return null;

    const title = String(data['title'] ?? n.title ?? '');
    const body = String(data['body'] ?? n.body ?? '');
    if (!title && !body) return null;

    const base = {
      category,
      title: title || 'Notification',
      body,
      route: typeof data['route'] === 'string' ? (data['route'] as string) : undefined,
      actionId: typeof data['actionId'] === 'string' ? (data['actionId'] as string) : undefined,
    };

    switch (category) {
      case 'route_changed':
        return {
          ...base,
          category: 'route_changed',
          routeId: typeof data['routeId'] === 'string' ? (data['routeId'] as string) : undefined,
        };
      case 'dispatch_message':
        return {
          ...base,
          category: 'dispatch_message',
          sender: typeof data['sender'] === 'string' ? (data['sender'] as string) : undefined,
          priority: data['priority'] === 'urgent' ? 'urgent' : 'normal',
        };
      case 'sos_acknowledged':
        return {
          ...base,
          category: 'sos_acknowledged',
          incidentId: typeof data['incidentId'] === 'string' ? (data['incidentId'] as string) : undefined,
        };
      case 'system': {
        const sa = data['systemAction'];
        return {
          ...base,
          category: 'system',
          systemAction:
            sa === 'force_logout' || sa === 'maintenance' || sa === 'update_available'
              ? sa
              : undefined,
        };
      }
      default:
        return null;
    }
  }

  private isValidCategory(c: string | undefined): c is PushCategory {
    return (
      c === 'route_changed' ||
      c === 'dispatch_message' ||
      c === 'sos_acknowledged' ||
      c === 'system'
    );
  }

  private async maybeHaptic(category: PushCategory): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      if (category === 'sos_acknowledged') {
        await Haptics.notification({ type: NotificationType.Success });
      } else if (category === 'system') {
        await Haptics.notification({ type: NotificationType.Warning });
      } else {
        await Haptics.notification({ type: NotificationType.Warning });
      }
    } catch {
      // ignore
    }
  }

  /**
   * Execute server-driven system actions for 'system' category pushes.
   * For now: 'force_logout' is the only one we handle automatically.
   * Others ('maintenance', 'update_available') are informational and
   * just show in the banner.
   */
  private async maybeRunSystemAction(p: PushPayload): Promise<void> {
    if (p.category !== 'system') return;
    if (p.systemAction === 'force_logout') {
      // Best-effort: route to login. Token cleanup happens via guards on
      // the next protected route resolution.
      await this.router.navigateByUrl('/login', { replaceUrl: true });
    }
  }
}
