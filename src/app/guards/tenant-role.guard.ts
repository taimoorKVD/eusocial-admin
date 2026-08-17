import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { TenantSessionService } from '../services/tenant-session.service';

function homeTree(session: TenantSessionService, router: Router): UrlTree {
  return router.createUrlTree(session.getHomeCommands());
}

/** Sends the authenticated tenant user to the role-appropriate dashboard. */
export const tenantHomeRedirectGuard: CanActivateFn = () => {
  const session = inject(TenantSessionService);
  const router = inject(Router);
  return homeTree(session, router);
};

/** Tenant Admin setup / dashboard routes. Employees are redirected home. */
export const tenantAdminGuard: CanActivateFn = () => {
  const session = inject(TenantSessionService);
  const router = inject(Router);

  if (session.isTenantAdmin()) {
    return true;
  }

  return homeTree(session, router);
};

/** Employee / staff operational routes. Tenant admins are redirected home. */
export const tenantEmployeeGuard: CanActivateFn = () => {
  const session = inject(TenantSessionService);
  const router = inject(Router);

  if (session.isEmployee()) {
    return true;
  }

  return homeTree(session, router);
};
