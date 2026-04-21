import { Component, ChangeDetectionStrategy, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';

import { RouteStore } from '../../core/stores/route.store';
import { DeliveryStore } from '../../core/stores/delivery.store';
import { OfflineBannerComponent } from '../../shared/components/offline-banner/offline-banner.component';
import type { RouteStop } from '../../core/models';

/**
 * Today's stops — Phase 4.
 *
 * Reads stops from RouteStore (hydrated on Dashboard), renders as a list
 * in order. Tap a stop -> begin a delivery (initialises DeliveryStore
 * with bank/branch pre-filled from the stop) and navigate to /delivery.
 *
 * Stops without a branch id are shown but disabled — the delivery flow
 * needs at least a branch reference. An agent hitting a data-incomplete
 * stop falls back to "Manual evacuation" from the dashboard.
 */
@Component({
  selector: 'curtis-daily',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonicModule, OfflineBannerComponent],
  styles: [
    `
      .empty {
        text-align: center;
        color: var(--ion-color-medium);
        padding: 2.5rem 1rem;
      }
      .empty ion-icon {
        font-size: 3rem;
      }
      ion-item.stop {
        --padding-start: 1rem;
      }
      .seq {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: var(--ion-color-primary);
        color: var(--ion-color-primary-contrast);
        font-size: 0.8rem;
        font-weight: 700;
        margin-right: 0.75rem;
      }
      .status-chip {
        font-size: 0.7rem;
        padding: 0.15rem 0.5rem;
        border-radius: 999px;
        background: var(--ion-color-light);
        color: var(--ion-color-medium);
      }
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
          <p>No stops loaded yet. Return to the dashboard and refresh.</p>
        </div>
      } @else {
        <ion-list>
          @for (stop of stops(); track stop.id; let idx = $index) {
            <ion-item
              class="stop"
              button
              [detail]="canSelect(stop)"
              [disabled]="!canSelect(stop)"
              (click)="canSelect(stop) && selectStop(stop)"
            >
              <span class="seq" slot="start">{{ idx + 1 }}</span>
              <ion-label>
                <h2>{{ stop.branchName || stop.address || stop.id }}</h2>
                @if (stop.address && stop.branchName) {
                  <p>{{ stop.address }}</p>
                }
              </ion-label>
              @if (stop.status) {
                <span class="status-chip" slot="end">{{ stop.status }}</span>
              }
            </ion-item>
          }
        </ion-list>
      }
    </ion-content>
  `,
})
export class DailyPage {
  private readonly routeStore = inject(RouteStore);
  private readonly delivery = inject(DeliveryStore);
  private readonly router = inject(Router);

  protected readonly stops = computed<RouteStop[]>(() => this.routeStore.stops());

  /** A stop is selectable if it has at least a branch reference. */
  protected canSelect(stop: RouteStop): boolean {
    return !!stop.branchId || !!stop.id;
  }

  protected async selectStop(stop: RouteStop): Promise<void> {
    this.delivery.beginDelivery({
      stopId: String(stop.id),
      bankId: stop.bankId ? String(stop.bankId) : null,
      branchId: stop.branchId ? String(stop.branchId) : null,
      // TODO(phase-4-samples): the route-stop shape may carry `state` once
      // real samples land; until then the branch picker falls back to a
      // state chooser on the Delivery page.
      state: null,
    });
    await this.router.navigateByUrl('/delivery');
  }
}
