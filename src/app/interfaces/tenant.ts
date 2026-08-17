export interface TenantPlanRef {
  id?: number;
  name?: string;
  slug?: string;
}

export interface TenantCountryRef {
  id?: number;
  name?: string;
}

export interface TenantStateRef {
  id?: number;
  name?: string;
}

export interface Tenant {
  id: number;
  name: string;
  dbName?: string;
  db_name?: string;
  subdomain?: string;
  domain?: string;
  customDomain?: string | null;
  custom_domain?: string | null;
  email?: string | null;
  phoneCountryCode?: string | null;
  phone_country_code?: string | null;
  phoneNumber?: string | null;
  phone_number?: string | null;
  industry?: string | null;
  description?: string | null;
  countryId?: number | null;
  country_id?: number | null;
  country?: TenantCountryRef | string | null;
  stateId?: number | null;
  state_id?: number | null;
  state?: TenantStateRef | string | null;
  city?: string | null;
  address?: string | null;
  postalCode?: string | null;
  postal_code?: string | null;
  planId?: number | null;
  plan_id?: number | null;
  plan?: TenantPlanRef | string | null;
  billingCycle?: string | null;
  billing_cycle?: string | null;
  trialDays?: number | null;
  trial_days?: number | null;
  status?: string | null;
  users?: number | null;
  joinedOn?: string | null;
  joined_on?: string | null;
  createdAt?: string;
  created_at?: string;
}
