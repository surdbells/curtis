import { bootstrapApplication } from '@angular/platform-browser';
import { defineCustomElements as defineJeepSqlite } from 'jeep-sqlite/loader';

import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

// Register the <jeep-sqlite> custom element so @capacitor-community/sqlite has
// a web-platform store to fall back to. On native platforms this is a no-op.
defineJeepSqlite(window);

bootstrapApplication(AppComponent, appConfig).catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
});
