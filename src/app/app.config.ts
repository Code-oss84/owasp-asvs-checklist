// src/app/app.config.ts

import { ApplicationConfig, provideZoneChangeDetection, PLATFORM_ID, inject } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http'; // Ajout de withFetch
import { provideClientHydration } from '@angular/platform-browser';
import { isPlatformBrowser } from '@angular/common';
import { routes } from './app.routes';
import { DecimalPipe, DatePipe } from '@angular/common';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withFetch()), // Important : withFetch pour le SSR
    provideClientHydration(),
    DecimalPipe,
    DatePipe
  ]
};