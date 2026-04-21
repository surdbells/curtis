import { Component, ChangeDetectionStrategy } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { OfflineBannerComponent } from '../../shared/components/offline-banner/offline-banner.component';

/**
 * Route map — Phase 1 placeholder.
 * TODO(phase-3): implement.
 */
@Component({
  selector: 'curtis-map',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonicModule, OfflineBannerComponent],
  template: `
    <ion-header translucent>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/dashboard" />
        </ion-buttons>
        <ion-title>Route map</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <curtis-offline-banner />
      <h2>Route map</h2>
      <p style="color: var(--ion-color-medium);">Leaflet + OpenStreetMap view of the assigned route with all stops pinned.</p>
      <ion-note>Phase 3</ion-note>
    </ion-content>
  `,
})
export class MapPage {}
