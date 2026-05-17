import { Component, ChangeDetectionStrategy, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

import { CurtisIconComponent } from '../icon';

/**
 * Status pill variants. Each maps to a colour-coded dot inside the pill.
 *
 *   - `success` — green dot, pulsing glow. Use for: 'On shift', 'Online'.
 *   - `warning` — amber dot. Use for: 'Offline', 'Slow sync'.
 *   - `info`    — gold dot. Use for: 'Syncing 3', queued counts.
 *   - `danger`  — red dot. Use for: 'Critical', 'SOS active'.
 *   - `neutral` — white dot. Use for: 'Ready', 'Idle' (default for unknown).
 */
export type CurtisHeaderStatusVariant =
  | 'success'
  | 'warning'
  | 'info'
  | 'danger'
  | 'neutral';

/**
 * CurtisHeaderStatusComponent — the small pill that sits below the title
 * line in the navy gradient header.
 *
 * Designed for glance-readable context, not interactive control. If a
 * page needs to toggle state, render a separate button in the action
 * slot instead.
 *
 * Visual rules:
 *   - Always renders even with no label, so positioning stays stable
 *     (shows just the dot in that case)
 *   - The success variant pulses subtly to convey "live"
 *   - Tabular-nums on the label so numeric counts (e.g. "Syncing 3")
 *     don't shift between renders
 *
 * @example
 *   <!-- Dashboard: on-shift indicator -->
 *   <curtis-header-status slot="status" variant="success" label="On shift" />
 *
 *   <!-- Queue: live count of pending requests -->
 *   <curtis-header-status
 *     slot="status"
 *     [variant]="pending() > 0 ? 'info' : 'success'"
 *     [label]="pending() > 0 ? 'Syncing ' + pending() : 'Synced'"
 *   />
 */
@Component({
  selector: 'curtis-header-status',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, CurtisIconComponent],
  styles: [
    `
      :host { display: inline-flex; }

      .pill {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 3px 9px 3px 8px;
        border-radius: var(--curtis-radius-pill);
        background: var(--curtis-header-pill-bg);
        border: 1px solid var(--curtis-header-pill-border);
        font-size: 10px;
        font-weight: var(--curtis-weight-semibold);
        letter-spacing: var(--curtis-tracking-wider);
        text-transform: uppercase;
        color: var(--curtis-header-fg);
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
        line-height: 1;
      }

      .dot {
        width: 6px;
        height: 6px;
        border-radius: var(--curtis-radius-pill);
        background: #fff;
        flex-shrink: 0;
      }
      .pill.success .dot {
        background: #34D399;
        box-shadow: 0 0 8px rgba(52, 211, 153, 0.6);
        animation: pulse-dot 2.2s var(--curtis-ease-in-out) infinite;
      }
      .pill.warning .dot { background: var(--amber-400); }
      .pill.info    .dot { background: var(--gold-300); }
      .pill.danger  .dot {
        background: var(--red-400);
        box-shadow: 0 0 8px rgba(248, 113, 113, 0.55);
        animation: pulse-dot 1.4s var(--curtis-ease-in-out) infinite;
      }

      @keyframes pulse-dot {
        0%, 100% { transform: scale(1); opacity: 1; }
        50%      { transform: scale(1.25); opacity: 0.75; }
      }

      curtis-icon {
        margin-right: 1px;
        color: var(--curtis-header-fg-muted);
      }
    `,
  ],
  template: `
    <span class="pill" [class.success]="variant === 'success'"
                       [class.warning]="variant === 'warning'"
                       [class.info]="variant === 'info'"
                       [class.danger]="variant === 'danger'">
      @if (icon) {
        <curtis-icon [name]="icon" size="xs" />
      } @else {
        <span class="dot"></span>
      }
      @if (label) { {{ label }} }
    </span>
  `,
})
export class CurtisHeaderStatusComponent {
  /** Visual variant — drives the dot colour and animation. */
  @Input() variant: CurtisHeaderStatusVariant = 'neutral';

  /** Short label text. Keep under 18 characters or it'll feel cramped. */
  @Input() label?: string;

  /**
   * Optional icon name (Lucide, registered in `icons.registry.ts`). When
   * set, the icon replaces the coloured dot. Useful for variants the
   * dot system doesn't express (e.g. wifi off icon for offline).
   */
  @Input() icon?: string;
}
