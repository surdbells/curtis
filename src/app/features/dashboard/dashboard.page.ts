import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AlertController, IonicModule } from '@ionic/angular';
import { SessionStore } from '../../core/stores/session.store';
import { DayStore } from '../../core/stores/day.store';
import { AuthService } from '../../core/services/auth.service';
import { OfflineBannerComponent } from '../../shared/components/offline-banner/offline-banner.component';

interface Tile {
  label: string;
  icon: string;
  route: string;
  phase: number;
}

/**
 * Dashboard — operational hub.
 *
 * Phase 1 ships the tile grid and session header. Phase 3 wires the
 * start/end-day actions, pulls route/truck data, and implements the
 * hardware-back lock.
 */
@Component({
  selector: 'curtis-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonicModule, RouterLink, OfflineBannerComponent],
  styles: [
    `
      .grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 0.75rem;
        padding: 0.75rem;
      }
      .tile {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        padding: 1.25rem 0.5rem;
        border-radius: 12px;
        background: var(--ion-color-light);
        text-align: center;
        color: var(--ion-color-dark);
        text-decoration: none;
        min-height: 110px;
      }
      .tile ion-icon {
        font-size: 2rem;
        color: var(--ion-color-primary);
      }
      .tile small {
        color: var(--ion-color-medium);
      }
      .day-banner {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        padding: 0.75rem 1rem;
        background: var(--ion-color-primary);
        color: var(--ion-color-primary-contrast);
      }
    `,
  ],
  template: `
    <ion-header translucent>
      <ion-toolbar>
        <ion-title>Dashboard</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="confirmLogout()">
            <ion-icon slot="icon-only" name="log-out-outline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <curtis-offline-banner />

      <div class="day-banner">
        <div>
          <strong>{{ day.dayActive() ? 'Day active' : 'Day not started' }}</strong>
          @if (session.user(); as u) {
            <div style="font-size: 0.8rem; opacity: 0.85;">{{ u.email }}</div>
          }
        </div>
        <ion-button
          [color]="day.dayActive() ? 'danger' : 'light'"
          size="small"
          disabled
        >
          {{ day.dayActive() ? 'End day' : 'Start day' }}
        </ion-button>
      </div>

      <div class="grid">
        @for (t of tiles; track t.route) {
          <a class="tile" [routerLink]="t.route">
            <ion-icon [name]="t.icon" />
            <div>{{ t.label }}</div>
            <small>Phase {{ t.phase }}</small>
          </a>
        }
      </div>
    </ion-content>
  `,
})
export class DashboardPage {
  protected readonly session = inject(SessionStore);
  protected readonly day = inject(DayStore);
  private readonly auth = inject(AuthService);
  private readonly alerts = inject(AlertController);
  private readonly router = inject(Router);

  protected readonly tiles: Tile[] = [
    { label: 'Route map', icon: 'map-outline', route: '/map', phase: 3 },
    { label: 'Today’s stops', icon: 'list-outline', route: '/daily', phase: 4 },
    { label: 'Delivery', icon: 'swap-horizontal-outline', route: '/delivery', phase: 4 },
    { label: 'Process', icon: 'cog-outline', route: '/process', phase: 4 },
    { label: 'Signature', icon: 'create-outline', route: '/signature', phase: 4 },
    { label: 'Route seals', icon: 'qr-code-outline', route: '/route-scan', phase: 5 },
    { label: 'Bank seals', icon: 'barcode-outline', route: '/bank-scan', phase: 5 },
    { label: 'Manual evacuation', icon: 'document-text-outline', route: '/manual-evacuation', phase: 5 },
    { label: 'Retail evacuation', icon: 'receipt-outline', route: '/retail-evacuation', phase: 5 },
    { label: 'Incident', icon: 'alert-circle-outline', route: '/incident', phase: 6 },
  ];

  /**
   * Confirm then log out. Blocks an accidental logout if the day is active
   * with a stronger warning — an active day means the agent is mid-route
   * and signing out would stop background tracking.
   */
  async confirmLogout(): Promise<void> {
    const active = this.day.dayActive();
    const alert = await this.alerts.create({
      header: active ? 'End session?' : 'Sign out?',
      message: active
        ? 'Your day is still active. Sign out will stop location tracking. End the day first if possible.'
        : 'You will need to sign in again to continue.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Sign out',
          role: 'destructive',
          handler: async () => {
            await this.auth.logout();
            await this.router.navigateByUrl('/login', { replaceUrl: true });
          },
        },
      ],
    });
    await alert.present();
  }
}
