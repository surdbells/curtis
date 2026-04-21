import { Component, ChangeDetectionStrategy, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

/**
 * Inline loading overlay — for pages that want to gate their content behind
 * an initial fetch. For modal/blocking spinners use Ionic's LoadingController
 * directly.
 */
@Component({
  selector: 'curtis-loading-overlay',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonicModule],
  styles: [
    `
      :host {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        gap: 0.75rem;
        padding: 2rem;
        color: var(--ion-color-medium);
      }
    `,
  ],
  template: `
    <ion-spinner name="crescent" />
    @if (message) {
      <small>{{ message }}</small>
    }
  `,
})
export class LoadingOverlayComponent {
  @Input() message?: string;
}
