import {
  Component,
  ChangeDetectionStrategy,
  Input,
  model,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { CurtisIconComponent } from '../icon';

/**
 * CurtisHeaderSearchComponent — a filter-style search input that lives
 * inside the navy gradient header.
 *
 * Designed for client-side filtering (queue, daily stops, banks) not
 * remote search. Pages bind the `query` signal/model to their own filter
 * state and react via computed signals.
 *
 * The component:
 *   - Renders a search icon on the left, an input in the middle, and a
 *     clear (X) button on the right when there's a query
 *   - Uses semi-transparent white-on-navy styling that ties to the rest
 *     of the header controls
 *   - Two-way binds via Angular's new `model()` API so consumers can use
 *     either `[query]` + `(queryChange)` or `[(query)]`
 *
 * @example
 *   <curtis-header-search
 *     slot="search"
 *     placeholder="Search seals…"
 *     [(query)]="filter"
 *   />
 */
@Component({
  selector: 'curtis-header-search',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, CurtisIconComponent],
  styles: [
    `
      :host { display: block; }

      .row {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 0 var(--curtis-space-2_5);
        background: var(--curtis-header-search-bg);
        border: 1px solid var(--curtis-header-search-border);
        border-radius: var(--curtis-radius-md);
        height: 40px;
        transition: background var(--curtis-duration-fast) var(--curtis-ease-out),
                    border-color var(--curtis-duration-fast) var(--curtis-ease-out);
      }
      .row:focus-within {
        background: rgba(255, 255, 255, 0.18);
        border-color: rgba(255, 255, 255, 0.32);
      }

      .icon {
        color: var(--curtis-header-fg-muted);
        flex-shrink: 0;
      }

      input {
        flex: 1;
        height: 100%;
        background: transparent;
        border: none;
        outline: none;
        color: var(--curtis-header-fg);
        font-family: var(--curtis-font-sans);
        font-size: var(--curtis-text-sm);
        font-weight: var(--curtis-weight-medium);
        padding: 0;
        min-width: 0;
      }
      input::placeholder {
        color: var(--curtis-header-fg-subtle);
        font-weight: var(--curtis-weight-regular);
      }

      .clear {
        flex-shrink: 0;
        background: none;
        border: none;
        padding: 0;
        margin: 0;
        color: var(--curtis-header-fg-muted);
        display: grid;
        place-items: center;
        cursor: pointer;
        width: 22px;
        height: 22px;
        border-radius: var(--curtis-radius-pill);
        transition: background var(--curtis-duration-fast) var(--curtis-ease-out);
      }
      .clear:hover {
        background: rgba(255, 255, 255, 0.16);
        color: var(--curtis-header-fg);
      }
    `,
  ],
  template: `
    <div class="row">
      <curtis-icon class="icon" name="search-outline" size="sm" />
      <input
        type="search"
        autocomplete="off"
        autocorrect="off"
        spellcheck="false"
        [attr.aria-label]="ariaLabel"
        [placeholder]="placeholder"
        [ngModel]="query()"
        (ngModelChange)="query.set($event)"
      />
      @if (query()) {
        <button
          type="button"
          class="clear"
          aria-label="Clear search"
          (click)="clear()"
        >
          <curtis-icon name="close-outline" size="xs" />
        </button>
      }
    </div>
  `,
})
export class CurtisHeaderSearchComponent {
  /** Two-way bound search query string. Use `[(query)]` for ngModel-style. */
  readonly query = model<string>('');

  /** Placeholder text. */
  @Input() placeholder = 'Search…';

  /** Accessible label for screen readers. */
  @Input() ariaLabel = 'Search';

  protected clear(): void {
    this.query.set('');
  }
}
