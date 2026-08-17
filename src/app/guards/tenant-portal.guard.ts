import { Injectable } from '@angular/core';
import { CanActivate, CanMatch, Router } from '@angular/router';
import { PortalService } from '../services/portal.service';

@Injectable({
  providedIn: 'root',
})
export class TenantPortalGuard implements CanActivate, CanMatch {

  constructor(
    private portal: PortalService,
    private router: Router,
  ) {}

  canMatch(): boolean {
    return this.portal.isTenant() && !!this.portal.tenantSlug;
  }

  canActivate(): boolean {
    if (this.canMatch()) {
      return true;
    }

    this.router.navigate(['/login']);
    return false;
  }
}
