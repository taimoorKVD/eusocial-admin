import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { TenantSessionService } from '../../services/tenant-session.service';
import { LocationCacheService } from '../../services/location-cache.service';


@Component({
  selector: 'app-tenant-layout',
  standalone: false,

  templateUrl: './tenant-layout.component.html',
  styleUrl: './tenant-layout.component.scss'
})
export class TenantLayoutComponent implements OnInit {
  private readonly session = inject(TenantSessionService);
  private readonly locationCache = inject(LocationCacheService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  sidebarOpen = false;

  /** True while the employee is inside a dedicated full-screen assignment (/my-forms/:id). */
  readonly isAssignmentFullscreen = signal(false);

  constructor() {
    this.isAssignmentFullscreen.set(this.isFullscreenRoute(this.router.url));

    this.router.events
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        if (event instanceof NavigationEnd) {
          this.isAssignmentFullscreen.set(this.isFullscreenRoute(event.urlAfterRedirects));
        }
      });
  }

  ngOnInit(): void {
    // Warm the location cache on (re)entering the tenant shell — e.g. after a
    // full page reload. Already-cached data is reused, so no redundant calls.
    this.isAssignmentFullscreen.set(this.isFullscreenRoute(this.router.url));
    if (this.session.getToken()) {
      this.locationCache.warmCache();
    }
  }

  private isFullscreenRoute(url: string): boolean {
    return /^\/my-forms\/[^/?#]+/.test(url.split('?')[0]);
  }

  toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen;
  }
}
