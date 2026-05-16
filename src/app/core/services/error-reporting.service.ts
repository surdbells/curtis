import { Injectable, inject, signal, effect } from '@angular/core';
import * as Sentry from '@sentry/angular';
import { Capacitor } from '@capacitor/core';
import { ConfigService } from './config.service';
import { SessionStore } from '../stores/session.store';

/**
 * Centralised error reporting facade. Wraps @sentry/angular so the rest
 * of the app never depends on the SDK directly.
 *
 * Behaviour:
 *   - If config.sentryDsn is non-empty, Sentry is initialised with it
 *     and `enabled` becomes true. Errors captured via this service flow
 *     to the Sentry project for the current release tag.
 *   - If config.sentryDsn is empty (the default dev configuration),
 *     init() is a no-op. captureError / captureMessage / addBreadcrumb
 *     all run, log to console, and return without contacting Sentry.
 *
 * This means feature code can safely call this service unconditionally;
 * no env guards needed at the call site.
 *
 * What gets captured automatically (once enabled):
 *   - Unhandled errors via Angular's global ErrorHandler
 *     (Sentry.createErrorHandler() — wired in main.ts via providers).
 *   - HTTP failures via the Sentry-aware HttpClient interceptor
 *     (provideHttpClient(withInterceptorsFromDi()) + Sentry's TraceService
 *     when tracing is enabled).
 *
 * What gets captured manually here:
 *   - Background tracker POST failures (TrackerService.post).
 *   - Offline queue dead-letter events (OfflineQueueService.handleFailure
 *     when retry_count hits 10).
 *   - Incident submission failures (IncidentService.report).
 *   - SQLite init failures (StorageService.init catch path).
 *   - Push notification registration errors (PushService.register catch).
 *
 * What gets scrubbed before send (beforeSend hook):
 *   - Authorization headers and any field named accessToken / refreshToken.
 *   - The exact request body of /login (passwords never leave the device).
 */
@Injectable({ providedIn: 'root' })
export class ErrorReportingService {
  private readonly config = inject(ConfigService);
  private readonly session = inject(SessionStore);

  /** True after a successful Sentry.init with a non-empty DSN. */
  readonly enabled = signal<boolean>(false);

  constructor() {
    // Mirror the in-memory session user-id into Sentry's scope whenever it
    // changes. No-op when the SDK isn't initialised.
    effect(() => {
      const user = this.session.user();
      if (this.enabled()) {
        this.setUser(user?.id ?? null, user?.email ?? null);
      }
    });
  }

  /**
   * Initialise Sentry. Called once at app bootstrap from main.ts BEFORE
   * bootstrapApplication so the global ErrorHandler can hook into the
   * SDK on its first tick.
   */
  init(): void {
    if (!this.config.sentryDsn) {
      // eslint-disable-next-line no-console
      console.info('[ErrorReportingService] Sentry DSN empty — running in no-op mode.');
      return;
    }

    try {
      Sentry.init({
        dsn: this.config.sentryDsn,
        environment: this.config.env,
        release: this.config.sentryRelease,
        tracesSampleRate: this.config.sentryTracesSampleRate,
        // Tag every event with the runtime platform so we can split by
        // iOS / Android / Web in the Sentry UI.
        initialScope: {
          tags: {
            platform: Capacitor.getPlatform(),
            isNative: String(Capacitor.isNativePlatform()),
          },
        },
        beforeSend: (event) => this.scrubSensitive(event),
        beforeBreadcrumb: (breadcrumb) => this.scrubBreadcrumb(breadcrumb),
      });
      this.enabled.set(true);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[ErrorReportingService] Sentry.init failed', err);
    }
  }

  /**
   * Attach identifying information for the current session. Called by
   * SessionStore whenever the authenticated user changes. The user id is
   * a GUID — not PII — but we send it so we can correlate events to a
   * single agent for triage.
   */
  setUser(userId: string | null, email?: string | null): void {
    if (!this.enabled()) return;
    try {
      if (userId) {
        Sentry.setUser({ id: userId, email: email ?? undefined });
      } else {
        Sentry.setUser(null);
      }
    } catch {
      // ignore
    }
  }

  /**
   * Manually capture an exception with optional context.
   *
   * @param error Any thrown value. If it's not an Error instance, it's
   *              wrapped in one so the stack is preserved.
   * @param context A free-form tag bag. Common keys: `feature`, `userId`,
   *                `endpoint`, `status`.
   */
  captureError(error: unknown, context: Record<string, unknown> = {}): void {
    if (!this.enabled()) {
      // Even in no-op mode, log to console so dev still sees the trail.
      // eslint-disable-next-line no-console
      console.warn('[ErrorReportingService:noop]', error, context);
      return;
    }
    try {
      const err = error instanceof Error ? error : new Error(String(error));
      Sentry.captureException(err, {
        extra: context,
        tags: this.deriveTags(context),
      });
    } catch {
      // ignore — never let reporting throw into application code
    }
  }

  /** Manually capture a string-level event (e.g. a notable but non-error condition). */
  captureMessage(
    message: string,
    level: 'info' | 'warning' | 'error' = 'info',
    context: Record<string, unknown> = {},
  ): void {
    if (!this.enabled()) {
      // eslint-disable-next-line no-console
      console.info(`[ErrorReportingService:noop] (${level}) ${message}`, context);
      return;
    }
    try {
      Sentry.captureMessage(message, {
        level,
        extra: context,
        tags: this.deriveTags(context),
      });
    } catch {
      // ignore
    }
  }

  /**
   * Drop a breadcrumb (a non-event log line that travels alongside the
   * next captured event). Use this to record state changes, navigation,
   * and significant business events that help debug a later error.
   */
  addBreadcrumb(message: string, category?: string, data?: Record<string, unknown>): void {
    if (!this.enabled()) return;
    try {
      Sentry.addBreadcrumb({
        message,
        category,
        data,
        timestamp: Date.now() / 1000,
      });
    } catch {
      // ignore
    }
  }

  /** Pull a couple of string-typed values from context into Sentry tags for grouping. */
  private deriveTags(context: Record<string, unknown>): Record<string, string> {
    const tags: Record<string, string> = {};
    for (const key of ['feature', 'endpoint', 'category']) {
      const v = context[key];
      if (typeof v === 'string' && v.length < 80) tags[key] = v;
    }
    return tags;
  }

  /**
   * Strip Authorization headers, JWT tokens, and password fields from
   * outbound events. Sentry's default scrubber catches some of this
   * server-side; we do client-side belt-and-braces.
   */
  private scrubSensitive(event: Sentry.ErrorEvent): Sentry.ErrorEvent | null {
    try {
      // Headers on HTTP breadcrumbs may include Authorization.
      // (Already scrubbed in beforeBreadcrumb, but request fixtures here too.)
      const req = (event.request ?? {}) as { headers?: Record<string, string>; data?: unknown; url?: string };
      if (req.headers) {
        if (req.headers['Authorization']) req.headers['Authorization'] = '[Filtered]';
        if (req.headers['authorization']) req.headers['authorization'] = '[Filtered]';
      }
      // Request body on /login — drop entirely.
      if (typeof req.url === 'string' && req.url.includes('/login') && req.data) {
        req.data = '[Filtered]';
      }
      // Scrub extra/context fields named like a token or password.
      const extra = event.extra ?? {};
      for (const key of Object.keys(extra)) {
        if (/(token|password|secret|authorization)/i.test(key)) {
          extra[key] = '[Filtered]';
        }
      }
      event.extra = extra;
    } catch {
      // never let scrubbing throw
    }
    return event;
  }

  private scrubBreadcrumb(b: Sentry.Breadcrumb): Sentry.Breadcrumb | null {
    try {
      // The 'fetch' / 'xhr' breadcrumbs have a `data.url` and `data.request_headers`.
      const data = (b.data ?? {}) as Record<string, unknown>;
      const headers = data['request_headers'] as Record<string, string> | undefined;
      if (headers && typeof headers === 'object') {
        if (headers['Authorization']) headers['Authorization'] = '[Filtered]';
        if (headers['authorization']) headers['authorization'] = '[Filtered]';
      }
      // Drop login request body entirely.
      if (typeof data['url'] === 'string' && (data['url'] as string).includes('/login')) {
        if ('request_body' in data) data['request_body'] = '[Filtered]';
      }
      b.data = data;
    } catch {
      // ignore
    }
    return b;
  }
}
