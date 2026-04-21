import { Component, ChangeDetectionStrategy } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { OfflineBannerComponent } from '../../shared/components/offline-banner/offline-banner.component';

/**
 * Route seals — Phase 1 placeholder.
 * TODO(phase-5): implement.
 */
@Component({
  selector: 'curtis-route-scan',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonicModule, OfflineBannerComponent],
  template: `
    <ion-header translucent>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/dashboard" />
        </ion-buttons>
        <ion-title>Route seals</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <curtis-offline-banner />
      <h2>Route seals</h2>
      <p style="color: var(--ion-color-medium);">Download incoming seals for the active route and tick them off via QR scan.</p>
      <ion-note>Phase 5</ion-note>
    </ion-content>
  `,
})
export class RouteScanPage {}
