import { Injectable } from '@angular/core';
import { CanActivate } from '@angular/router';
import { PortalService } from '../services/portal.service';

@Injectable({
  providedIn: 'root',
})
export class AdminPublicGuard implements CanActivate {

  constructor(
    private portal: PortalService,
  ) {}

  canActivate(): boolean {
    return this.portal.isAdmin();
  }
}
