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

  /** Mobile drawer open/closed (unchanged). */
  sidebarOpen = false;

  /** True while the employee is inside a dedicated full-screen assignment (/my-forms/:id). */
  readonly isAssignmentFullscreen = signal(false);

  /**
   * Desktop compact rail. Collapsed (not hidden) on Form Template create/edit
   * so the Form Builder gets extra width; expand control can override.
   */
  readonly sidebarCollapsed = signal(false);

  constructor() {
    this.applyRouteChrome(this.router.url);

    this.router.events
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        if (event instanceof NavigationEnd) {
          this.applyRouteChrome(event.urlAfterRedirects);
        }
      });
  }

  ngOnInit(): void {
    // Warm the location cache on (re)entering the tenant shell — e.g. after a
    // full page reload. Already-cached data is reused, so no redundant calls.
    this.applyRouteChrome(this.router.url);
    if (this.session.getToken()) {
      this.locationCache.warmCache();
    }
  }

  private applyRouteChrome(url: string): void {
    const path = url.split('?')[0];
    this.isAssignmentFullscreen.set(this.isFullscreenRoute(path));

    const formEditor = this.isFormEditorRoute(path);
    // Create/Edit → compact sidebar. Listing and all other routes → expanded.
    this.sidebarCollapsed.set(formEditor);
    if (formEditor) {
      this.sidebarOpen = false;
    }
  }

  private isFullscreenRoute(url: string): boolean {
    return /^\/my-forms\/[^/?#]+/.test(url);
  }

  /** Form Template create (/dynamic-forms/create) or edit (/dynamic-forms/edit/:id). */
  private isFormEditorRoute(url: string): boolean {
    return (
      /^\/dynamic-forms\/create\/?$/.test(url) ||
      /^\/dynamic-forms\/edit\/[^/?#]+/.test(url)
    );
  }

  toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen;
  }

  /** Expand/collapse the desktop sidebar rail (does not hide it). */
  toggleSidebarCollapsed(): void {
    this.sidebarCollapsed.update((value) => !value);
  }

  expandSidebar(): void {
    this.sidebarCollapsed.set(false);
  }
}
