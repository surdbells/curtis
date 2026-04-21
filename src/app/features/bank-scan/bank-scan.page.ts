import { Component, ChangeDetectionStrategy } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { OfflineBannerComponent } from '../../shared/components/offline-banner/offline-banner.component';

/**
 * Bank seals — Phase 1 placeholder.
 * TODO(phase-5): implement.
 */
@Component({
  selector: 'curtis-bank-scan',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonicModule, OfflineBannerComponent],
  template: `
    <ion-header translucent>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/dashboard" />
        </ion-buttons>
        <ion-title>Bank seals</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <curtis-offline-banner />
      <h2>Bank seals</h2>
      <p style="color: var(--ion-color-medium);">Download incoming seals for a bank and verify each via QR scan.</p>
      <ion-note>Phase 5</ion-note>
    </ion-content>
  `,
})
export class BankScanPage {}
