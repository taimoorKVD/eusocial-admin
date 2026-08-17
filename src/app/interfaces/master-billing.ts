export type BillingCycle = 'monthly' | 'yearly';
export type PlanStatus = 'active' | 'inactive';
export type SubscriptionStatus =
  | 'active'
  | 'trial'
  | 'past_due'
  | 'cancelled'
  | 'incomplete'
  | 'unpaid';
export type InvoiceStatus = 'draft' | 'pending' | 'paid' | 'overdue' | 'cancelled' | 'failed';

export interface MoneyValue {
  amount: number;
  amountCents?: number;
  formatted: string;
  currency: string;
}

export interface PlanModuleCatalogItem {
  key: string;
  name: string;
  description?: string;
}

export interface PlanModuleState extends PlanModuleCatalogItem {
  enabled: boolean;
}

export interface MasterPlan {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  price: number;
  priceCents?: number;
  formattedPrice: string;
  currency: string;
  billingCycle: BillingCycle;
  usersLimit: number | null;
  storageGb?: number | null;
  storage?: string;
  supportLevel?: string | null;
  features: string[];
  allowedModules?: string[];
  modules?: PlanModuleState[];
  trialDays?: number | null;
  sortOrder?: number;
  status: PlanStatus;
  stripeProductId?: string | null;
  stripePriceId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface PlanWritePayload {
  name: string;
  slug?: string;
  description?: string;
  price: number;
  currency?: string;
  billingCycle: BillingCycle;
  usersLimit?: number | null;
  storageGb?: number | null;
  supportLevel?: string;
  features?: string[];
  modules?: string[];
  trialDays?: number | null;
  sortOrder?: number;
  status?: PlanStatus;
}

export interface SubscriptionTenant {
  id: number;
  name: string;
  subdomain?: string;
  domain?: string;
  status?: string;
}

export interface SubscriptionPlanRef {
  id: number;
  name: string;
  slug?: string;
}

export interface MasterSubscription {
  id: number;
  tenantId: number;
  tenant: SubscriptionTenant;
  planId: number;
  plan: SubscriptionPlanRef;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  amount: number;
  amountCents?: number;
  formattedAmount: string;
  currency: string;
  trialEndsAt?: string | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  nextBilling?: string | null;
  cancelAtPeriodEnd?: boolean;
  cancelledAt?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface SubscriptionStats {
  activeSubscriptions: number;
  mrr: MoneyValue;
  arr: MoneyValue;
  cancelledThisMonth: number;
  totalRevenue?: MoneyValue;
}

export interface InvoiceTenant {
  id: number;
  name: string;
  subdomain?: string;
}

export interface MasterInvoice {
  id: number;
  invoiceNumber: string;
  tenantId: number;
  tenant: InvoiceTenant;
  subscriptionId?: number | null;
  amount: number;
  amountCents?: number;
  formattedAmount: string;
  currency: string;
  status: InvoiceStatus;
  invoiceDate: string;
  dueDate?: string | null;
  paidAt?: string | null;
  hostedInvoiceUrl?: string | null;
  invoicePdfUrl?: string | null;
  stripeInvoiceId?: string | null;
  createdAt?: string;
}

export interface InvoiceStats {
  totalRevenue: MoneyValue;
  paidInvoices: number;
  pendingInvoices: number;
  overdueInvoices: number;
}

export interface ListMeta {
  total: number;
  page: number;
  lastPage: number;
}
