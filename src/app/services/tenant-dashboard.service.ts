import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  DashboardActivityItem,
  DashboardReportingGroupSummary,
  EmployeeDashboardData,
  EmployeeRecentActivity,
  EmployeeStatValue,
  EmployeeStats,
  EmployeeWelcome,
  NormalizedDashboard,
  TenantAdminDashboardData,
  TodaysAssignment,
} from '../interfaces/dashboard';
import { TenantSessionService } from './tenant-session.service';

@Injectable({ providedIn: 'root' })
export class TenantDashboardService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(TenantSessionService);
  private readonly apiUrl = `${environment.tenantApiUrl}/dashboard`;

  getDashboardData(): Observable<NormalizedDashboard> {
    return this.http.get<unknown>(this.apiUrl).pipe(
      map((response) => {
        const root = this.asRecord(response);
        if (root['success'] === false) {
          throw new Error(this.readString(root['message']) || 'Unable to load dashboard.');
        }
        return this.normalize(response);
      }),
    );
  }

  private normalize(response: unknown): NormalizedDashboard {
    const root = this.asRecord(response);
    const data = this.asRecord(root['data'] ?? root);
    const accountType = this.readString(
      root['account_type'] ??
        root['accountType'] ??
        data['account_type'] ??
        data['accountType'] ??
        this.session.getAccountType(),
    ).toLowerCase();

    if (accountType === 'tenant_user' || (!accountType && this.looksLikeEmployee(data))) {
      return {
        accountType: 'tenant_user',
        employee: this.normalizeEmployee(data),
      };
    }

    return {
      accountType: 'tenant_admin',
      admin: this.normalizeAdmin(data),
    };
  }

  private looksLikeEmployee(data: Record<string, unknown>): boolean {
    if (this.isObject(data['welcome']) || Array.isArray(data['todaysAssignments'])) {
      return true;
    }

    const stats = this.asRecord(data['stats']);
    return 'myAssignments' in stats || 'my_assignments' in stats;
  }

  private normalizeEmployee(data: Record<string, unknown>): EmployeeDashboardData {
    const welcome = this.asRecord(data['welcome']);
    const stats = this.asRecord(data['stats']);

    return {
      welcome: this.normalizeWelcome(welcome, data),
      stats: this.normalizeEmployeeStats(stats),
      todaysAssignments: this.readArray(
        data['todaysAssignments'] ?? data['todays_assignments'],
      ).map((item, index) => this.normalizeTodaysAssignment(this.asRecord(item), index)),
      recentActivity: this.readArray(data['recentActivity'] ?? data['recent_activity']).map(
        (item, index) => this.normalizeEmployeeActivity(this.asRecord(item), index),
      ),
    };
  }

  private normalizeWelcome(
    welcome: Record<string, unknown>,
    data: Record<string, unknown>,
  ): EmployeeWelcome {
    return {
      message: this.readString(welcome['message'] ?? data['message']),
      firstName: this.readString(welcome['firstName'] ?? welcome['first_name']),
      fullName: this.readString(welcome['fullName'] ?? welcome['full_name'] ?? welcome['name']),
      role: this.readString(welcome['role']),
    };
  }

  private normalizeEmployeeStats(stats: Record<string, unknown>): EmployeeStats {
    return {
      myAssignments: this.readStatValue(
        stats['myAssignments'] ?? stats['my_assignments'],
        'Total assigned',
      ),
      inProgress: this.readStatValue(
        stats['inProgress'] ?? stats['in_progress'],
        'Currently in progress',
      ),
      completed: this.readStatValue(stats['completed'], 'This month'),
      overdue: this.readStatValue(stats['overdue'], 'Needs attention'),
    };
  }

  private readStatValue(raw: unknown, fallbackLabel: string): EmployeeStatValue {
    if (typeof raw === 'number') {
      return { value: raw, label: fallbackLabel };
    }

    const record = this.asRecord(raw);
    return {
      value: this.toNumber(record['value'] ?? record['count'] ?? record['total']),
      label: this.readString(record['label']) || fallbackLabel,
    };
  }

  private normalizeTodaysAssignment(
    item: Record<string, unknown>,
    index: number,
  ): TodaysAssignment {
    return {
      id: this.readId(item, `assignment-${index}`),
      title: this.readString(item['title'] ?? item['name']) || 'Untitled assignment',
      category: this.readString(item['category']),
      dueAt: this.readString(item['dueAt'] ?? item['due_at']) || null,
      dueLabel: this.readString(item['dueLabel'] ?? item['due_label']),
      priority: this.readString(item['priority']).toLowerCase(),
      status: this.readString(item['status']).toLowerCase() || 'pending',
      templateId: this.readNullableId(item['templateId'] ?? item['template_id']),
    };
  }

  private normalizeEmployeeActivity(
    item: Record<string, unknown>,
    index: number,
  ): EmployeeRecentActivity {
    return {
      id: this.readId(item, `activity-${index}`),
      type: this.readString(item['type']).toLowerCase() || 'assigned',
      description: this.readString(item['description'] ?? item['title'] ?? item['detail']),
      createdAt: this.readString(item['createdAt'] ?? item['created_at']) || null,
      relativeTime: this.readString(
        item['relativeTime'] ?? item['relative_time'] ?? item['timeAgo'] ?? item['time_ago'],
      ),
      assignmentId: this.readNullableId(item['assignmentId'] ?? item['assignment_id']),
    };
  }

  private normalizeAdmin(data: Record<string, unknown>): TenantAdminDashboardData {
    const overview = this.asRecord(data['overview']);
    const labels = this.asRecord(overview['labels']);
    const breakdown = this.asRecord(overview['breakdown']);
    const inventory = this.asRecord(data['inventory']);
    const user = this.asRecord(data['user']);

    return {
      overview: {
        totalUsers: this.toNumber(overview['totalUsers'] ?? overview['total_users']),
        totalItems: this.toNumber(overview['totalItems'] ?? overview['total_items']),
        totalVendors: this.toNumber(overview['totalVendors'] ?? overview['total_vendors']),
        totalForms: this.toNumber(overview['totalForms'] ?? overview['total_forms']),
        labels: {
          totalUsers: this.readString(labels['totalUsers'] ?? labels['total_users']),
          totalItems: this.readString(labels['totalItems'] ?? labels['total_items']),
          totalVendors: this.readString(labels['totalVendors'] ?? labels['total_vendors']),
          totalForms: this.readString(labels['totalForms'] ?? labels['total_forms']),
        },
        breakdown: {
          formBuilderForms: this.toNumber(
            breakdown['formBuilderForms'] ?? breakdown['form_builder_forms'],
          ),
          dataCollectionTemplates: this.toNumber(
            breakdown['dataCollectionTemplates'] ?? breakdown['data_collection_templates'],
          ),
        },
      },
      inventory: {
        totalItems: this.toNumber(inventory['totalItems'] ?? inventory['total_items']),
        lowStock: this.toNumber(inventory['lowStock'] ?? inventory['low_stock']),
        belowPar: this.toNumber(inventory['belowPar'] ?? inventory['below_par']),
        orderRequired: this.toNumber(
          inventory['orderRequired'] ?? inventory['order_required'],
        ),
        available: inventory['available'] !== false,
      },
      recentActivity: this.readArray(data['recentActivity'] ?? data['recent_activity']).map(
        (item, index) => this.normalizeAdminActivity(this.asRecord(item), index),
      ),
      reportingGroups: this.readArray(
        data['reportingGroups'] ?? data['reporting_groups'],
      ).map((item, index) => this.normalizeReportingGroup(this.asRecord(item), index)),
      user: {
        id: this.readId(user, ''),
        name: this.readString(user['name']),
        role: this.readString(user['role']),
      },
    };
  }

  private normalizeAdminActivity(
    item: Record<string, unknown>,
    index: number,
  ): DashboardActivityItem {
    const title = this.readString(item['title']);
    const description = this.readString(item['description']);
    const detail = this.readString(item['detail'] ?? item['message']);
    const resolvedTitle = title || description || 'Activity';
    const resolvedDetail =
      [detail, title ? description : ''].find((value) => value && value !== resolvedTitle) ?? '';

    return {
      id: this.readId(item, `activity-${index}`),
      title: resolvedTitle,
      detail: resolvedDetail,
      timeAgo: this.readString(
        item['timeAgo'] ?? item['time_ago'] ?? item['relativeTime'] ?? item['relative_time'],
      ),
    };
  }

  private normalizeReportingGroup(
    item: Record<string, unknown>,
    index: number,
  ): DashboardReportingGroupSummary {
    return {
      id: this.readId(item, `group-${index}`),
      name: this.readString(item['name'] ?? item['title']) || 'Reporting group',
      categories: this.normalizeReportingGroupCategories(item),
      itemCount: this.toNumber(item['itemCount'] ?? item['item_count'] ?? item['items']),
    };
  }

  /** Prefer `categoryNames` strings; otherwise pull `name` from category objects. */
  private normalizeReportingGroupCategories(item: Record<string, unknown>): string[] {
    const fromNames = this.readArray(item['categoryNames'] ?? item['category_names'])
      .map((value) => this.readString(value))
      .filter(Boolean);

    if (fromNames.length) {
      return fromNames;
    }

    return this.readArray(item['categories'])
      .map((value) => {
        if (typeof value === 'string' || typeof value === 'number') {
          return this.readString(value);
        }
        const record = this.asRecord(value);
        return this.readString(record['name'] ?? record['categoryName'] ?? record['title']);
      })
      .filter(Boolean);
  }

  private readArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }

  private readId(item: Record<string, unknown>, fallback: string): string {
    const value = item['id'] ?? item['_id'];
    return value == null || value === '' ? fallback : String(value);
  }

  private readNullableId(value: unknown): string | null {
    if (value == null || value === '') {
      return null;
    }
    return String(value);
  }

  private readString(value: unknown): string {
    if (value == null) {
      return '';
    }
    return String(value).trim();
  }

  private toNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return this.isObject(value) ? value : {};
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }
}
