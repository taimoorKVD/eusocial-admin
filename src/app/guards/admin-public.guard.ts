import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { PortalService } from '../services/portal.service';

@Injectable({
  providedIn: 'root',
})
export class AdminPublicGuard implements CanActivate {

  constructor(
    private portal: PortalService,
    private router: Router,
  ) {}

  canActivate(): boolean {
    if (this.portal.isAdmin()) {
      return true;
    }

    this.router.navigate(['/tenant/login']);
    return false;
  }
}
