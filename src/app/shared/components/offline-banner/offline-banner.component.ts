import { Component, ChangeDetectionStrategy, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { ConnectivityService } from '../../../core/services/connectivity.service';
import { OfflineQueueService } from '../../../core/services/offline-queue.service';

/**
 * Compact connectivity status pill.
 *
 * Phase 7: pills are tappable — they route to /queue. Three states:
 *   - Offline (red): network is down.
 *   - Pending (amber): one or more requests queued for replay.
 *   - Failed (red, with count): one or more dead-letter rows. Stays
 *     visible until the agent clears or retries them.
 *   - Hidden: connected and queue empty.
 *
 * The component is fixed top-right via CSS so it never occludes content
 * even on dense pages.
 */
@Component({
  selector: 'curtis-offline-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonicModule],
  styles: [
    `
      :host {
        position: sticky;
        top: 0;
        z-index: 9;
        display: block;
        pointer-events: none;
      }
      .pill-wrap {
        display: flex;
        justify-content: flex-end;
        padding: 0.5rem 0.75rem 0;
      }
      .pill {
        pointer-events: auto;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.32rem 0.7rem;
        border-radius: 999px;
        font-size: 0.72rem;
        font-weight: 600;
        letter-spacing: 0.02em;
        backdrop-filter: blur(10px);
        background: color-mix(in srgb, var(--ion-color-danger) 90%, transparent);
        color: var(--ion-color-danger-contrast);
        box-shadow: var(--curtis-shadow-md);
        animation: curtis-pill-in 200ms ease-out;
        border: none;
        transition: transform 100ms ease-out;
      }
      .pill:active { transform: scale(0.95); }
      .pill.pending {
        background: color-mix(in srgb, var(--ion-color-warning) 90%, transparent);
        color: var(--ion-color-warning-contrast);
      }
      .pill.failed {
        background: var(--ion-color-danger);
        color: var(--ion-color-danger-contrast);
      }
      .pill ion-icon { font-size: 0.95rem; }
      @keyframes curtis-pill-in {
        from { opacity: 0; transform: translateY(-4px) scale(0.96); }
        to   { opacity: 1; transform: translateY(0)     scale(1);    }
      }
    `,
  ],
  template: `
    @if (state() === 'offline') {
      <div class="pill-wrap">
        <button type="button" class="pill" (click)="open()">
          <ion-icon name="cloud-offline-outline" />
          <span>Offline</span>
        </button>
      </div>
    } @else if (state() === 'failed') {
      <div class="pill-wrap">
        <button type="button" class="pill failed" (click)="open()">
          <ion-icon name="alert-circle" />
          <span>{{ queue.deadLetterCount() }} failed</span>
        </button>
      </div>
    } @else if (state() === 'pending') {
      <div class="pill-wrap">
        <button type="button" class="pill pending" (click)="open()">
          <ion-icon name="cloud-upload-outline" />
          <span>{{ queue.pendingCount() }} syncing</span>
        </button>
      </div>
    }
  `,
})
export class OfflineBannerComponent {
  protected readonly net = inject(ConnectivityService);
  protected readonly queue = inject(OfflineQueueService);
  private readonly router = inject(Router);

  /** Derived state used by the template's @if/@else chain. */
  protected readonly state = computed<'offline' | 'failed' | 'pending' | 'ok'>(() => {
    if (!this.net.online()) return 'offline';
    if (this.queue.deadLetterCount() > 0) return 'failed';
    if (this.queue.pendingCount() > 0) return 'pending';
    return 'ok';
  });

  open(): void {
    void this.router.navigateByUrl('/queue');
  }
}
