/**
 * Tenant admin profile shape based on login `user` plus optional local overrides.
 * Only fields that already appear (or safely extend) the auth user are supported.
 */
export interface TenantProfile {
  id?: number | string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  username?: string;
  avatarUrl?: string;
  /** IANA timezone name, e.g. `Asia/Karachi`. */
  timezone?: string;
  role?: string | { id?: number | string; name?: string };
  accountType?: string;
  [key: string]: unknown;
}

/** Timezone option from GET /api/timezones. */
export interface TenantTimezoneOption {
  id: number | string;
  name: string;
  label: string;
  region?: string;
  utcOffsetMinutes?: number;
}
