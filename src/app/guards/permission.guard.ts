import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { TenantPermissionService } from '../services/tenant-permission.service';
import { TenantSessionService } from '../services/tenant-session.service';

/**
 * Route data:
 * - `permission`: string | string[] — user must have ALL listed permission names
 * - `anyPermission`: string[] — user must have at least one
 *
 * Fail-closed when no permission metadata is configured on the route.
 */
export const permissionGuard: CanActivateFn = (route): boolean | UrlTree => {
  const permissions = inject(TenantPermissionService);
  const session = inject(TenantSessionService);
  const router = inject(Router);

  const required = route.data['permission'] as string | string[] | undefined;
  const anyRequired = route.data['anyPermission'] as string[] | undefined;

  const allowed = evaluateAccess(permissions, required, anyRequired);
  if (allowed) {
    return true;
  }

  return router.createUrlTree(session.getHomeCommands());
};

function evaluateAccess(
  service: TenantPermissionService,
  required: string | string[] | undefined,
  anyRequired: string[] | undefined,
): boolean {
  if (Array.isArray(anyRequired) && anyRequired.length > 0) {
    return service.hasAnyPermission(...anyRequired);
  }

  if (typeof required === 'string' && required.trim()) {
    return service.hasPermissionName(required);
  }

  if (Array.isArray(required) && required.length > 0) {
    return service.hasAllPermissions(...required);
  }

  // No permission metadata → deny (fail closed for guarded routes).
  return false;
}
