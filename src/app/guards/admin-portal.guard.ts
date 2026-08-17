import { Injectable } from '@angular/core';
import { CanActivate, CanMatch, Router } from '@angular/router';
import { PortalService } from '../services/portal.service';

@Injectable({
  providedIn: 'root',
})
export class AdminPortalGuard implements CanActivate, CanMatch {

  constructor(
    private portal: PortalService,
    private router: Router,
  ) {}

  canMatch(): boolean {
    return this.portal.isAdmin();
  }

  canActivate(): boolean {
    if (this.portal.isAdmin()) {
      return true;
    }

    this.router.navigate(['/login']);
    return false;
  }
}
