import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { PortalService } from '../services/portal.service';

@Injectable({
  providedIn: 'root',
})
export class TenantPortalGuard implements CanActivate {

  constructor(
    private portal: PortalService,
    private router: Router,
  ) {}

  canActivate(): boolean {
    if (this.portal.isTenant() && this.portal.tenantSlug) {
      return true;
    }

    this.router.navigate(['/login']);
    return false;
  }
}
