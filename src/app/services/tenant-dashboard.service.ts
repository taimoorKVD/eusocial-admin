import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  DashboardActivityItem,
  DashboardReportingGroupSummary,
  DashboardStatCard,
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

export type {
  DashboardActivityItem,
  DashboardReportingGroupSummary,
  DashboardStatCard,
  TenantAdminDashboardData as TenantDashboardData,
} from '../interfaces/dashboard';

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
    const overviewSource = data['overview'] ?? data;
    const inventorySource = data['inventory'] ?? data['inventoryOverview'] ?? {};
    const operationalSource = data['operational'] ?? data['operationalOverview'] ?? {};

    return {
      overview: this.normalizeStatCards(overviewSource, [
        {
          key: 'users',
          label: 'Total Users',
          hint: 'Active kitchen & floor staff',
          aliases: ['users', 'totalUsers', 'total_users'],
        },
        {
          key: 'items',
          label: 'Total Items',
          hint: 'Inventory catalog',
          aliases: ['items', 'totalItems', 'total_items'],
        },
        {
          key: 'vendors',
          label: 'Total Vendors',
          hint: 'Suppliers & services',
          aliases: ['vendors', 'totalVendors', 'total_vendors'],
        },
        {
          key: 'forms',
          label: 'Total Forms',
          hint: 'Ops & compliance forms',
          aliases: ['forms', 'totalForms', 'total_forms'],
        },
      ]),
      operational: this.normalizeStatCards(operationalSource, [
        {
          key: 'assigned',
          label: 'Assigned Forms',
          aliases: ['assigned', 'assignedForms', 'assigned_forms'],
        },
        {
          key: 'pending',
          label: 'Pending Forms',
          aliases: ['pending', 'pendingForms', 'pending_forms'],
        },
        {
          key: 'completed',
          label: 'Completed Forms',
          aliases: ['completed', 'completedForms', 'completed_forms'],
        },
        {
          key: 'overdue',
          label: 'Overdue Forms',
          aliases: ['overdue', 'overdueForms', 'overdue_forms'],
        },
      ]),
      inventory: this.normalizeStatCards(inventorySource, [
        {
          key: 'total-items',
          label: 'Total Items',
          aliases: ['total-items', 'totalItems', 'total_items', 'items'],
        },
        {
          key: 'low-stock',
          label: 'Low Stock',
          aliases: ['low-stock', 'lowStock', 'low_stock'],
        },
        {
          key: 'below-par',
          label: 'Below PAR',
          aliases: ['below-par', 'belowPar', 'below_par'],
        },
        {
          key: 'order-required',
          label: 'Order Required',
          aliases: ['order-required', 'orderRequired', 'order_required'],
        },
      ]),
      recentActivity: this.readArray(data['recentActivity'] ?? data['recent_activity']).map(
        (item, index) => this.normalizeAdminActivity(this.asRecord(item), index),
      ),
      reportingGroups: this.readArray(
        data['reportingGroups'] ?? data['reporting_groups'],
      ).map((item, index) => this.normalizeReportingGroup(this.asRecord(item), index)),
    };
  }

  private normalizeStatCards(
    source: unknown,
    defaults: Array<{ key: string; label: string; hint?: string; aliases: string[] }>,
  ): DashboardStatCard[] {
    if (Array.isArray(source)) {
      const cards = source.map((item, index) => {
        const record = this.asRecord(item);
        const key = this.readString(record['key']) || defaults[index]?.key || `card-${index}`;
        return {
          key,
          label: this.readString(record['label']) || defaults[index]?.label || key,
          value: this.toNumber(record['value'] ?? record['count'] ?? record['total']),
          hint: this.readString(record['hint']) || undefined,
        };
      });

      if (cards.length) {
        return cards;
      }
    }

    const record = this.asRecord(source);
    return defaults.map((item) => {
      const raw = this.findByAliases(record, item.aliases);
      if (typeof raw === 'number') {
        return {
          key: item.key,
          label: item.label,
          value: raw,
          hint: item.hint,
        };
      }

      const nested = this.asRecord(raw);
      return {
        key: item.key,
        label: this.readString(nested['label']) || item.label,
        value: this.toNumber(nested['value'] ?? nested['count'] ?? nested['total'] ?? raw),
        hint: this.readString(nested['hint']) || item.hint,
      };
    });
  }

  private normalizeAdminActivity(
    item: Record<string, unknown>,
    index: number,
  ): DashboardActivityItem {
    const title = this.readString(item['title']);
    const description = this.readString(item['description']);
    const detail = this.readString(item['detail'] ?? item['message']);
    const resolvedTitle = title || description || 'Activity';
    const resolvedDetail = [detail, title ? description : '']
      .find((value) => value && value !== resolvedTitle) ?? '';

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
    const categoriesRaw = item['categories'] ?? item['categoryNames'];
    const categories = Array.isArray(categoriesRaw)
      ? categoriesRaw.map((value) => this.readString(value)).filter(Boolean)
      : this.readString(categoriesRaw)
        ? [this.readString(categoriesRaw)]
        : [];

    return {
      id: this.readId(item, `group-${index}`),
      name: this.readString(item['name'] ?? item['title']) || 'Reporting group',
      categories,
      itemCount: this.toNumber(item['itemCount'] ?? item['item_count'] ?? item['items']),
    };
  }

  private findByAliases(record: Record<string, unknown>, aliases: string[]): unknown {
    for (const alias of aliases) {
      if (record[alias] !== undefined && record[alias] !== null) {
        return record[alias];
      }
    }
    return undefined;
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
