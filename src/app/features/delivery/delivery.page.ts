import { Component, ChangeDetectionStrategy, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

import { RouteStore } from '../../core/stores/route.store';
import { DeliveryStore } from '../../core/stores/delivery.store';
import { DayStore } from '../../core/stores/day.store';
import { OfflineBannerComponent } from '../../shared/components/offline-banner/offline-banner.component';
import { CurtisIconComponent } from '../../shared/components/icon';
import { CurtisHeaderComponent } from '../../shared/components/header';
import type { RouteStop } from '../../core/models';

/**
 * Delivery — stop selection list (post-E5).
 *
 * Mirrors legacy CurtisTracker DeliveryActivity (a ListActivity). The
 * agent picks a stop from their assigned route; the selection writes
 * into DeliveryStore.stopId via beginDelivery() and the router opens
 * /process which becomes the unified stop hub for that job.
 *
 * What this page does NOT do anymore (intentionally — moved to /process
 * in sub-phase E3 as part of the stop-hub rework):
 *   - bank/branch picking
 *   - Check-In submission
 *
 * Empty / loading states:
 *   - Route is loading              -> spinner card
 *   - Route loaded but no stops     -> empty-state with refresh hint
 *   - Day not started               -> soft warning (per Q6) — taps still
 *                                       proceed to /process; warning is
 *                                       informational only
 */
@Component({
  selector: 'curtis-delivery',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    IonicModule,
    OfflineBannerComponent,
    CurtisIconComponent,
    CurtisHeaderComponent,
  ],
  styles: [
    `
      :host { display: block; }
      ion-content {
        --background: var(--curtis-bg);
        --padding-bottom: calc(var(--curtis-space-20) + env(safe-area-inset-bottom, 0));
      }

      .route-strip {
        margin: var(--curtis-space-3) var(--curtis-space-4);
        padding: var(--curtis-space-3) var(--curtis-space-4);
        background: var(--curtis-surface-1);
        border: 1px solid var(--curtis-border);
        border-radius: var(--curtis-radius-lg);
        box-shadow: var(--curtis-shadow-xs);
        display: flex;
        align-items: center;
        gap: var(--curtis-space-3);
      }
      .route-strip__icon {
        width: 40px; height: 40px;
        border-radius: var(--curtis-radius-md);
        background: color-mix(in srgb, var(--ion-color-primary) 12%, transparent);
        color: var(--ion-color-primary);
        display: grid; place-items: center;
      }
      .route-strip__text { flex: 1; min-width: 0; }
      .route-strip__title {
        font-size: var(--curtis-text-base);
        font-weight: var(--curtis-weight-semibold);
        color: var(--curtis-text);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .route-strip__sub {
        font-size: var(--curtis-text-xs);
        color: var(--curtis-text-subtle);
        margin-top: 2px;
      }

      .day-warning {
        margin: var(--curtis-space-3) var(--curtis-space-4) 0;
        padding: 10px var(--curtis-space-3);
        background: color-mix(in srgb, var(--amber-500) 12%, transparent);
        border: 1px solid color-mix(in srgb, var(--amber-500) 36%, transparent);
        border-radius: var(--curtis-radius-md);
        font-size: var(--curtis-text-sm);
        color: var(--curtis-text);
        display: flex;
        gap: var(--curtis-space-2);
        align-items: center;
      }
      .day-warning curtis-icon { color: var(--amber-500); }

      .section-label {
        margin: var(--curtis-space-3) var(--curtis-space-4) var(--curtis-space-1);
        font-size: var(--curtis-text-xs);
        font-weight: var(--curtis-weight-bold);
        letter-spacing: var(--curtis-tracking-wider);
        text-transform: uppercase;
        color: var(--curtis-text-subtle);
      }

      .stop-list {
        margin: 0 var(--curtis-space-4);
        display: flex;
        flex-direction: column;
        gap: var(--curtis-space-2);
      }
      .stop-row {
        display: flex;
        align-items: center;
        gap: var(--curtis-space-3);
        padding: var(--curtis-space-3) var(--curtis-space-4);
        background: var(--curtis-surface-1);
        border: 1px solid var(--curtis-border);
        border-radius: var(--curtis-radius-lg);
        box-shadow: var(--curtis-shadow-xs);
        cursor: pointer;
        text-align: left;
        transition: transform var(--curtis-duration-fast) var(--curtis-ease-out),
                    box-shadow var(--curtis-duration-fast) var(--curtis-ease-out),
                    border-color var(--curtis-duration-fast) var(--curtis-ease-out);
      }
      .stop-row:hover {
        border-color: var(--curtis-border-strong);
        box-shadow: var(--curtis-shadow-md);
      }
      .stop-row:active { transform: translateY(1px); }
      .stop-row__seq {
        width: 36px; height: 36px;
        border-radius: var(--curtis-radius-pill);
        background: color-mix(in srgb, var(--ion-color-primary) 14%, transparent);
        color: var(--ion-color-primary);
        display: grid; place-items: center;
        font-weight: var(--curtis-weight-bold);
        font-size: var(--curtis-text-sm);
        flex-shrink: 0;
      }
      .stop-row__body { flex: 1; min-width: 0; }
      .stop-row__title {
        font-size: var(--curtis-text-sm);
        font-weight: var(--curtis-weight-semibold);
        color: var(--curtis-text);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .stop-row__sub {
        font-size: var(--curtis-text-xs);
        color: var(--curtis-text-subtle);
        margin-top: 2px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .stop-row__meta {
        display: flex;
        gap: var(--curtis-space-2);
        align-items: center;
        margin-top: 4px;
      }
      .stop-pill {
        font-size: 11px;
        font-weight: var(--curtis-weight-semibold);
        letter-spacing: var(--curtis-tracking-wide);
        text-transform: uppercase;
        padding: 2px 8px;
        border-radius: var(--curtis-radius-pill);
        background: var(--curtis-surface-2);
        color: var(--curtis-text-subtle);
      }
      .stop-pill.is-active {
        background: color-mix(in srgb, var(--ion-color-primary) 14%, transparent);
        color: var(--ion-color-primary);
      }
      .stop-row__chev {
        color: var(--curtis-text-faint);
        flex-shrink: 0;
      }

      .empty {
        margin: var(--curtis-space-6) var(--curtis-space-4);
        padding: var(--curtis-space-6) var(--curtis-space-4);
        background: var(--curtis-surface-1);
        border: 1px dashed var(--curtis-border-strong);
        border-radius: var(--curtis-radius-lg);
        text-align: center;
        color: var(--curtis-text-subtle);
        display: flex;
        flex-direction: column;
        gap: var(--curtis-space-2);
        align-items: center;
      }
      .empty__icon {
        width: 56px; height: 56px;
        border-radius: var(--curtis-radius-pill);
        background: var(--curtis-surface-2);
        color: var(--curtis-text-subtle);
        display: grid; place-items: center;
      }
      .empty__title {
        font-size: var(--curtis-text-base);
        font-weight: var(--curtis-weight-semibold);
        color: var(--curtis-text);
      }
    `,
  ],
  template: `
    <curtis-header title="Delivery stops" backHref="/dashboard" />

    <ion-content [fullscreen]="true">
      <curtis-offline-banner />

      <!-- Route summary strip -->
      @if (routeStore.route(); as route) {
        <div class="route-strip">
          <span class="route-strip__icon">
            <curtis-icon name="navigate-outline" size="md" />
          </span>
          <div class="route-strip__text">
            <div class="route-strip__title">{{ route.clientName || 'Route ' + route.routeId }}</div>
            <div class="route-strip__sub">
              {{ stops().length }} {{ stops().length === 1 ? 'stop' : 'stops' }}
              · Route {{ route.routeId }}
            </div>
          </div>
        </div>
      }

      <!-- Soft warning if day not started (per Q6) -->
      @if (!day.dayActive()) {
        <div class="day-warning">
          <curtis-icon name="alert-circle-outline" size="sm" />
          You haven't started your day. Return to Dashboard and tap Start day.
        </div>
      }

      @if (stops().length === 0) {
        <div class="empty">
          <span class="empty__icon">
            <curtis-icon name="list-outline" size="md" />
          </span>
          <div class="empty__title">No stops on your route yet</div>
          <div>Pull to refresh once your route has been assigned.</div>
        </div>
      } @else {
        <div class="section-label">Tap a stop to open it</div>
        <div class="stop-list">
          @for (s of stops(); track s.referenceNumber) {
            <button class="stop-row" type="button" (click)="onStopTap(s)">
              <span class="stop-row__seq">{{ s.stopNumber }}</span>
              <div class="stop-row__body">
                <div class="stop-row__title">{{ s.destination || s.refNo }}</div>
                @if (s.clientName) {
                  <div class="stop-row__sub">{{ s.clientName }}</div>
                }
                <div class="stop-row__meta">
                  @if (s.refNo) {
                    <span class="stop-pill">{{ s.refNo }}</span>
                  }
                  @if (s.status) {
                    <span
                      class="stop-pill"
                      [class.is-active]="deliveryStore.stopId() === s.referenceNumber"
                    >
                      {{ s.status }}
                    </span>
                  }
                </div>
              </div>
              <curtis-icon class="stop-row__chev" name="chevron-forward-outline" size="sm" />
            </button>
          }
        </div>
      }
    </ion-content>
  `,
})
export class DeliveryPage {
  protected readonly routeStore = inject(RouteStore);
  protected readonly deliveryStore = inject(DeliveryStore);
  protected readonly day = inject(DayStore);
  private readonly router = inject(Router);

  /** Convenience signal — sorted by stopNumber ascending. */
  protected readonly stops = computed<RouteStop[]>(() => {
    const list = this.routeStore.stops();
    return [...list].sort((a, b) => (a.stopNumber || 0) - (b.stopNumber || 0));
  });

  /**
   * Open a stop. Mirrors legacy DeliveryActivity row tap: write the stop
   * into DeliveryStore and start the stop hub (/process).
   */
  protected async onStopTap(stop: RouteStop): Promise<void> {
    this.deliveryStore.beginDelivery({
      stopId: stop.referenceNumber,
      branchId: stop.branchId || null,
    });
    await this.haptic();
    await this.router.navigateByUrl('/process');
  }

  private async haptic(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {
      // no-op
    }
  }
}
