import { Component, inject } from '@angular/core';
import { PwaService } from './services/pwa.service';
import { BrandingService } from './services/branding.service';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrl: './app.component.scss',
    standalone: false
})
export class AppComponent {
  readonly pwa = inject(PwaService);
  readonly branding = inject(BrandingService);
  title = 'simple';
}
