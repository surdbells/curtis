import { Component, ChangeDetectionStrategy, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import type { Seal } from '../../../core/models';

/**
 * Presentational list of seals with scanned/pending/missing state.
 * Consumers pass in the array; all interaction logic lives in the parent.
 */
@Component({
  selector: 'curtis-seal-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonicModule],
  template: `
    <ion-list>
      @for (seal of seals; track seal.id) {
        <ion-item>
          <ion-icon
            slot="start"
            [name]="iconFor(seal.status)"
            [color]="colorFor(seal.status)"
          />
          <ion-label>
            <h3>{{ seal.number || seal.id }}</h3>
            @if (seal.status) {
              <p>{{ seal.status | titlecase }}</p>
            }
          </ion-label>
        </ion-item>
      } @empty {
        <ion-item lines="none">
          <ion-label color="medium">
            <small>No seals loaded</small>
          </ion-label>
        </ion-item>
      }
    </ion-list>
  `,
})
export class SealListComponent {
  @Input() seals: Seal[] = [];

  protected iconFor(status?: string): string {
    switch (status) {
      case 'scanned':
        return 'checkmark-circle';
      case 'missing':
        return 'alert-circle';
      case 'damaged':
        return 'warning';
      default:
        return 'ellipse-outline';
    }
  }

  protected colorFor(status?: string): string {
    switch (status) {
      case 'scanned':
        return 'success';
      case 'missing':
        return 'danger';
      case 'damaged':
        return 'warning';
      default:
        return 'medium';
    }
  }
}
