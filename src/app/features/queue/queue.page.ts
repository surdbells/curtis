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
import { OfflineBannerComponent } from '../../shared/components/offline-banner/offline-banner.component';
import { CurtisIconComponent } from '../../shared/components/icon';
import type { QueuedRequest } from '../../core/models';

/**
 * Sync queue — Phase 9 premium redesign.
 *
 * Layout:
 *   - Header strip with 2 stat blocks (pending, failed)
 *   - 'Drain now' CTA when there are pending rows + online
 *   - Pending section: rows with retry+discard buttons
 *   - Failed section: dead-letter rows with same actions
 *   - 'Clear all' destructive footer button
 *
 * Empty state when both lists are 0: large success icon-well +
 * encouraging copy.
 *
 * Behavior preserved from Phase 7.
 */
@Component({
  selector: 'curtis-queue',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonicModule, OfflineBannerComponent, CurtisIconComponent],
  styles: [
    `
      :host { display: block; }
      ion-content { --background: var(--curtis-bg); }

      .stats {
        margin: var(--curtis-space-3) var(--curtis-space-4);
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--curtis-space-3);
      }
      .stat {
        background: var(--curtis-surface-1);
        border: 1px solid var(--curtis-border);
        border-radius: var(--curtis-radius-lg);
        padding: var(--curtis-space-4);
        display: flex;
        flex-direction: column;
        gap: var(--curtis-space-1);
        box-shadow: var(--curtis-shadow-xs);
      }
      .stat__head {
        display: flex;
        align-items: center;
        gap: var(--curtis-space-1_5);
        font-size: var(--curtis-text-xs);
        font-weight: var(--curtis-weight-semibold);
        letter-spacing: var(--curtis-tracking-wider);
        text-transform: uppercase;
        color: var(--curtis-text-subtle);
      }
      .stat__value {
        font-size: var(--curtis-text-2xl);
        font-weight: var(--curtis-weight-extrabold);
        font-variant-numeric: tabular-nums;
        color: var(--curtis-text);
        line-height: 1;
      }
      .stat.warn .stat__value { color: var(--amber-500); }
      .stat.bad  .stat__value { color: var(--red-500); }
      .stat.warn .stat__head  { color: var(--amber-500); }
      .stat.bad  .stat__head  { color: var(--red-500); }

      .drain-cta {
        margin: 0 var(--curtis-space-4) var(--curtis-space-3);
      }

      .section-label {
        margin: var(--curtis-space-4) var(--curtis-space-5) var(--curtis-space-2);
        font-size: var(--curtis-text-xs);
        font-weight: var(--curtis-weight-bold);
        letter-spacing: var(--curtis-tracking-wider);
        text-transform: uppercase;
        color: var(--curtis-text-subtle);
      }
      .section-label.warn { color: var(--amber-500); }
      .section-label.bad  { color: var(--red-500); }

      .list {
        padding: 0 var(--curtis-space-4);
        display: flex;
        flex-direction: column;
        gap: var(--curtis-space-2);
      }
      .row {
        display: flex;
        align-items: flex-start;
        gap: var(--curtis-space-3);
        padding: var(--curtis-space-3) var(--curtis-space-4);
        background: var(--curtis-surface-1);
        border: 1px solid var(--curtis-border);
        border-radius: var(--curtis-radius-lg);
        box-shadow: var(--curtis-shadow-xs);
      }
      .row.dead { border-left: 3px solid var(--red-500); }

      .row__icon {
        width: 36px;
        height: 36px;
        border-radius: var(--curtis-radius-md);
        background: color-mix(in srgb, var(--ion-color-primary) 12%, transparent);
        color: var(--ion-color-primary);
        display: grid;
        place-items: center;
        flex-shrink: 0;
      }
      .row.dead .row__icon {
        background: color-mix(in srgb, var(--ion-color-danger) 12%, transparent);
        color: var(--red-500);
      }

      .row__body { flex: 1; min-width: 0; }
      .row__method {
        display: inline-block;
        padding: 1px 6px;
        border-radius: var(--curtis-radius-xs);
        font-size: 10px;
        font-weight: var(--curtis-weight-bold);
        letter-spacing: var(--curtis-tracking-wider);
        background: var(--curtis-surface-2);
        color: var(--curtis-text-muted);
        margin-right: var(--curtis-space-2);
        font-family: var(--curtis-font-mono);
      }
      .row__path {
        font-family: var(--curtis-font-mono);
        font-size: var(--curtis-text-xs);
        color: var(--curtis-text);
        font-weight: var(--curtis-weight-semibold);
        word-break: break-all;
      }
      .row__meta {
        margin-top: var(--curtis-space-1);
        font-size: var(--curtis-text-xs);
        color: var(--curtis-text-subtle);
        font-variant-numeric: tabular-nums;
      }
      .row__error {
        margin-top: var(--curtis-space-2);
        padding: var(--curtis-space-1_5) var(--curtis-space-2);
        background: color-mix(in srgb, var(--ion-color-danger) 8%, transparent);
        border-radius: var(--curtis-radius-sm);
        font-size: var(--curtis-text-xs);
        color: var(--red-600);
        display: flex;
        gap: var(--curtis-space-1_5);
        align-items: flex-start;
      }

      .row__actions {
        display: flex;
        flex-direction: column;
        gap: var(--curtis-space-1);
        flex-shrink: 0;
      }
      .row__actions ion-button {
        min-height: 36px;
        --padding-start: var(--curtis-space-2);
        --padding-end: var(--curtis-space-2);
      }

      .footer-actions {
        padding: var(--curtis-space-6) var(--curtis-space-4) calc(var(--curtis-space-8) + env(safe-area-inset-bottom, 0));
        display: flex;
        justify-content: center;
      }

      /* Empty state */
      .empty {
        height: 70vh;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        gap: var(--curtis-space-3);
        padding: var(--curtis-space-6);
      }
      .empty__well {
        width: 88px;
        height: 88px;
        border-radius: var(--curtis-radius-xl);
        background: color-mix(in srgb, var(--ion-color-success) 12%, transparent);
        color: var(--green-600);
        display: grid;
        place-items: center;
      }
      .empty__title {
        font-size: var(--curtis-text-lg);
        font-weight: var(--curtis-weight-bold);
        color: var(--curtis-text);
      }
      .empty__body {
        font-size: var(--curtis-text-sm);
        color: var(--curtis-text-muted);
        max-width: 22rem;
      }
    `,
  ],
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/dashboard"></ion-back-button>
        </ion-buttons>
        <ion-title>Sync queue</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content [fullscreen]="true">
      <ion-refresher slot="fixed" (ionRefresh)="onPullRefresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <curtis-offline-banner />

      @if (total() === 0) {
        <div class="empty">
          <div class="empty__well">
            <curtis-icon name="checkmark-circle-outline" size="xl" [strokeWidth]="1.5" />
          </div>
          <div class="empty__title">All caught up</div>
          <div class="empty__body">
            Every request has been synced. Nothing is waiting in the queue.
          </div>
        </div>
      } @else {
        <!-- Stats -->
        <div class="stats">
          <div class="stat" [class.warn]="queue.pendingCount() > 0">
            <div class="stat__head">
              <curtis-icon name="cloud-upload-outline" size="xs" />
              Pending
            </div>
            <div class="stat__value">{{ queue.pendingCount() }}</div>
          </div>
          <div class="stat" [class.bad]="queue.deadLetterCount() > 0">
            <div class="stat__head">
              <curtis-icon name="warning-outline" size="xs" />
              Failed
            </div>
            <div class="stat__value">{{ queue.deadLetterCount() }}</div>
          </div>
        </div>

        @if (pendingRows().length > 0 && connectivity.online()) {
          <div class="drain-cta">
            <ion-button expand="block" [disabled]="queue.draining()" (click)="drainNow()">
              @if (queue.draining()) {
                <ion-spinner slot="start" name="crescent" />
                Draining…
              } @else {
                <curtis-icon slot="start" name="cloud-upload-outline" size="sm" />
                Drain now
              }
            </ion-button>
          </div>
        }

        <!-- Pending rows -->
        @if (pendingRows().length > 0) {
          <div class="section-label warn">Pending sync ({{ pendingRows().length }})</div>
          <div class="list">
            @for (r of pendingRows(); track r.id) {
              <div class="row">
                <div class="row__icon">
                  <curtis-icon name="cloud-upload-outline" size="sm" />
                </div>
                <div class="row__body">
                  <div>
                    <span class="row__method">{{ r.method }}</span>
                    <span class="row__path">{{ shortPath(r.url) }}</span>
                  </div>
                  <div class="row__meta">
                    Queued {{ formatRel(r.createdAt) }} · {{ r.retryCount }} attempts
                  </div>
                  @if (r.lastError) {
                    <div class="row__error">
                      <curtis-icon name="warning-outline" size="xs" />
                      {{ r.lastError }}
                    </div>
                  }
                </div>
                <div class="row__actions">
                  <ion-button fill="solid" color="primary" size="small" (click)="retry(r)">
                    <curtis-icon slot="icon-only" name="reload-outline" size="sm" />
                  </ion-button>
                  <ion-button fill="outline" color="danger" size="small" (click)="confirmDiscard(r)">
                    <curtis-icon slot="icon-only" name="trash-outline" size="sm" />
                  </ion-button>
                </div>
              </div>
            }
          </div>
        }

        <!-- Failed rows (dead-letter) -->
        @if (deadRows().length > 0) {
          <div class="section-label bad">Failed ({{ deadRows().length }})</div>
          <div class="list">
            @for (r of deadRows(); track r.id) {
              <div class="row dead">
                <div class="row__icon">
                  <curtis-icon name="warning-outline" size="sm" />
                </div>
                <div class="row__body">
                  <div>
                    <span class="row__method">{{ r.method }}</span>
                    <span class="row__path">{{ shortPath(r.url) }}</span>
                  </div>
                  <div class="row__meta">
                    Queued {{ formatRel(r.createdAt) }} · {{ r.retryCount }} attempts
                  </div>
                  @if (r.lastError) {
                    <div class="row__error">
                      <curtis-icon name="warning-outline" size="xs" />
                      {{ r.lastError }}
                    </div>
                  }
                </div>
                <div class="row__actions">
                  <ion-button fill="solid" color="primary" size="small" (click)="retry(r)">
                    <curtis-icon slot="icon-only" name="reload-outline" size="sm" />
                  </ion-button>
                  <ion-button fill="outline" color="danger" size="small" (click)="confirmDiscard(r)">
                    <curtis-icon slot="icon-only" name="trash-outline" size="sm" />
                  </ion-button>
                </div>
              </div>
            }
          </div>
        }

        <div class="footer-actions">
          <ion-button fill="clear" color="danger" (click)="confirmClearAll()">
            <curtis-icon slot="start" name="trash-bin-outline" size="sm" />
            Clear entire queue
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
    } catch { /* non-fatal */ }
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

  protected shortPath(url: string): string {
    try {
      const u = new URL(url);
      return u.pathname + (u.search || '');
    } catch {
      return url;
    }
  }

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
