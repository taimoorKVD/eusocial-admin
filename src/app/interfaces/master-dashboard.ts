export type KpiChangeType = 'count' | 'percent';
export type HealthStatus = 'healthy' | 'degraded' | 'down' | 'unknown';

export interface DashboardKpi {
  value: number;
  change: number;
  changeType: KpiChangeType;
  changeLabel: string;
  trend: number[];
  available: boolean;
  currency?: 'EUR' | string;
}

export interface TenantsOverviewPoint {
  date: string;
  count: number;
}

export interface TenantsOverview {
  period: string;
  series: {
    newTenants: TenantsOverviewPoint[];
    activeTenants: TenantsOverviewPoint[];
  };
  summary: {
    newTenants: number;
    upgraded: number;
    downgraded: number;
    cancelled: number;
  };
}

export interface PlanSegment {
  key: string;
  name: string;
  count: number;
  percentage: number;
}

export interface PlanDistribution {
  available: boolean;
  total: number;
  segments: PlanSegment[];
}

export interface RecentTenant {
  id: number;
  name: string;
  domain: string;
  subdomain?: string;
  customDomain?: string | null;
  plan: string | null;
  status: string;
  users: number | null;
  joinedOn: string;
}

export interface SystemHealthItem {
  status: HealthStatus;
  label: string;
  available: boolean;
  usedPercent?: number | null;
  usedGb?: number | null;
  totalGb?: number | null;
  sentToday?: number;
  failedToday?: number;
  pending?: number;
  avgLatencyMs?: number;
}

export interface SystemHealth {
  database: SystemHealthItem;
  storage: SystemHealthItem;
  email: SystemHealthItem;
  api: SystemHealthItem;
}

export interface MasterDashboardData {
  kpis: {
    totalTenants: DashboardKpi;
    activeTenants: DashboardKpi;
    totalUsers: DashboardKpi;
    mrr: DashboardKpi;
    activeSubscriptions: DashboardKpi;
    platformRevenue: DashboardKpi;
  };
  tenantsOverview: TenantsOverview;
  planDistribution: PlanDistribution;
  recentTenants: RecentTenant[];
  systemHealth: SystemHealth;
}

export interface MasterDashboardResponse {
  success: boolean;
  user_type?: string;
  data: MasterDashboardData;
}

export interface MasterProfileRole {
  id: number;
  name: string;
}

export interface MasterProfile {
  id: number;
  name: string;
  first_name?: string;
  last_name?: string;
  email: string;
  role?: MasterProfileRole | string | null;
  user_type?: string;
  account_type?: string;
  created_at?: string;
  updated_at?: string;
}

export interface MasterProfileResponse {
  success: boolean;
  message?: string;
  user_type?: string;
  data: MasterProfile;
}
