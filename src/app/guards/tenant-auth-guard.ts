import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PortalService } from '../services/portal.service';

export const tenantAuthGuard: CanActivateFn = () => {
  const router = inject(Router);
  const portal = inject(PortalService);

  const token = localStorage.getItem('tenant_token');
  const hostnameSlug = portal.tenantSlug;
  const savedSlug = localStorage.getItem('tenant_slug');

  if (!token) {
    router.navigate(['/login']);
    return false;
  }

  if (hostnameSlug && savedSlug && hostnameSlug !== savedSlug) {
    router.navigate(['/login']);
    return false;
  }

  return true;
};
