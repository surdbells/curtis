import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { ConnectivityService } from '../../../core/services/connectivity.service';
import { OfflineQueueService } from '../../../core/services/offline-queue.service';

/**
 * Compact connectivity status pill.
 *
 * Phases up from the previous full-width banner to a floating chip:
 *   - Top-right floating pill, animates in/out
 *   - Red when offline, amber when synced-but-pending, hidden when all clear
 *   - Pure presentational — host pages just drop <curtis-offline-banner />
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
      }
      .pill.pending {
        background: color-mix(in srgb, var(--ion-color-warning) 90%, transparent);
        color: var(--ion-color-warning-contrast);
      }
      .pill ion-icon { font-size: 0.95rem; }
      @keyframes curtis-pill-in {
        from { opacity: 0; transform: translateY(-4px) scale(0.96); }
        to   { opacity: 1; transform: translateY(0)     scale(1);    }
      }
    `,
  ],
  template: `
    @if (!net.online()) {
      <div class="pill-wrap">
        <div class="pill">
          <ion-icon name="cloud-offline-outline" />
          <span>Offline</span>
        </div>
      </div>
    } @else if (queue.pendingCount() > 0) {
      <div class="pill-wrap">
        <div class="pill pending">
          <ion-icon name="cloud-upload-outline" />
          <span>{{ queue.pendingCount() }} syncing</span>
        </div>
      </div>
    }
  `,
})
export class OfflineBannerComponent {
  protected readonly net = inject(ConnectivityService);
  protected readonly queue = inject(OfflineQueueService);
}
