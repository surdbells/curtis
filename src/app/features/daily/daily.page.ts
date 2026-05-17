import { Component, ChangeDetectionStrategy, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

import { RouteStore } from '../../core/stores/route.store';
import { DeliveryStore } from '../../core/stores/delivery.store';
import { OfflineBannerComponent } from '../../shared/components/offline-banner/offline-banner.component';
import { CurtisIconComponent } from '../../shared/components/icon';
import { CurtisHeaderComponent } from '../../shared/components/header';
import type { RouteStop } from '../../core/models';

/**
 * Today's stops — Phase 9 redesign.
 *
 * Compact stop list with:
 *   - Header strip showing route name + total stops
 *   - Sequence-numbered marker per stop
 *   - Stop name + address with single-line ellipsis
 *   - Status pill on the right
 *   - Chevron indicator
 *
 * Empty state preserves the same UX (return to dashboard + refresh).
 */
@Component({
  selector: 'curtis-daily',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonicModule, OfflineBannerComponent, CurtisIconComponent, CurtisHeaderComponent],
  styles: [
    `
      :host { display: block; }
      ion-content { --background: var(--curtis-bg); }

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
        width: 40px;
        height: 40px;
        border-radius: var(--curtis-radius-md);
        background: var(--curtis-gradient-primary);
        color: var(--ion-color-tertiary);
        display: grid;
        place-items: center;
        flex-shrink: 0;
      }
      .route-strip__text { flex: 1; min-width: 0; }
      .route-strip__title {
        font-size: var(--curtis-text-md);
        font-weight: var(--curtis-weight-bold);
        color: var(--curtis-text);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .route-strip__meta {
        font-size: var(--curtis-text-xs);
        color: var(--curtis-text-muted);
        font-variant-numeric: tabular-nums;
      }

      .list {
        padding: var(--curtis-space-2) var(--curtis-space-4) var(--curtis-space-8);
        display: flex;
        flex-direction: column;
        gap: var(--curtis-space-2);
      }

      .stop {
        display: flex;
        align-items: center;
        gap: var(--curtis-space-3);
        padding: var(--curtis-space-3) var(--curtis-space-4);
        background: var(--curtis-surface-1);
        border: 1px solid var(--curtis-border);
        border-radius: var(--curtis-radius-md);
        box-shadow: var(--curtis-shadow-xs);
        text-decoration: none;
        color: var(--curtis-text);
        cursor: pointer;
        transition: transform var(--curtis-duration-fast) var(--curtis-ease-out),
                    box-shadow var(--curtis-duration-fast) var(--curtis-ease-out),
                    border-color var(--curtis-duration-fast) var(--curtis-ease-out);
        animation: rise var(--curtis-duration-slow) var(--curtis-ease-out) both;
      }
      .stop:hover:not(.disabled) {
        border-color: var(--curtis-border-strong);
        box-shadow: var(--curtis-shadow-sm);
        transform: translateY(-1px);
      }
      .stop:active:not(.disabled) {
        transform: translateY(0);
      }
      .stop.disabled { opacity: 0.55; cursor: not-allowed; }

      .stop__seq {
        flex-shrink: 0;
        width: 36px;
        height: 36px;
        border-radius: var(--curtis-radius-md);
        background: color-mix(in srgb, var(--ion-color-primary) 12%, transparent);
        color: var(--ion-color-primary);
        display: grid;
        place-items: center;
        font-weight: var(--curtis-weight-bold);
        font-size: var(--curtis-text-sm);
        font-variant-numeric: tabular-nums;
      }
      .stop__body { flex: 1; min-width: 0; }
      .stop__title {
        font-weight: var(--curtis-weight-semibold);
        font-size: var(--curtis-text-base);
        line-height: var(--curtis-leading-tight);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .stop__sub {
        font-size: var(--curtis-text-xs);
        color: var(--curtis-text-subtle);
        margin-top: 2px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .pill {
        flex-shrink: 0;
        padding: 4px var(--curtis-space-2);
        border-radius: var(--curtis-radius-pill);
        font-size: 10px;
        font-weight: var(--curtis-weight-bold);
        letter-spacing: var(--curtis-tracking-wide);
        text-transform: uppercase;
        background: var(--curtis-surface-2);
        color: var(--curtis-text-muted);
        border: 1px solid var(--curtis-border);
      }

      .chevron { color: var(--curtis-text-faint); flex-shrink: 0; }

      /* Empty state */
      .empty {
        height: 60vh;
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
        background: var(--curtis-surface-2);
        color: var(--curtis-text-muted);
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

      .stop:nth-child(1) { animation-delay: 40ms; }
      .stop:nth-child(2) { animation-delay: 80ms; }
      .stop:nth-child(3) { animation-delay: 120ms; }
      .stop:nth-child(4) { animation-delay: 160ms; }
      .stop:nth-child(5) { animation-delay: 200ms; }
      .stop:nth-child(6) { animation-delay: 240ms; }

      @keyframes rise {
        from { opacity: 0; transform: translateY(6px); }
        to   { opacity: 1; transform: translateY(0); }
      }
    `,
  ],
  template: `
    <curtis-header title="Today's stops" backHref="/dashboard" />

    <ion-content [fullscreen]="true">
      <curtis-offline-banner />

      @if (stops().length === 0) {
        <div class="empty">
          <div class="empty__well">
            <curtis-icon name="list-outline" size="xl" [strokeWidth]="1.5" />
          </div>
          <div class="empty__title">No stops yet</div>
          <div class="empty__body">
            Return to the dashboard and pull to refresh. Your route stops will appear here once assigned.
          </div>
        </div>
      } @else {
        @if (routeStore.route(); as r) {
          <div class="route-strip">
            <div class="route-strip__icon">
              <curtis-icon name="navigate-circle-outline" size="md" />
            </div>
            <div class="route-strip__text">
              <div class="route-strip__title">{{ r.name || 'Active route' }}</div>
              <div class="route-strip__meta">{{ stops().length }} stops scheduled</div>
            </div>
          </div>
        }

        <div class="list">
          @for (stop of stops(); track stop.id; let idx = $index) {
            <a
              class="stop"
              [class.disabled]="!canSelect(stop)"
              (click)="canSelect(stop) && selectStop(stop)"
            >
              <div class="stop__seq">{{ idx + 1 }}</div>
              <div class="stop__body">
                <div class="stop__title">{{ stop.branchName || stop.address || stop.id }}</div>
                @if (stop.address && stop.branchName) {
                  <div class="stop__sub">{{ stop.address }}</div>
                }
              </div>
              @if (stop.status) {
                <span class="pill">{{ stop.status }}</span>
              }
              <curtis-icon class="chevron" name="chevron-forward-outline" size="sm" />
            </a>
          }
        </div>
      }
    </ion-content>
  `,
})
export class DailyPage {
  protected readonly routeStore = inject(RouteStore);
  private readonly delivery = inject(DeliveryStore);
  private readonly router = inject(Router);

  protected readonly stops = computed<RouteStop[]>(() => this.routeStore.stops());

  protected canSelect(stop: RouteStop): boolean {
    return !!stop.branchId || !!stop.id;
  }

  protected async selectStop(stop: RouteStop): Promise<void> {
    await this.haptic();
    this.delivery.beginDelivery({
      stopId: String(stop.id),
      bankId: stop.bankId ? String(stop.bankId) : null,
      branchId: stop.branchId ? String(stop.branchId) : null,
      state: null,
    });
    await this.router.navigateByUrl('/delivery');
  }

  private async haptic(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try { await Haptics.impact({ style: ImpactStyle.Light }); } catch { /* ignore */ }
  }
}
