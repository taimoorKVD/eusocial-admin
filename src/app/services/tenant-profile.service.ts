import { Injectable, inject, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { TenantProfile } from '../interfaces/tenant-profile';
import { TenantSessionService } from './tenant-session.service';

export type TenantProfileUpdate = Partial<
  Pick<
    TenantProfile,
    'firstName' | 'lastName' | 'name' | 'phone' | 'avatarUrl' | 'username'
  >
>;

/**
 * Tenant admin profile access for Phase 1 (localStorage).
 * Later: replace persist/load with Update Profile API — page can stay the same.
 */
@Injectable({ providedIn: 'root' })
export class TenantProfileService {
  private readonly session = inject(TenantSessionService);
  private readonly STORAGE_PREFIX = 'tenant_profile_overrides';

  private readonly profileSignal = signal<TenantProfile | null>(this.buildProfile());

  readonly profile = this.profileSignal.asReadonly();

  getProfile(): TenantProfile | null {
    return this.profileSignal();
  }

  getProfile$(): Observable<TenantProfile | null> {
    return of(this.getProfile());
  }

  /** Reload from session + overrides (e.g. after login). */
  refresh(): void {
    this.profileSignal.set(this.buildProfile());
  }

  updateProfile(update: TenantProfileUpdate): TenantProfile {
    const current = this.buildProfile();
    if (!current) {
      throw new Error('No authenticated user profile available');
    }

    const firstName = this.clean(update.firstName ?? current.firstName);
    const lastName = this.clean(update.lastName ?? current.lastName);
    const phone = this.clean(update.phone ?? current.phone);
    const avatarUrl = this.clean(update.avatarUrl ?? current.avatarUrl);
    const username = this.clean(update.username ?? current.username);

    const nameFromParts = [firstName, lastName].filter(Boolean).join(' ').trim();
    const name =
      this.clean(update.name) ||
      nameFromParts ||
      this.clean(current.name) ||
      '';

    const overrides: TenantProfileUpdate = {
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      name: name || undefined,
      phone: phone || undefined,
      avatarUrl: avatarUrl || undefined,
      username: username || undefined,
    };

    this.saveOverrides(overrides);

    const sessionPatch: Record<string, unknown> = {
      name,
      phone: phone || undefined,
      username: username || undefined,
      avatarUrl: avatarUrl || undefined,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      first_name: firstName || undefined,
      last_name: lastName || undefined,
    };

    this.session.updateUser(sessionPatch);

    const next = this.buildProfile();
    this.profileSignal.set(next);
    return next!;
  }

  getDisplayName(profile: TenantProfile | null = this.profileSignal()): string {
    if (!profile) {
      return 'Tenant User';
    }

    const fromParts = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim();
    return (
      fromParts ||
      profile.name ||
      profile.username ||
      profile.email ||
      this.session.getSlug() ||
      'Tenant User'
    );
  }

  getRoleLabel(profile: TenantProfile | null = this.profileSignal()): string {
    if (!profile) {
      return 'Tenant Admin';
    }

    if (typeof profile.role === 'string' && profile.role.trim()) {
      return profile.role;
    }

    if (profile.role && typeof profile.role === 'object' && profile.role.name) {
      return String(profile.role.name);
    }

    if (profile.accountType) {
      return String(profile.accountType);
    }

    return 'Tenant Admin';
  }

  private buildProfile(): TenantProfile | null {
    const user = this.session.getUser();
    if (!user || typeof user !== 'object') {
      return null;
    }

    const overrides = this.loadOverrides();
    const base = user as TenantProfile;

    const firstName =
      this.clean(overrides.firstName) ||
      this.clean(base.firstName) ||
      this.clean(base['first_name'] as string) ||
      this.splitName(base.name).firstName;

    const lastName =
      this.clean(overrides.lastName) ||
      this.clean(base.lastName) ||
      this.clean(base['last_name'] as string) ||
      this.splitName(base.name).lastName;

    const name =
      this.clean(overrides.name) ||
      [firstName, lastName].filter(Boolean).join(' ').trim() ||
      this.clean(base.name) ||
      '';

    return {
      ...base,
      ...overrides,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      name: name || undefined,
      email: this.clean(base.email) || undefined,
      phone:
        this.clean(overrides.phone) ||
        this.clean(base.phone) ||
        this.clean(base['phoneNumber'] as string) ||
        this.clean(base['phone_number'] as string) ||
        undefined,
      username:
        this.clean(overrides.username) ||
        this.clean(base.username) ||
        this.clean(base['userName'] as string) ||
        undefined,
      avatarUrl:
        this.clean(overrides.avatarUrl) ||
        this.clean(base.avatarUrl) ||
        this.clean(base['avatar'] as string) ||
        this.clean(base['profileImage'] as string) ||
        this.clean(base['profile_image'] as string) ||
        undefined,
      role: base.role,
      accountType: this.clean(base.accountType as string) || undefined,
    };
  }

  private loadOverrides(): TenantProfileUpdate {
    try {
      const raw = localStorage.getItem(this.storageKey());
      if (!raw) {
        return {};
      }
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  private saveOverrides(overrides: TenantProfileUpdate): void {
    try {
      localStorage.setItem(this.storageKey(), JSON.stringify(overrides));
    } catch {
      // ignore storage failures
    }
  }

  private storageKey(): string {
    const slug = this.session.getSlug() || 'default';
    const user = this.session.getUser();
    const userKey = user?.id ?? user?.email ?? 'user';
    return `${this.STORAGE_PREFIX}_${slug}_${userKey}`;
  }

  private splitName(name?: string): { firstName?: string; lastName?: string } {
    const trimmed = this.clean(name);
    if (!trimmed) {
      return {};
    }
    const parts = trimmed.split(/\s+/);
    if (parts.length === 1) {
      return { firstName: parts[0] };
    }
    return {
      firstName: parts[0],
      lastName: parts.slice(1).join(' '),
    };
  }

  private clean(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }
}
