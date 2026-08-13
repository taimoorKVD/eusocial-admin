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

export interface DashboardStatCard {
  key: string;
  label: string;
  value: number;
  hint?: string;
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
  overview: DashboardStatCard[];
  operational: DashboardStatCard[];
  inventory: DashboardStatCard[];
  recentActivity: DashboardActivityItem[];
  reportingGroups: DashboardReportingGroupSummary[];
}

export type NormalizedDashboard =
  | { accountType: 'tenant_user'; employee: EmployeeDashboardData }
  | { accountType: 'tenant_admin'; admin: TenantAdminDashboardData };
