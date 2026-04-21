import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { ConnectivityService } from '../../../core/services/connectivity.service';
import { OfflineQueueService } from '../../../core/services/offline-queue.service';

/**
 * Thin banner that appears at the top of any page when:
 *   - the device is offline, OR
 *   - the offline queue has pending requests waiting to sync.
 *
 * Consumers drop <curtis-offline-banner /> at the top of their ion-content.
 */
@Component({
  selector: 'curtis-offline-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonicModule],
  styles: [
    `
      :host {
        display: block;
      }
      .bar {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 0.75rem;
        background: var(--ion-color-warning);
        color: var(--ion-color-warning-contrast);
        font-size: 0.85rem;
      }
      .bar.offline {
        background: var(--ion-color-danger);
        color: var(--ion-color-danger-contrast);
      }
    `,
  ],
  template: `
    @if (!net.online() || queue.pendingCount() > 0) {
      <div class="bar" [class.offline]="!net.online()">
        <ion-icon [name]="net.online() ? 'cloud-upload-outline' : 'cloud-offline-outline'" />
        @if (!net.online()) {
          <span>Offline — actions will sync when connection returns</span>
        } @else if (queue.pendingCount() > 0) {
          <span>{{ queue.pendingCount() }} pending {{ queue.pendingCount() === 1 ? 'action' : 'actions' }} syncing…</span>
        }
      </div>
    }
  `,
})
export class OfflineBannerComponent {
  protected readonly net = inject(ConnectivityService);
  protected readonly queue = inject(OfflineQueueService);
}
