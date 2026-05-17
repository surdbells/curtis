import { Component, ChangeDetectionStrategy, Input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import { CurtisIconComponent } from '../icon';

/**
 * CurtisHeaderActionComponent — a 32x32 icon-only button designed to sit
 * inside a `<curtis-header>` start or end slot. White-on-navy styling
 * matches the Option A gradient header.
 *
 * Use cases:
 *   - Settings cog on the dashboard
 *   - Refresh / filter / delete on list pages
 *   - Any single-purpose action that lives in the header chrome
 *
 * The button is a `<button type="button">` by default. If a `routerLink`
 * is provided, it renders as `<a>` so Angular Router handles navigation
 * with full history support. Either way the visual treatment is identical.
 *
 * Accessibility:
 *   - `ariaLabel` is required and announced to screen readers
 *   - The icon is `aria-hidden` since the label conveys meaning
 *   - Focus-visible ring matches the rest of the design system
 *
 * @example
 *   <curtis-header-action
 *     icon="settings-outline"
 *     ariaLabel="Open settings"
 *     routerLink="/settings"
 *   />
 *
 *   <curtis-header-action
 *     icon="refresh-outline"
 *     ariaLabel="Refresh queue"
 *     (action)="refresh()"
 *   />
 */
@Component({
  selector: 'curtis-header-action',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, CurtisIconComponent],
  styles: [
    `
      :host { display: inline-flex; flex-shrink: 0; }

      .btn {
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
        cursor: pointer;
        text-decoration: none;
        transition:
          background var(--curtis-duration-fast) var(--curtis-ease-out),
          transform var(--curtis-duration-fast) var(--curtis-ease-out);
        -webkit-tap-highlight-color: transparent;
      }
      .btn:hover { background: var(--curtis-header-control-bg-hover); }
      .btn:active { transform: scale(0.94); }
      .btn:focus-visible {
        outline: none;
        box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.6);
      }
      .btn[disabled] { opacity: 0.45; cursor: not-allowed; }
    `,
  ],
  template: `
    @if (routerLink) {
      <a
        class="btn"
        [routerLink]="routerLink"
        [attr.aria-label]="ariaLabel"
      >
        <curtis-icon [name]="icon" size="sm" />
      </a>
    } @else {
      <button
        class="btn"
        type="button"
        [attr.aria-label]="ariaLabel"
        [disabled]="disabled"
        (click)="onClick($event)"
      >
        <curtis-icon [name]="icon" size="sm" />
      </button>
    }
  `,
})
export class CurtisHeaderActionComponent {
  /** Lucide icon name registered in `icons.registry.ts`. */
  @Input({ required: true }) icon!: string;

  /** Required for accessibility — describes what the button does. */
  @Input({ required: true }) ariaLabel!: string;

  /**
   * If set, renders as a router link instead of a button. Use this for
   * navigation actions (e.g. "Open settings"). Use `(action)` for
   * imperative actions (e.g. "Refresh queue").
   */
  @Input() routerLink?: string | unknown[];

  /** Disables the button. Has no effect when `routerLink` is used. */
  @Input() disabled = false;

  /** Fired when the button is tapped (only when not using `routerLink`). */
  readonly action = output<void>();

  protected onClick(event: Event): void {
    event.preventDefault();
    if (this.disabled) return;
    this.action.emit();
  }
}
