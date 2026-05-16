import {
  Component,
  ChangeDetectionStrategy,
  AfterViewInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import * as L from 'leaflet';

import { RouteStore } from '../../core/stores/route.store';
import { ConfigService } from '../../core/services/config.service';
import type { RouteStop } from '../../core/models';
import { OfflineBannerComponent } from '../../shared/components/offline-banner/offline-banner.component';
import { CurtisIconComponent } from '../../shared/components/icon';

/**
 * Route map — Phase 9 redesign.
 *
 * Full-bleed Leaflet map with a floating route info panel docked at the
 * bottom. Numbered stop markers in navy with white ring, polyline in
 * primary navy.
 *
 * Empty state: large icon-well + descriptive message + CTA.
 */
@Component({
  selector: 'curtis-map',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonicModule, OfflineBannerComponent, CurtisIconComponent],
  styles: [
    `
      :host { display: block; }
      ion-content { --background: var(--curtis-bg); }

      .map {
        width: 100%;
        height: calc(100vh - 56px);
        background: var(--curtis-surface-2);
      }

      .empty {
        height: calc(100vh - 120px);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: var(--curtis-space-6);
        text-align: center;
        gap: var(--curtis-space-3);
      }
      .empty__well {
        width: 88px;
        height: 88px;
        border-radius: var(--curtis-radius-xl);
        background: var(--curtis-surface-2);
        color: var(--curtis-text-muted);
        display: grid;
        place-items: center;
        box-shadow: var(--curtis-shadow-xs);
      }
      .empty__title {
        font-size: var(--curtis-text-lg);
        font-weight: var(--curtis-weight-bold);
        color: var(--curtis-text);
      }
      .empty__body {
        font-size: var(--curtis-text-sm);
        color: var(--curtis-text-muted);
        max-width: 22rem;
      }

      /* Floating info panel */
      .info-panel {
        position: fixed;
        left: var(--curtis-space-4);
        right: var(--curtis-space-4);
        bottom: calc(var(--curtis-space-5) + env(safe-area-inset-bottom, 0));
        z-index: 500;
        background: var(--curtis-surface-1);
        border: 1px solid var(--curtis-border);
        border-radius: var(--curtis-radius-lg);
        box-shadow: var(--curtis-shadow-lg);
        padding: var(--curtis-space-3) var(--curtis-space-4);
        display: flex;
        align-items: center;
        gap: var(--curtis-space-3);
        animation: rise var(--curtis-duration-slow) var(--curtis-ease-out) 200ms both;
      }
      .info-panel__icon {
        width: 36px;
        height: 36px;
        border-radius: var(--curtis-radius-md);
        background: color-mix(in srgb, var(--ion-color-primary) 12%, transparent);
        color: var(--ion-color-primary);
        display: grid;
        place-items: center;
        flex-shrink: 0;
      }
      .info-panel__text {
        flex: 1;
        min-width: 0;
      }
      .info-panel__title {
        font-size: var(--curtis-text-sm);
        font-weight: var(--curtis-weight-bold);
        color: var(--curtis-text);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .info-panel__meta {
        font-size: var(--curtis-text-xs);
        color: var(--curtis-text-muted);
        font-variant-numeric: tabular-nums;
      }

      /* Leaflet popups should use Inter */
      :global(.leaflet-popup-content) {
        font-family: var(--curtis-font-sans);
        font-size: var(--curtis-text-sm);
        color: var(--curtis-text);
      }
      :global(.curtis-stop-marker) {
        background: var(--navy-900);
        color: #fff;
        border: 2px solid #fff;
        border-radius: 50%;
        width: 28px !important;
        height: 28px !important;
        line-height: 24px;
        text-align: center;
        font-family: var(--curtis-font-sans);
        font-weight: var(--curtis-weight-bold);
        font-size: var(--curtis-text-xs);
        font-variant-numeric: tabular-nums;
        box-shadow: 0 4px 12px rgba(2, 29, 106, 0.35);
      }

      @keyframes rise {
        from { opacity: 0; transform: translateY(12px); }
        to   { opacity: 1; transform: translateY(0); }
      }
    `,
  ],
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/dashboard"></ion-back-button>
        </ion-buttons>
        <ion-title>Route map</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content [fullscreen]="true">
      <curtis-offline-banner />
      @if (!hasStops()) {
        <div class="empty">
          <div class="empty__well">
            <curtis-icon name="map-outline" size="xl" [strokeWidth]="1.5" />
          </div>
          <div class="empty__title">No route loaded</div>
          <div class="empty__body">
            Return to the dashboard and pull to refresh. Your route will appear here once it's assigned.
          </div>
        </div>
      } @else {
        <div #mapEl class="map"></div>
        @if (routeStore.route(); as r) {
          <div class="info-panel">
            <div class="info-panel__icon">
              <curtis-icon name="navigate-circle-outline" size="sm" />
            </div>
            <div class="info-panel__text">
              <div class="info-panel__title">{{ r.name || 'Active route' }}</div>
              <div class="info-panel__meta">{{ routeStore.stops().length }} stops</div>
            </div>
          </div>
        }
      }
    </ion-content>
  `,
})
export class MapPage implements AfterViewInit, OnDestroy {
  @ViewChild('mapEl') mapEl?: ElementRef<HTMLDivElement>;

  protected readonly routeStore = inject(RouteStore);
  private readonly config = inject(ConfigService);

  private map?: L.Map;

  hasStops(): boolean {
    return this.routeStore.stops().some((s) => this.isGeoStop(s));
  }

  ngAfterViewInit(): void {
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
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      const marker = L.marker([stop.latitude!, stop.longitude!], { icon }).addTo(this.map!);
      marker.bindPopup(this.stopLabel(stop, i + 1));
    });

    if (latLngs.length >= 2) {
      L.polyline(latLngs, {
        color: getComputedStyle(document.documentElement).getPropertyValue('--ion-color-primary').trim() || '#021D6A',
        weight: 4,
        opacity: 0.85,
      }).addTo(this.map);
    }

    if (latLngs.length === 1) {
      this.map.setView(latLngs[0], 14);
    } else {
      this.map.fitBounds(L.latLngBounds(latLngs), {
        paddingTopLeft: [40, 40],
        paddingBottomRight: [40, 100], // extra bottom room for the floating info panel
      });
    }
  }

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
