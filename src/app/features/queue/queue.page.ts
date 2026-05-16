import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AlertController, IonicModule, ToastController } from '@ionic/angular';

import { OfflineQueueService } from '../../core/services/offline-queue.service';
import { ConnectivityService } from '../../core/services/connectivity.service';
import type { QueuedRequest } from '../../core/models';

/**
 * Sync queue inspection — Phase 7 Commit 2.
 *
 * Lists every row in queued_requests, split into two sections:
 *   1. Pending — visible to the drain worker, currently sized 1.. or
 *      waiting for next_attempt_at to elapse.
 *   2. Dead-letter — exceeded 10 retries. Hidden from the worker; the
 *      agent must retry or discard manually.
 *
 * Affordances per row:
 *   - Retry — flip dead-letter back to pending OR force-trigger a drain
 *             for a pending row (in case the timer hasn't fired yet).
 *   - Discard — permanently delete the row.
 *
 * Affordances above the list:
 *   - Refresh — re-query the table (pull-to-refresh or button).
 *   - Drain now — manually trigger the worker (useful for testing).
 *   - Clear all — delete every row (confirmed via dialog).
 */
import { CurtisIconComponent } from '../../shared/components/icon';

@Component({
  selector: 'curtis-queue',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonicModule, CurtisIconComponent],
  styles: [
    `
      :host { display: block; }
      ion-content { --background: var(--curtis-bg); }

      .summary {
        margin: 0.75rem;
        padding: 0.75rem 1rem;
        background: var(--curtis-surface-1);
        border: 1px solid var(--curtis-border);
        border-radius: var(--curtis-radius-md);
        box-shadow: var(--curtis-shadow-sm);
        display: flex; align-items: center; justify-content: space-between;
        gap: 0.5rem;
      }
      .summary-counts { display: flex; gap: 0.5rem; }
      .count-pill {
        display: inline-flex; align-items: center; gap: 0.3rem;
        padding: 0.3rem 0.7rem;
        border-radius: 999px;
        font-size: 0.78rem; font-weight: 600;
        background: var(--curtis-surface-2);
        color: var(--curtis-text-muted);
      }
      .count-pill.pending { background: color-mix(in srgb, var(--ion-color-warning) 18%, transparent); color: var(--ion-color-warning-shade); }
      .count-pill.dead    { background: color-mix(in srgb, var(--ion-color-danger) 18%, transparent);  color: var(--ion-color-danger); }
      .summary ion-button { --border-radius: 999px; }

      .empty {
        text-align: center;
        padding: 3rem 1rem;
        color: var(--curtis-text-subtle);
      }
      .empty ion-icon { font-size: 3rem; opacity: 0.45; }

      .row {
        display: flex; align-items: flex-start; gap: 0.65rem;
        padding: 0.75rem 1rem;
        background: var(--curtis-surface-1);
        border: 1px solid var(--curtis-border);
        border-radius: var(--curtis-radius-md);
        margin: 0 0.75rem 0.5rem;
        box-shadow: var(--curtis-shadow-sm);
      }
      .row.dead {
        border-color: color-mix(in srgb, var(--ion-color-danger) 45%, var(--curtis-border));
      }
      .row .body { flex: 1; min-width: 0; }
      .row .head {
        display: flex; align-items: center; gap: 0.4rem;
        margin-bottom: 0.2rem;
      }
      .row .method {
        font-size: 0.65rem; font-weight: 700;
        padding: 0.1rem 0.4rem;
        border-radius: 4px;
        background: var(--ion-color-primary);
        color: var(--ion-color-primary-contrast);
        letter-spacing: 0.05em;
      }
      .row .path {
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 0.82rem;
        color: var(--curtis-text);
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .row .meta {
        font-size: 0.72rem;
        color: var(--curtis-text-subtle);
        font-variant-numeric: tabular-nums;
        margin-top: 0.2rem;
      }
      .row .error {
        font-size: 0.72rem;
        color: var(--ion-color-danger);
        margin-top: 0.2rem;
        word-break: break-word;
      }
      .row .actions {
        display: flex; flex-direction: column; gap: 0.25rem;
        flex-shrink: 0;
      }
      .row .actions ion-button {
        --padding-start: 0.6rem;
        --padding-end: 0.6rem;
        height: 32px; font-size: 0.78rem;
        --border-radius: 6px;
      }

      .section-label {
        margin: 1.25rem 1rem 0.5rem;
        font-size: 0.72rem; font-weight: 700;
        letter-spacing: 0.08em; text-transform: uppercase;
        color: var(--curtis-text-subtle);
      }
      .section-label.dead { color: var(--ion-color-danger); }

      .drain-strip {
        margin: 0 0.75rem 0.75rem;
        padding: 0.55rem 0.85rem;
        background: color-mix(in srgb, var(--ion-color-success) 15%, transparent);
        border: 1px solid color-mix(in srgb, var(--ion-color-success) 35%, transparent);
        border-radius: var(--curtis-radius-sm);
        font-size: 0.78rem;
        color: var(--ion-color-success-shade);
        display: flex; align-items: center; gap: 0.4rem;
      }
    `,
  ],
  template: `
    <ion-header translucent>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/dashboard" />
        </ion-buttons>
        <ion-title>Sync queue</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="refresh()" [disabled]="loading()">
            <curtis-icon slot="icon-only" name="refresh-outline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="onPullRefresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="summary">
        <div class="summary-counts">
          <span class="count-pill pending">
            <curtis-icon name="cloud-upload-outline" />
            {{ queue.pendingCount() }} pending
          </span>
          @if (queue.deadLetterCount() > 0) {
            <span class="count-pill dead">
              <curtis-icon name="alert-circle-outline" />
              {{ queue.deadLetterCount() }} failed
            </span>
          }
        </div>
        <ion-button
          size="small" fill="solid"
          [disabled]="queue.draining() || !connectivity.online() || total() === 0"
          (click)="drainNow()"
        >
          @if (queue.draining()) {
            <ion-spinner slot="start" name="crescent" />
            Draining…
          } @else {
            <curtis-icon slot="start" name="play-outline" />
            Drain now
          }
        </ion-button>
      </div>

      @if (queue.draining()) {
        <div class="drain-strip">
          <ion-spinner name="dots" />
          Replaying queued requests…
        </div>
      }

      @if (!connectivity.online()) {
        <div class="drain-strip" style="background: color-mix(in srgb, var(--ion-color-warning) 18%, transparent); color: var(--ion-color-warning-shade); border-color: color-mix(in srgb, var(--ion-color-warning) 40%, transparent);">
          <curtis-icon name="cloud-offline-outline" />
          Offline — queue will drain when connection returns.
        </div>
      }

      @if (loading()) {
        <div class="empty">
          <ion-spinner name="crescent" />
          <p>Loading queue…</p>
        </div>
      } @else if (total() === 0) {
        <div class="empty">
          <curtis-icon name="checkmark-done-circle-outline" />
          <h3 style="margin-top: 0.75rem;">All synced</h3>
          <p>No queued requests waiting for delivery.</p>
        </div>
      } @else {
        @if (pendingRows().length > 0) {
          <div class="section-label">Pending</div>
          @for (r of pendingRows(); track r.id) {
            <div class="row">
              <div class="body">
                <div class="head">
                  <span class="method">{{ r.method }}</span>
                  <span class="path">{{ shortPath(r.url) }}</span>
                </div>
                <div class="meta">
                  Queued {{ formatRel(r.createdAt) }}
                  @if (r.retryCount > 0) {
                    · {{ r.retryCount }} attempt(s)
                  }
                  @if (r.nextAttemptAt) {
                    · next try {{ formatRel(r.nextAttemptAt) }}
                  }
                </div>
                @if (r.lastError) {
                  <div class="error">
                    <curtis-icon name="warning-outline" /> {{ r.lastError }}
                  </div>
                }
              </div>
              <div class="actions">
                <ion-button fill="outline" (click)="retry(r)">
                  <curtis-icon slot="icon-only" name="reload-outline" />
                </ion-button>
                <ion-button fill="outline" color="danger" (click)="confirmDiscard(r)">
                  <curtis-icon slot="icon-only" name="trash-outline" />
                </ion-button>
              </div>
            </div>
          }
        }

        @if (deadRows().length > 0) {
          <div class="section-label dead">Failed (manual handling required)</div>
          @for (r of deadRows(); track r.id) {
            <div class="row dead">
              <div class="body">
                <div class="head">
                  <span class="method">{{ r.method }}</span>
                  <span class="path">{{ shortPath(r.url) }}</span>
                </div>
                <div class="meta">
                  Queued {{ formatRel(r.createdAt) }}
                  · {{ r.retryCount }} attempts
                </div>
                @if (r.lastError) {
                  <div class="error">
                    <curtis-icon name="warning-outline" /> {{ r.lastError }}
                  </div>
                }
              </div>
              <div class="actions">
                <ion-button fill="solid" color="primary" (click)="retry(r)">
                  <curtis-icon slot="icon-only" name="reload-outline" />
                </ion-button>
                <ion-button fill="outline" color="danger" (click)="confirmDiscard(r)">
                  <curtis-icon slot="icon-only" name="trash-outline" />
                </ion-button>
              </div>
            </div>
          }
        }

        <div style="padding: 1rem; display: flex; justify-content: center;">
          <ion-button fill="clear" color="danger" (click)="confirmClearAll()">
            <curtis-icon slot="start" name="trash-bin-outline" />
            Clear all
          </ion-button>
        </div>
      }
    </ion-content>
  `,
})
export class QueuePage implements OnInit {
  protected readonly queue = inject(OfflineQueueService);
  protected readonly connectivity = inject(ConnectivityService);
  private readonly alerts = inject(AlertController);
  private readonly toast = inject(ToastController);

  protected readonly rows = signal<QueuedRequest[]>([]);
  protected readonly loading = signal(false);

  protected readonly pendingRows = computed(() =>
    this.rows().filter((r) => r.status !== 'dead_letter'),
  );
  protected readonly deadRows = computed(() =>
    this.rows().filter((r) => r.status === 'dead_letter'),
  );
  protected readonly total = computed(() => this.rows().length);

  async ngOnInit(): Promise<void> {
    await this.refresh();
  }

  async refresh(): Promise<void> {
    this.loading.set(true);
    try {
      const list = await this.queue.list();
      this.rows.set(list);
    } finally {
      this.loading.set(false);
    }
  }

  async onPullRefresh(event: CustomEvent): Promise<void> {
    await this.refresh();
    (event.target as HTMLIonRefresherElement).complete();
  }

  async drainNow(): Promise<void> {
    try {
      await this.queue.drain();
      await this.refresh();
    } catch {
      // Drain failures are non-fatal — individual row state already updated.
    }
  }

  async retry(r: QueuedRequest): Promise<void> {
    if (!r.id) return;
    try {
      await this.queue.retryRow(r.id);
      await this.refresh();
      await this.showToast(
        this.connectivity.online() ? 'Retrying…' : 'Will retry when online.',
        'success',
      );
    } catch (err) {
      await this.showToast(this.describeError(err, 'Retry failed.'), 'danger');
    }
  }

  async confirmDiscard(r: QueuedRequest): Promise<void> {
    if (!r.id) return;
    const alert = await this.alerts.create({
      header: 'Discard this request?',
      message: `${r.method} ${this.shortPath(r.url)}\n\nThis cannot be undone. The data will be lost permanently.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Discard',
          role: 'destructive',
          handler: async () => {
            await this.queue.discardRow(r.id!);
            await this.refresh();
            await this.showToast('Request discarded.', 'success');
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  async confirmClearAll(): Promise<void> {
    const alert = await this.alerts.create({
      header: 'Clear entire queue?',
      message: `All ${this.total()} queued request(s) will be permanently deleted. This cannot be undone.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Clear all',
          role: 'destructive',
          handler: async () => {
            await this.queue.clearAll();
            await this.refresh();
            await this.showToast('Queue cleared.', 'success');
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  /** Strip base URL host/protocol from the URL for display. */
  protected shortPath(url: string): string {
    try {
      const u = new URL(url);
      return u.pathname + (u.search || '');
    } catch {
      return url;
    }
  }

  /**
   * Friendly relative timestamp like "3m ago" or "in 12s". Uses Intl
   * RelativeTimeFormat for i18n correctness.
   */
  protected formatRel(iso: string): string {
    const t = new Date(iso).getTime();
    if (!Number.isFinite(t)) return '';
    const deltaSec = Math.round((t - Date.now()) / 1000);
    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto', style: 'short' });
    const abs = Math.abs(deltaSec);
    if (abs < 60)     return rtf.format(deltaSec, 'second');
    if (abs < 3600)   return rtf.format(Math.round(deltaSec / 60), 'minute');
    if (abs < 86400)  return rtf.format(Math.round(deltaSec / 3600), 'hour');
    return rtf.format(Math.round(deltaSec / 86400), 'day');
  }

  private describeError(err: unknown, fallback: string): string {
    if (err && typeof err === 'object') {
      const e = err as { message?: string };
      if (typeof e.message === 'string' && e.message.trim()) return e.message;
    }
    return fallback;
  }

  private async showToast(message: string, color: 'danger' | 'warning' | 'success') {
    const t = await this.toast.create({
      message, duration: 2500, position: 'top', color,
      buttons: [{ icon: 'close', role: 'cancel' }],
    });
    await t.present();
  }
}
