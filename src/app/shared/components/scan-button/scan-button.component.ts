import { Component, ChangeDetectionStrategy, EventEmitter, Input, Output } from '@angular/core';
import { IonicModule } from '@ionic/angular';

/**
 * Prominent "Scan seal" button used across seal flows. Emits (scan) when
 * tapped; the host page wires this to ScannerService and handles the result.
 */
@Component({
  selector: 'curtis-scan-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonicModule],
  template: `
    <ion-button expand="block" size="large" [disabled]="disabled" (click)="scan.emit()">
      <ion-icon slot="start" name="qr-code-outline" />
      {{ label }}
    </ion-button>
  `,
})
export class ScanButtonComponent {
  @Input() label = 'Scan seal';
  @Input() disabled = false;
  @Output() scan = new EventEmitter<void>();
}
