import { Component, OnInit, inject } from '@angular/core';
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

  sidebarOpen = false;

  ngOnInit(): void {
    // Warm the location cache on (re)entering the tenant shell — e.g. after a
    // full page reload. Already-cached data is reused, so no redundant calls.
    if (this.session.getToken()) {
      this.locationCache.warmCache();
    }
  }

  toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen;
  }
}
