import {
  Component,
  ChangeDetectionStrategy,
  Input,
  computed,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, type LucideIconData } from 'lucide-angular';
import { resolveIcon, type CurtisIconName } from './icons.registry';

/**
 * CurtisIcon — single icon primitive used everywhere in the app.
 *
 * Wraps lucide-angular with a name-based API matching the Ionicons
 * taxonomy used in earlier phases, so migrating from <ion-icon> to
 * <curtis-icon> is a textual find-and-replace per file.
 *
 * Usage:
 *   <curtis-icon name="settings-outline" />
 *   <curtis-icon name="settings-outline" size="lg" />
 *   <curtis-icon name="trash-outline" color="danger" />
 *   <curtis-icon name="checkmark-circle-outline" slot="start" />  inside <ion-button>
 *
 * Sizing maps:
 *   xs:  14px
 *   sm:  18px  (matches Ionicons' default in body text)
 *   md:  22px  (default — matches Ionicons inside ion-buttons)
 *   lg:  28px
 *   xl:  36px
 *
 * Color uses CSS currentColor by default so it inherits from the
 * surrounding text or button color. Passing a color name maps to
 * Ionic color tokens via var(--ion-color-{name}).
 *
 * The slot attribute is forwarded to the host so ion-button slot
 * positioning works without wrapper changes.
 */
@Component({
  selector: 'curtis-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, LucideAngularModule],
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        line-height: 0;
        flex-shrink: 0;
        color: currentColor;
      }
      :host[hidden] { display: none; }
      lucide-icon { display: block; }

      /* When used as ion-button's start/end slot, mirror Ionicons' spacing */
      :host([slot='start']) { margin-right: 0.4em; }
      :host([slot='end'])   { margin-left:  0.4em; }
      /* icon-only slot — Ionic sizes the button; we just centre + size up slightly */
      :host([slot='icon-only']) lucide-icon { width: 24px; height: 24px; }
    `,
  ],
  template: `
    @if (icon(); as ic) {
      <lucide-icon
        [name]="ic"
        [size]="sizePx()"
        [strokeWidth]="strokeWidth"
        [color]="resolvedColor()"
      />
    }
  `,
})
export class CurtisIconComponent {
  /** Icon name from the registry. Unknown names render nothing (no throw). */
  @Input({ required: true })
  set name(value: CurtisIconName | string) {
    this._name.set(value);
  }
  get name(): string {
    return this._name();
  }
  private readonly _name = signal<string>('');

  /** Size keyword. Defaults to 'md' which matches Ionicons in ion-button. */
  @Input() size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number = 'md';

  /**
   * Optional Ionic color token name ('primary', 'tertiary', 'danger', etc).
   * When omitted the icon inherits currentColor — which is what you want
   * inside coloured buttons and beside coloured text.
   */
  @Input() color: string | null = null;

  /** Lucide stroke weight. Default 2 matches Lucide's house style. */
  @Input() strokeWidth = 2;

  protected readonly icon = computed<LucideIconData | undefined>(() =>
    resolveIcon(this._name()),
  );

  protected readonly sizePx = computed<number>(() => {
    const s = this.size;
    if (typeof s === 'number') return s;
    switch (s) {
      case 'xs': return 14;
      case 'sm': return 18;
      case 'lg': return 28;
      case 'xl': return 36;
      case 'md':
      default:   return 22;
    }
  });

  protected readonly resolvedColor = computed<string>(() => {
    if (!this.color) return 'currentColor';
    // Map well-known Ionic palette names to their CSS vars so consumers
    // can write color="primary" the way they would on an ion-icon.
    const known = new Set(['primary', 'secondary', 'tertiary', 'success', 'warning', 'danger', 'medium', 'light', 'dark']);
    return known.has(this.color)
      ? `var(--ion-color-${this.color})`
      : this.color;
  });
}
