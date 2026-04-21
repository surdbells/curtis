import { Component, ChangeDetectionStrategy } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { OfflineBannerComponent } from '../../shared/components/offline-banner/offline-banner.component';

/**
 * Retail evacuation — Phase 1 placeholder.
 * TODO(phase-5): implement.
 */
@Component({
  selector: 'curtis-retail-evacuation',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonicModule, OfflineBannerComponent],
  template: `
    <ion-header translucent>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/dashboard" />
        </ion-buttons>
        <ion-title>Retail evacuation</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <curtis-offline-banner />
      <h2>Retail evacuation</h2>
      <p style="color: var(--ion-color-medium);">Capture a photo of the evacuation receipt and submit with branch details.</p>
      <ion-note>Phase 5</ion-note>
    </ion-content>
  `,
})
export class RetailEvacuationPage {}
