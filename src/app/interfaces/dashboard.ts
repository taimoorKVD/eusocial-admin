export type DashboardAccountType = 'tenant_admin' | 'tenant_user';

export interface EmployeeWelcome {
  message: string;
  firstName: string;
  fullName: string;
  role: string;
}

export interface EmployeeStatValue {
  value: number;
  label: string;
}

export interface EmployeeStats {
  myAssignments: EmployeeStatValue;
  inProgress: EmployeeStatValue;
  completed: EmployeeStatValue;
  overdue: EmployeeStatValue;
}

export interface TodaysAssignment {
  id: string;
  title: string;
  category: string;
  dueAt: string | null;
  dueLabel: string;
  priority: string;
  status: string;
  templateId: string | null;
}

export type EmployeeActivityType =
  | 'submitted'
  | 'started'
  | 'assigned'
  | 'draft_saved';

export interface EmployeeRecentActivity {
  id: string;
  type: string;
  description: string;
  createdAt: string | null;
  relativeTime: string;
  assignmentId: string | null;
}

export interface EmployeeDashboardData {
  welcome: EmployeeWelcome;
  stats: EmployeeStats;
  todaysAssignments: TodaysAssignment[];
  recentActivity: EmployeeRecentActivity[];
}

export interface AdminOverviewLabels {
  totalUsers: string;
  totalItems: string;
  totalVendors: string;
  totalForms: string;
}

export interface AdminFormBreakdown {
  formBuilderForms: number;
  dataCollectionTemplates: number;
}

export interface AdminOverview {
  totalUsers: number;
  totalItems: number;
  totalVendors: number;
  totalForms: number;
  labels: AdminOverviewLabels;
  breakdown: AdminFormBreakdown;
}

export interface AdminInventory {
  totalItems: number;
  lowStock: number;
  belowPar: number;
  orderRequired: number;
  available: boolean;
}

export interface AdminDashboardUser {
  id: string;
  name: string;
  role: string;
}

export interface DashboardActivityItem {
  id: string;
  title: string;
  detail: string;
  timeAgo: string;
}

export interface DashboardReportingGroupSummary {
  id: string;
  name: string;
  categories: string[];
  itemCount: number;
}

export interface TenantAdminDashboardData {
  overview: AdminOverview;
  inventory: AdminInventory;
  recentActivity: DashboardActivityItem[];
  reportingGroups: DashboardReportingGroupSummary[];
  user: AdminDashboardUser;
}

export type NormalizedDashboard =
  | { accountType: 'tenant_user'; employee: EmployeeDashboardData }
  | { accountType: 'tenant_admin'; admin: TenantAdminDashboardData };
