import { Injectable, computed, inject, signal } from '@angular/core';
import { Permission } from '../interfaces/permission';
import { TenantSessionService } from './tenant-session.service';
import {
  canonicalizeModuleKey,
  flattenRolePermissions,
  moduleAllowanceKeys,
  normalizeAllowedModules,
} from '../shared/permissions/permission-normalizer';

/**
 * Centralized tenant RBAC checks from authenticated `user.role.permissions`.
 * Fail-closed: missing/empty permission data denies access.
 *
 * Also tracks plan-level `allowedModules` / `modules` when present on the
 * login payload. If that list is empty/missing, module allowance does not
 * block (role permissions remain the action source of truth).
 */
@Injectable({
  providedIn: 'root',
})
export class TenantPermissionService {
  private readonly session = inject(TenantSessionService);

  private readonly permissions = signal<Permission[]>([]);
  private readonly allowedModules = signal<string[]>([]);

  /** Fast lookup of permission names for frequent UI checks. */
  private readonly permissionNameSet = computed(() => {
    const names = new Set<string>();
    for (const permission of this.permissions()) {
      const name = this.normalize(permission?.name);
      if (name) {
        names.add(name);
      }
    }
    return names;
  });

  /** Module → set of permission names within that module. */
  private readonly permissionsByModule = computed(() => {
    const map = new Map<string, Set<string>>();
    for (const permission of this.permissions()) {
      const name = this.normalize(permission?.name);
      const module = canonicalizeModuleKey(permission?.module || '');
      if (!name) {
        continue;
      }
      if (!module) {
        continue;
      }
      let set = map.get(module);
      if (!set) {
        set = new Set<string>();
        map.set(module, set);
      }
      set.add(name);
    }
    return map;
  });

  readonly permissionList = computed(() => this.permissions());
  readonly allowedModuleList = computed(() => this.allowedModules());

  constructor() {
    this.syncFromUser(this.session.getUser());
    this.session.user$.subscribe((user) => this.syncFromUser(user));
  }

  setPermissions(permissions: Permission[] | null | undefined): void {
    this.permissions.set(
      Array.isArray(permissions) ? flattenRolePermissions(permissions) : [],
    );
  }

  setAllowedModules(modules: string[] | null | undefined): void {
    this.allowedModules.set(Array.isArray(modules) ? modules : []);
  }

  clearPermissions(): void {
    this.permissions.set([]);
    this.allowedModules.set([]);
  }

  /** Sync from a full authenticated user / login payload object. */
  syncFromUser(user: unknown): void {
    this.setPermissions(this.extractRolePermissions(user));
    this.setAllowedModules(this.extractAllowedModules(user));
  }

  hasPermission(module: string, name: string): boolean {
    const moduleKey = canonicalizeModuleKey(module);
    const permissionName = this.normalize(name);
    if (!moduleKey || !permissionName) {
      return false;
    }

    const inModule = this.permissionsByModule().get(moduleKey);
    if (inModule?.has(permissionName)) {
      return true;
    }

    // Ambiguous "form" module spans form-builder + data-collection.
    if (moduleKey === 'form' || moduleKey === 'forms') {
      return (
        !!this.permissionsByModule().get('form-builder')?.has(permissionName) ||
        !!this.permissionsByModule().get('data-collection')?.has(permissionName) ||
        this.permissionNameSet().has(permissionName)
      );
    }

    // Form Template / Task expand into data-collection permission names.
    if (moduleKey === 'form-template' || moduleKey === 'task') {
      if (this.permissionsByModule().get('data-collection')?.has(permissionName)) {
        return true;
      }
    }

    // If module metadata is missing on stored permissions, fall back to name-only.
    if (!this.permissionsByModule().size) {
      return this.permissionNameSet().has(permissionName);
    }

    return false;
  }

  hasPermissionName(name: string): boolean {
    const permissionName = this.normalize(name);
    return !!permissionName && this.permissionNameSet().has(permissionName);
  }

  hasAnyPermission(...names: string[]): boolean {
    return names.some((name) => this.hasPermissionName(name));
  }

  hasAllPermissions(...names: string[]): boolean {
    return names.length > 0 && names.every((name) => this.hasPermissionName(name));
  }

  hasModuleAccess(module: string): boolean {
    if (!this.isModuleAllowedByPlan(module)) {
      return false;
    }

    const moduleKey = canonicalizeModuleKey(module);
    if (!moduleKey) {
      return false;
    }

    if (moduleKey === 'form' || moduleKey === 'forms') {
      return (
        this.hasModulePermissionEntries('form-builder') ||
        this.hasModulePermissionEntries('data-collection') ||
        this.hasAnyPermission(
          'view-form',
          'create-form',
          'edit-form',
          'delete-form',
          'view-dc-template',
          'create-dc-template',
          'edit-dc-template',
          'delete-dc-template',
          'view-dc-assignment',
          'complete-dc-assignment',
          'view-dc-submission',
          'review-dc-submission',
        )
      );
    }

    if (moduleKey === 'form-template') {
      return this.hasAnyPermission(
        'view-dc-template',
        'create-dc-template',
        'edit-dc-template',
        'delete-dc-template',
        'activate-dc-template',
        'archive-dc-template',
      );
    }

    if (moduleKey === 'task') {
      return this.hasAnyPermission(
        'view-dc-assignment',
        'complete-dc-assignment',
        'view-dc-submission',
        'review-dc-submission',
      );
    }

    if (this.hasModulePermissionEntries(moduleKey)) {
      return true;
    }

    // Name-only fallback when module metadata was absent on permissions.
    return this.permissionList().some((permission) => {
      const name = this.normalize(permission.name);
      if (!name) {
        return false;
      }
      if (permission.module) {
        return canonicalizeModuleKey(permission.module) === moduleKey;
      }
      return name.includes(moduleKey.replace(/s$/, '')) || name.endsWith(`-${moduleKey}`);
    });
  }

  /**
   * Plan/catalog module gate from `allowedModules` / `modules`.
   * Missing/empty list → do not block (role permissions still apply).
   */
  isModuleAllowedByPlan(module: string): boolean {
    const allowed = this.allowedModules();
    if (!allowed.length) {
      return true;
    }
    const keys = moduleAllowanceKeys(module);
    return keys.some((key) => allowed.includes(key));
  }

  private hasModulePermissionEntries(moduleKey: string): boolean {
    const set = this.permissionsByModule().get(moduleKey);
    return !!set && set.size > 0;
  }

  private extractRolePermissions(user: unknown): Permission[] {
    if (!user || typeof user !== 'object') {
      return [];
    }

    const record = user as Record<string, unknown>;
    const role = record['role'];
    if (role && typeof role === 'object') {
      const permissions = (role as { permissions?: unknown }).permissions;
      const flattened = flattenRolePermissions(permissions);
      if (flattened.length) {
        return flattened;
      }
    }

    // Rare fallbacks if backend nests permissions differently on the user.
    const direct = flattenRolePermissions(record['permissions']);
    if (direct.length) {
      return direct;
    }

    const jobPosition = record['job_position'] ?? record['jobPosition'];
    if (jobPosition && typeof jobPosition === 'object') {
      return flattenRolePermissions(
        (jobPosition as { permissions?: unknown }).permissions,
      );
    }

    return [];
  }

  private extractAllowedModules(user: unknown): string[] {
    if (!user || typeof user !== 'object') {
      return [];
    }
    const record = user as Record<string, unknown>;
    const fromAllowed = normalizeAllowedModules(
      record['allowedModules'] ?? record['allowed_modules'],
    );
    if (fromAllowed.length) {
      return fromAllowed;
    }
    return normalizeAllowedModules(record['modules']);
  }

  private normalize(value: unknown): string {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
  }
}
