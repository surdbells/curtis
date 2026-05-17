import {
  Component,
  ChangeDetectionStrategy,
  Input,
  inject,
} from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';

import { CurtisIconComponent } from '../icon';

/**
 * CurtisHeaderComponent — the custom navy gradient header (Option A)
 * that replaces Ionic's `<ion-header>` chrome on every page.
 *
 * Visual structure (top-down):
 *   1. Top row: [back btn?] [title + status pill] [end slot]
 *   2. Optional second row: search input (full width)
 *
 * Slots projected via `ng-content`:
 *   - `[slot=status]` — typically a `<curtis-header-status>` element
 *   - `[slot=end]`    — one or more `<curtis-header-action>` elements
 *   - `[slot=search]` — typically a `<curtis-header-search>` element
 *
 * Back button behavior (when `showBack` is true):
 *   - Default: calls `Location.back()` (in-app history)
 *   - If the app has no in-app history (e.g. deep link / push notification
 *     opened the page directly), falls back to navigating to `backHref`
 *   - `backHref` defaults to `/dashboard`
 *
 * The component is wrapped in an `<ion-header>` shell so Ionic's
 * `<ion-content>` continues to compute its scroll offset, safe-area, and
 * keyboard avoidance correctly. From the agent's perspective the chrome
 * is fully custom; from Ionic's perspective the page still has a header.
 *
 * @example
 *   <curtis-header title="Today's stops">
 *     <curtis-header-status slot="status" variant="success" label="On shift" />
 *     <curtis-header-action
 *       slot="end"
 *       icon="settings-outline"
 *       ariaLabel="Open settings"
 *       routerLink="/settings"
 *     />
 *   </curtis-header>
 *
 *   <!-- With search row -->
 *   <curtis-header title="Sync queue">
 *     <curtis-header-search
 *       slot="search"
 *       placeholder="Filter by URL or method"
 *       [(query)]="filter"
 *     />
 *   </curtis-header>
 */
@Component({
  selector: 'curtis-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonicModule, CurtisIconComponent],
  styles: [
    `
      :host { display: block; }

      /* The Ionic shell becomes a no-op visually; we paint the inner div. */
      ion-header {
        --background: transparent;
        background: transparent;
        box-shadow: none;
      }
      ion-header::after {
        display: none; /* kill Ionic's MD bottom shadow */
      }

      .shell {
        position: relative;
        background: var(--curtis-header-bg);
        color: var(--curtis-header-fg);
        padding-top: env(safe-area-inset-top, 0);
        overflow: hidden;
      }
      /* Subtle gold radial accent in the top-right — ties the chrome to
         the brand without overwhelming page content. */
      .shell::after {
        content: '';
        position: absolute;
        inset: 0;
        background:
          radial-gradient(60% 80% at 100% 0%, rgba(201, 162, 39, 0.18), transparent 60%),
          radial-gradient(40% 60% at 0% 100%, rgba(255, 255, 255, 0.06), transparent 70%);
        pointer-events: none;
      }
      .shell > * { position: relative; z-index: 1; }

      /* Top row */
      .row {
        display: flex;
        align-items: center;
        gap: var(--curtis-space-3);
        min-height: 56px;
        padding: var(--curtis-space-2_5) var(--curtis-space-4);
      }

      .back-btn {
        width: 36px;
        height: 36px;
        border-radius: var(--curtis-radius-sm);
        background: var(--curtis-header-control-bg);
        border: 1px solid var(--curtis-header-control-border);
        color: var(--curtis-header-fg);
        display: grid;
        place-items: center;
        padding: 0;
        margin: 0;
        flex-shrink: 0;
        cursor: pointer;
        transition: background var(--curtis-duration-fast) var(--curtis-ease-out),
                    transform var(--curtis-duration-fast) var(--curtis-ease-out);
        -webkit-tap-highlight-color: transparent;
      }
      .back-btn:hover { background: var(--curtis-header-control-bg-hover); }
      .back-btn:active { transform: scale(0.94); }
      .back-btn:focus-visible {
        outline: none;
        box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.6);
      }

      .titles {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .title {
        font-size: var(--curtis-text-md);
        font-weight: var(--curtis-weight-semibold);
        letter-spacing: var(--curtis-tracking-tight);
        color: var(--curtis-header-fg);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        line-height: 1.2;
      }
      .subtitle {
        font-size: var(--curtis-text-xs);
        color: var(--curtis-header-fg-muted);
        line-height: 1.2;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      /* End slot — flex container so multiple actions stack cleanly */
      .end {
        display: flex;
        align-items: center;
        gap: var(--curtis-space-2);
        flex-shrink: 0;
      }

      /* Search row (only renders when a child is projected) */
      .search-row {
        padding: 0 var(--curtis-space-4) var(--curtis-space-3);
      }

      /* Compact variant: tighter min-height, smaller title — useful for
         dense sub-pages without much chrome. */
      :host([variant='compact']) .row {
        min-height: 48px;
        padding-top: var(--curtis-space-2);
        padding-bottom: var(--curtis-space-2);
      }
      :host([variant='compact']) .title { font-size: var(--curtis-text-base); }
    `,
  ],
  template: `
    <ion-header [translucent]="false">
      <div class="shell">
        <div class="row">
          @if (showBack) {
            <button
              type="button"
              class="back-btn"
              aria-label="Go back"
              (click)="onBack()"
            >
              <curtis-icon name="chevron-back-outline" size="sm" />
            </button>
          }

          <div class="titles">
            <span class="title">{{ title }}</span>
            <ng-content select="[slot=status]"></ng-content>
            @if (subtitle) {
              <span class="subtitle">{{ subtitle }}</span>
            }
          </div>

          <div class="end">
            <ng-content select="[slot=end]"></ng-content>
          </div>
        </div>

        <div class="search-row">
          <ng-content select="[slot=search]"></ng-content>
        </div>
      </div>
    </ion-header>
  `,
})
export class CurtisHeaderComponent {
  private readonly location = inject(Location);
  private readonly router = inject(Router);

  /** Page title (required). */
  @Input({ required: true }) title!: string;

  /** Optional second-line subtitle below the title. */
  @Input() subtitle?: string;

  /** Whether to render the back button. Default `true`. */
  @Input() showBack = true;

  /**
   * Fallback target if the in-app history is empty (e.g. deep link).
   * Defaults to `/dashboard` — the universal "home" for an authenticated
   * agent.
   */
  @Input() backHref: string = '/dashboard';

  /**
   * 'standard' (default) — comfortable spacing.
   * 'compact' — tighter min-height for sub-pages or modal-like screens.
   */
  @Input() variant: 'standard' | 'compact' = 'standard';

  protected onBack(): void {
    // Use the in-app history when possible. window.history.length > 1
    // is the cheap proxy — anything beyond the initial entry has somewhere
    // to go back to.
    if (typeof window !== 'undefined' && window.history.length > 1) {
      this.location.back();
      return;
    }
    void this.router.navigateByUrl(this.backHref, { replaceUrl: true });
  }
}
