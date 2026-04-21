import { Component, ChangeDetectionStrategy } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { OfflineBannerComponent } from '../../shared/components/offline-banner/offline-banner.component';

/**
 * Today’s stops — Phase 1 placeholder.
 * TODO(phase-4): implement.
 */
@Component({
  selector: 'curtis-daily',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonicModule, OfflineBannerComponent],
  template: `
    <ion-header translucent>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/dashboard" />
        </ion-buttons>
        <ion-title>Today’s stops</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <curtis-offline-banner />
      <h2>Today’s stops</h2>
      <p style="color: var(--ion-color-medium);">Ordered list of stops for the active route; tap a stop to begin delivery.</p>
      <ion-note>Phase 4</ion-note>
    </ion-content>
  `,
})
export class DailyPage {}
