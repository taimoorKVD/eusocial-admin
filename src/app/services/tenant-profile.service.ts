import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, map, of, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { TenantProfile, TenantTimezoneOption } from '../interfaces/tenant-profile';
import { TenantSessionService } from './tenant-session.service';

export type TenantProfileUpdate = Partial<
  Pick<
    TenantProfile,
    'firstName' | 'lastName' | 'name' | 'phone' | 'avatarUrl' | 'username' | 'timezone'
  >
>;

/**
 * Tenant admin profile access. Profile updates are persisted through the
 * backend API; the session/user cache is only kept in sync with the response.
 */
@Injectable({ providedIn: 'root' })
export class TenantProfileService {
  private readonly session = inject(TenantSessionService);
  private readonly http = inject(HttpClient);
  private readonly STORAGE_PREFIX = 'tenant_profile_overrides';
  private readonly apiUrl = environment.tenantApiUrl;

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

  /** GET /api/timezones — options for the profile timezone dropdown. */
  getTimezones(): Observable<TenantTimezoneOption[]> {
    return this.http.get<unknown>(`${this.apiUrl}/timezones`).pipe(
      map((response) => this.mapTimezoneOptions(response)),
    );
  }

  /**
   * Persists the editable profile fields through the backend API
   * (PUT /users/profile). Emits the refreshed profile once the backend
   * confirms the update.
   */
  updateProfile(update: TenantProfileUpdate): Observable<TenantProfile> {
    const current = this.buildProfile();
    if (!current) {
      return throwError(() => new Error('No authenticated user profile available'));
    }

    const firstName = this.clean(update.firstName ?? current.firstName);
    const lastName = this.clean(update.lastName ?? current.lastName);
    const phone = this.clean(update.phone ?? current.phone);
    const timezone = this.clean(update.timezone ?? current.timezone);

    const payload: Record<string, string> = {
      first_name: firstName,
      last_name: lastName,
      phone: phone,
      timezone: timezone,
    };

    return this.http
      .put<unknown>(`${this.apiUrl}/users/profile`, payload)
      .pipe(
        map((response) =>
          this.applyProfileResponse(response, { firstName, lastName, phone, timezone }),
        ),
      );
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
      const accountType = String(profile.accountType).toLowerCase();
      if (accountType === 'tenant_user') {
        return 'Staff';
      }
      if (accountType === 'tenant_admin') {
        return 'Tenant Admin';
      }
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
      timezone:
        this.clean(overrides.timezone) ||
        this.clean(base.timezone) ||
        this.clean(base['time_zone'] as string) ||
        this.clean(base['timeZone'] as string) ||
        undefined,
      role: base.role,
      accountType:
        this.clean(base.accountType as string) ||
        this.clean(base['account_type'] as string) ||
        undefined,
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

  /** Drops legacy localStorage overrides after a successful API update. */
  private clearOverrides(): void {
    try {
      localStorage.removeItem(this.storageKey());
    } catch {
      // ignore storage failures
    }
  }

  /**
   * Applies the backend response to the session/user cache so the UI reflects
   * the updated profile. Falls back to the submitted values when the response
   * does not include a field.
   */
  private applyProfileResponse(
    response: unknown,
    submitted: { firstName: string; lastName: string; phone: string; timezone: string },
  ): TenantProfile {
    const record = response && typeof response === 'object'
      ? (response as Record<string, unknown>)
      : {};

    const data = record['data'] && typeof record['data'] === 'object'
      ? record['data'] as Record<string, unknown>
      : record;

    const firstName = this.clean(
      data['first_name'] ?? data['firstName'] ?? submitted.firstName,
    );
    const lastName = this.clean(
      data['last_name'] ?? data['lastName'] ?? submitted.lastName,
    );
    const phone = this.clean(
      data['phone'] ?? data['phoneNumber'] ?? data['phone_number'] ?? submitted.phone,
    );
    const timezone = this.clean(
      data['timezone'] ?? data['time_zone'] ?? data['timeZone'] ?? submitted.timezone,
    );
    const name =
      this.clean(data['name']) ||
      [firstName, lastName].filter(Boolean).join(' ').trim();

    this.session.updateUser({
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      first_name: firstName || undefined,
      last_name: lastName || undefined,
      name: name || undefined,
      phone: phone || undefined,
      timezone: timezone || undefined,
    });

    this.clearOverrides();
    this.refresh();

    const next = this.getProfile();
    if (!next) {
      throw new Error('No authenticated user profile available');
    }
    return next;
  }

  private mapTimezoneOptions(response: unknown): TenantTimezoneOption[] {
    const list = this.unwrapList(response);
    return list
      .map((item): TenantTimezoneOption | null => {
        if (!item || typeof item !== 'object') {
          return null;
        }
        const row = item as Record<string, unknown>;
        const name = this.clean(row['name']);
        if (!name) {
          return null;
        }
        const label = this.clean(row['label']) || name;
        const region = this.clean(row['region']) || undefined;
        const utcOffsetMinutes =
          typeof row['utcOffsetMinutes'] === 'number'
            ? row['utcOffsetMinutes']
            : typeof row['utc_offset_minutes'] === 'number'
              ? row['utc_offset_minutes']
              : undefined;

        return {
          id: (row['id'] as number | string) ?? name,
          name,
          label,
          ...(region ? { region } : {}),
          ...(utcOffsetMinutes !== undefined ? { utcOffsetMinutes } : {}),
        };
      })
      .filter((item): item is TenantTimezoneOption => item !== null);
  }

  private unwrapList(response: unknown): unknown[] {
    if (Array.isArray(response)) {
      return response;
    }
    if (!response || typeof response !== 'object') {
      return [];
    }
    const record = response as Record<string, unknown>;
    if (Array.isArray(record['data'])) {
      return record['data'];
    }
    if (
      record['data'] &&
      typeof record['data'] === 'object' &&
      Array.isArray((record['data'] as Record<string, unknown>)['data'])
    ) {
      return (record['data'] as Record<string, unknown>)['data'] as unknown[];
    }
    return [];
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
