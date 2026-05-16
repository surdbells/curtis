import { Component, ChangeDetectionStrategy, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

import { RouteStore } from '../../core/stores/route.store';
import { DeliveryStore } from '../../core/stores/delivery.store';
import { OfflineBannerComponent } from '../../shared/components/offline-banner/offline-banner.component';
import type { RouteStop } from '../../core/models';

@Component({
  selector: 'curtis-daily',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonicModule, OfflineBannerComponent],
  styles: [
    `
      :host { display: block; }
      ion-content { --background: var(--curtis-bg); }

      .empty {
        text-align: center; padding: 3rem 1rem; color: var(--curtis-text-subtle);
      }
      .empty ion-icon { font-size: 3rem; opacity: 0.5; }

      .list {
        padding: 0.75rem;
        display: grid; gap: 0.6rem;
      }
      .stop {
        display: flex; align-items: center; gap: 0.85rem;
        padding: 0.85rem 1rem;
        background: var(--curtis-surface-1);
        border: 1px solid var(--curtis-border);
        border-radius: var(--curtis-radius-md);
        box-shadow: var(--curtis-shadow-sm);
        text-decoration: none; color: var(--curtis-text);
        transition: transform 120ms ease-out;
      }
      .stop:active { transform: scale(0.99); }
      .stop.disabled { opacity: 0.55; pointer-events: none; }

      .seq {
        flex-shrink: 0;
        width: 36px; height: 36px;
        border-radius: 50%;
        display: grid; place-items: center;
        background: var(--curtis-gradient-primary);
        color: var(--curtis-text-inverse);
        font-weight: 700; font-size: 0.85rem;
        box-shadow: var(--curtis-shadow-sm);
      }
      .body { flex: 1; min-width: 0; }
      .title {
        font-weight: 600; line-height: 1.2;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .sub {
        font-size: 0.78rem; color: var(--curtis-text-subtle);
        margin-top: 0.15rem;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .pill {
        flex-shrink: 0;
        padding: 0.2rem 0.55rem;
        border-radius: 999px;
        font-size: 0.68rem; font-weight: 600; letter-spacing: 0.04em;
        text-transform: uppercase;
        background: var(--curtis-surface-2);
        color: var(--curtis-text-muted);
        border: 1px solid var(--curtis-border);
      }
      .chevron { color: var(--curtis-text-subtle); }
    `,
  ],
  template: `
    <ion-header translucent>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/dashboard" />
        </ion-buttons>
        <ion-title>Today’s stops</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <curtis-offline-banner />

      @if (stops().length === 0) {
        <div class="empty">
          <ion-icon name="list-outline" />
          <h3 style="margin-top: 0.75rem;">No stops yet</h3>
          <p>Return to the dashboard and pull to refresh.</p>
        </div>
      } @else {
        <div class="list">
          @for (stop of stops(); track stop.id; let idx = $index) {
            <a
              class="stop"
              [class.disabled]="!canSelect(stop)"
              (click)="canSelect(stop) && selectStop(stop)"
            >
              <span class="seq">{{ idx + 1 }}</span>
              <div class="body">
                <div class="title">{{ stop.branchName || stop.address || stop.id }}</div>
                @if (stop.address && stop.branchName) {
                  <div class="sub">{{ stop.address }}</div>
                }
              </div>
              @if (stop.status) {
                <span class="pill">{{ stop.status }}</span>
              }
              <ion-icon class="chevron" name="chevron-forward-outline" />
            </a>
          }
        </div>
      }
    </ion-content>
  `,
})
export class DailyPage {
  private readonly routeStore = inject(RouteStore);
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
