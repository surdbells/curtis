import { Component, ChangeDetectionStrategy } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { OfflineBannerComponent } from '../../shared/components/offline-banner/offline-banner.component';

/**
 * Incident report — Phase 1 placeholder.
 * TODO(phase-6): implement.
 */
@Component({
  selector: 'curtis-incident',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonicModule, OfflineBannerComponent],
  template: `
    <ion-header translucent>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/dashboard" />
        </ion-buttons>
        <ion-title>Incident report</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <curtis-offline-banner />
      <h2>Incident report</h2>
      <p style="color: var(--ion-color-medium);">Report an incident: type, note, optional photo, location stamp.</p>
      <ion-note>Phase 6</ion-note>
    </ion-content>
  `,
})
export class IncidentPage {}
