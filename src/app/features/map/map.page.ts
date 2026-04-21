import {
  Component,
  ChangeDetectionStrategy,
  AfterViewInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  inject,
} from '@angular/core';
import { IonicModule } from '@ionic/angular';
import * as L from 'leaflet';

import { RouteStore } from '../../core/stores/route.store';
import { ConfigService } from '../../core/services/config.service';
import type { RouteStop } from '../../core/models';
import { OfflineBannerComponent } from '../../shared/components/offline-banner/offline-banner.component';

/**
 * Route map — Phase 3.
 *
 * Renders the active route on Leaflet + OSM:
 *   - Polyline connecting stops in order
 *   - Numbered markers for each stop
 *   - Auto-fit bounds to the whole route
 *
 * No live device location in Phase 3 — that arrives in Phase 6 with the
 * background-geolocation watcher.
 *
 * Handles the case where RouteStore is empty (no route loaded) by showing
 * a centered empty state instead of a broken map.
 */
@Component({
  selector: 'curtis-map',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonicModule, OfflineBannerComponent],
  styles: [
    `
      :host {
        display: block;
      }
      .map {
        width: 100%;
        height: calc(100vh - 120px);
        background: #e8eef2;
      }
      .empty {
        padding: 2rem 1rem;
        text-align: center;
        color: var(--ion-color-medium);
      }
      :global(.curtis-stop-marker) {
        background: var(--ion-color-primary);
        color: var(--ion-color-primary-contrast);
        border: 2px solid #fff;
        border-radius: 50%;
        width: 26px !important;
        height: 26px !important;
        line-height: 22px;
        text-align: center;
        font-weight: 700;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
      }
    `,
  ],
  template: `
    <ion-header translucent>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/dashboard" />
        </ion-buttons>
        <ion-title>Route map</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content [fullscreen]="true">
      <curtis-offline-banner />
      @if (!hasStops()) {
        <div class="empty">
          <ion-icon name="map-outline" style="font-size: 3rem;" />
          <p>No route loaded. Return to the dashboard and refresh.</p>
        </div>
      } @else {
        <div #mapEl class="map"></div>
      }
    </ion-content>
  `,
})
export class MapPage implements AfterViewInit, OnDestroy {
  @ViewChild('mapEl') mapEl?: ElementRef<HTMLDivElement>;

  private readonly routeStore = inject(RouteStore);
  private readonly config = inject(ConfigService);

  private map?: L.Map;

  hasStops(): boolean {
    return this.routeStore.stops().some((s) => this.isGeoStop(s));
  }

  ngAfterViewInit(): void {
    // Defer slightly so the host DOM has dimensions.
    setTimeout(() => this.initMap(), 50);
  }

  ngOnDestroy(): void {
    this.map?.remove();
    this.map = undefined;
  }

  private initMap(): void {
    if (!this.mapEl || !this.hasStops()) return;

    this.map = L.map(this.mapEl.nativeElement, {
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer(this.config.mapTileUrl, {
      maxZoom: 19,
      attribution: this.config.mapAttribution,
    }).addTo(this.map);

    const stops = this.routeStore.stops().filter((s) => this.isGeoStop(s));
    const latLngs = stops.map((s) => [s.latitude!, s.longitude!] as [number, number]);

    stops.forEach((stop, i) => {
      const icon = L.divIcon({
        className: 'curtis-stop-marker',
        html: String(i + 1),
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });
      const marker = L.marker([stop.latitude!, stop.longitude!], { icon }).addTo(this.map!);
      const label = this.stopLabel(stop, i + 1);
      marker.bindPopup(label);
    });

    if (latLngs.length >= 2) {
      L.polyline(latLngs, {
        color: getComputedStyle(document.documentElement).getPropertyValue('--ion-color-primary').trim() || '#0A4F2A',
        weight: 4,
        opacity: 0.85,
      }).addTo(this.map);
    }

    if (latLngs.length === 1) {
      this.map.setView(latLngs[0], 14);
    } else {
      this.map.fitBounds(L.latLngBounds(latLngs), { padding: [32, 32] });
    }
  }

  /** A stop is geo-placeable only if it has numeric latitude and longitude. */
  private isGeoStop(s: RouteStop): s is RouteStop & { latitude: number; longitude: number } {
    return typeof s.latitude === 'number' && typeof s.longitude === 'number';
  }

  private stopLabel(stop: RouteStop, n: number): string {
    const name = stop.branchName ?? stop.address ?? stop.id;
    return `<strong>Stop ${n}</strong><br/>${this.escapeHtml(String(name))}`;
  }

  private escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
