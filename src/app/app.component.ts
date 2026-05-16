import { Component, ChangeDetectionStrategy } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { PushBannerComponent } from './shared/components/push-banner/push-banner.component';

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonicModule, PushBannerComponent],
  template: `
    <ion-app>
      <ion-router-outlet />
      <!-- Global push banner — appears top-of-screen when a push arrives
           in foreground. Position is fixed and respects safe-area-inset-top
           so it sits below the status bar. -->
      <curtis-push-banner />
    </ion-app>
  `,
})
export class AppComponent {}
