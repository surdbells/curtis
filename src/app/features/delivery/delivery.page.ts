import { Component, ChangeDetectionStrategy } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { OfflineBannerComponent } from '../../shared/components/offline-banner/offline-banner.component';

/**
 * Delivery — Phase 1 placeholder.
 * TODO(phase-4): implement.
 */
@Component({
  selector: 'curtis-delivery',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonicModule, OfflineBannerComponent],
  template: `
    <ion-header translucent>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/dashboard" />
        </ion-buttons>
        <ion-title>Delivery</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <curtis-offline-banner />
      <h2>Delivery</h2>
      <p style="color: var(--ion-color-medium);">Select bank and branch; check in and out with geolocation and timestamp.</p>
      <ion-note>Phase 4</ion-note>
    </ion-content>
  `,
})
export class DeliveryPage {}
