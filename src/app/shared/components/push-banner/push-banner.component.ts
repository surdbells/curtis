import { Component, ChangeDetectionStrategy, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

import { PushService } from '../../../core/services/push.service';
import {
  PUSH_CATEGORY_COLORS,
  PUSH_CATEGORY_ICONS,
  type PushPayload,
} from '../../../core/models/push.model';

/**
 * In-app push banner — Phase 7 Commit 3.
 *
 * Renders a subtle top-of-screen banner whenever PushService.incoming
 * has a value (i.e. a push arrived while the app was in foreground).
 *
 * Tap → follow the deep-link from the payload (or default for category).
 * Tap dismiss (X) → clear without navigating.
 *
 * Mounted globally inside AppComponent so it appears over any page.
 */
@Component({
  selector: 'curtis-push-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonicModule],
  styles: [
    `
      :host {
        position: fixed;
        top: env(safe-area-inset-top, 0);
        left: 0; right: 0;
        z-index: 1000;
        pointer-events: none;
        display: block;
      }

      .banner {
        pointer-events: auto;
        margin: 0.5rem 0.75rem;
        padding: 0.75rem 0.85rem;
        background: var(--curtis-surface-1);
        border: 1px solid var(--curtis-border);
        border-left-width: 4px;
        border-radius: var(--curtis-radius-md);
        box-shadow: var(--curtis-shadow-lg);
        display: flex; align-items: center; gap: 0.75rem;
        animation: banner-in 220ms cubic-bezier(0.16, 1, 0.3, 1);
        cursor: pointer;
      }
      .banner.primary    { border-left-color: var(--ion-color-primary); }
      .banner.tertiary   { border-left-color: var(--ion-color-tertiary); }
      .banner.success    { border-left-color: var(--ion-color-success); }
      .banner.warning    { border-left-color: var(--ion-color-warning); }

      .icon-wrap {
        width: 36px; height: 36px;
        border-radius: 10px;
        flex-shrink: 0;
        display: grid; place-items: center;
      }
      .icon-wrap.primary    { background: color-mix(in srgb, var(--ion-color-primary) 16%, transparent); color: var(--ion-color-primary); }
      .icon-wrap.tertiary   { background: color-mix(in srgb, var(--ion-color-tertiary) 22%, transparent); color: var(--ion-color-tertiary); }
      .icon-wrap.success    { background: color-mix(in srgb, var(--ion-color-success) 16%, transparent); color: var(--ion-color-success); }
      .icon-wrap.warning    { background: color-mix(in srgb, var(--ion-color-warning) 22%, transparent); color: var(--ion-color-warning); }
      .icon-wrap ion-icon { font-size: 1.25rem; }

      .body { flex: 1; min-width: 0; }
      .title {
        font-weight: 700; font-size: 0.92rem;
        color: var(--curtis-text);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .text {
        font-size: 0.8rem;
        color: var(--curtis-text-muted);
        margin-top: 0.1rem;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .dismiss {
        flex-shrink: 0;
        background: transparent; border: none;
        color: var(--curtis-text-subtle);
        padding: 0.25rem;
        cursor: pointer;
      }
      .dismiss:hover { color: var(--curtis-text); }
      .dismiss ion-icon { font-size: 1.2rem; }

      @keyframes banner-in {
        from { opacity: 0; transform: translateY(-12px); }
        to   { opacity: 1; transform: translateY(0); }
      }
    `,
  ],
  template: `
    @if (push.incoming(); as p) {
      <div
        class="banner"
        [class.primary]="color() === 'primary'"
        [class.tertiary]="color() === 'tertiary'"
        [class.success]="color() === 'success'"
        [class.warning]="color() === 'warning'"
        role="button"
        tabindex="0"
        (click)="open()"
        (keydown.enter)="open()"
        (keydown.space)="open()"
      >
        <div
          class="icon-wrap"
          [class.primary]="color() === 'primary'"
          [class.tertiary]="color() === 'tertiary'"
          [class.success]="color() === 'success'"
          [class.warning]="color() === 'warning'"
        >
          <ion-icon [name]="iconName()" />
        </div>
        <div class="body">
          <div class="title">{{ p.title }}</div>
          @if (p.body) {
            <div class="text">{{ p.body }}</div>
          }
        </div>
        <button
          type="button"
          class="dismiss"
          (click)="dismiss($event)"
          aria-label="Dismiss notification"
        >
          <ion-icon name="close-outline" />
        </button>
      </div>
    }
  `,
})
export class PushBannerComponent {
  protected readonly push = inject(PushService);

  protected readonly color = computed(() => {
    const p = this.push.incoming();
    return p ? PUSH_CATEGORY_COLORS[p.category] : 'primary';
  });

  protected readonly iconName = computed(() => {
    const p = this.push.incoming();
    return p ? PUSH_CATEGORY_ICONS[p.category] : 'notifications-outline';
  });

  open(): void {
    void this.push.followIncomingDeepLink();
  }

  dismiss(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.push.clearIncoming();
  }
}
