import {
  Component,
  ChangeDetectionStrategy,
  AfterViewInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  EventEmitter,
  Output,
  Input,
} from '@angular/core';
import { IonicModule } from '@ionic/angular';
import SignaturePad from 'signature_pad';

/**
 * Canvas-based signature capture component.
 *
 * Emits (end) with the base64 PNG (data-URL form) every time the user lifts
 * their finger/stylus. Parent components typically take the latest value
 * on Save and push it to DevicePostDto.signature via SignatureService.
 *
 * Phase 4 will wire the Save flow; in Phase 1 the component just renders.
 */
@Component({
  selector: 'curtis-signature-pad',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonicModule],
  styles: [
    `
      :host {
        display: block;
      }
      .pad {
        position: relative;
        width: 100%;
        aspect-ratio: 2/1;
        border: 1px dashed var(--ion-color-medium);
        border-radius: 8px;
        background: #fff;
      }
      canvas {
        width: 100%;
        height: 100%;
        display: block;
        touch-action: none;
      }
      .actions {
        display: flex;
        gap: 0.5rem;
        margin-top: 0.5rem;
      }
    `,
  ],
  template: `
    <div class="pad">
      <canvas #canvas></canvas>
    </div>
    <div class="actions">
      <ion-button fill="outline" color="medium" size="small" (click)="clear()">
        <ion-icon slot="start" name="refresh-outline" />
        Clear
      </ion-button>
    </div>
  `,
})
export class SignaturePadComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @Input() penColor = '#111';
  @Output() end = new EventEmitter<string>();

  private pad?: SignaturePad;
  private resizeObserver?: ResizeObserver;

  ngAfterViewInit(): void {
    const canvas = this.canvasRef.nativeElement;
    this.pad = new SignaturePad(canvas, { penColor: this.penColor });
    this.pad.addEventListener('endStroke', () => {
      this.end.emit(this.pad?.toDataURL('image/png') ?? '');
    });
    this.fitCanvas();

    this.resizeObserver = new ResizeObserver(() => this.fitCanvas());
    this.resizeObserver.observe(canvas.parentElement as HTMLElement);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.pad?.off();
  }

  clear(): void {
    this.pad?.clear();
  }

  isEmpty(): boolean {
    return this.pad?.isEmpty() ?? true;
  }

  toDataUrl(): string | null {
    return this.pad && !this.pad.isEmpty() ? this.pad.toDataURL('image/png') : null;
  }

  private fitCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.getContext('2d')?.scale(ratio, ratio);
    this.pad?.clear();
  }
}
