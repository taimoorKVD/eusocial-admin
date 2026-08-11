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
  role?: string | { id?: number | string; name?: string };
  accountType?: string;
  [key: string]: unknown;
}
