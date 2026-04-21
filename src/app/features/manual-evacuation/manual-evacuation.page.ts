import { Component, ChangeDetectionStrategy } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { OfflineBannerComponent } from '../../shared/components/offline-banner/offline-banner.component';

/**
 * Manual evacuation — Phase 1 placeholder.
 * TODO(phase-5): implement.
 */
@Component({
  selector: 'curtis-manual-evacuation',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonicModule, OfflineBannerComponent],
  template: `
    <ion-header translucent>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/dashboard" />
        </ion-buttons>
        <ion-title>Manual evacuation</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <curtis-offline-banner />
      <h2>Manual evacuation</h2>
      <p style="color: var(--ion-color-medium);">Submit a manual evacuation record when the automated flow can’t be used.</p>
      <ion-note>Phase 5</ion-note>
    </ion-content>
  `,
})
export class ManualEvacuationPage {}
