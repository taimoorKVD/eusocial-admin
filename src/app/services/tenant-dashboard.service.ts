import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

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

export interface TenantDashboardData {
  overview: DashboardStatCard[];
  operational: DashboardStatCard[];
  inventory: DashboardStatCard[];
  recentActivity: DashboardActivityItem[];
  reportingGroups: DashboardReportingGroupSummary[];
}

/**
 * Static Restaurant / Kitchen Operations dashboard data for Phase 1.
 * Replace `getDashboardData` internals with an API call later — UI can stay the same.
 */
@Injectable({ providedIn: 'root' })
export class TenantDashboardService {
  getDashboardData(): Observable<TenantDashboardData> {
    return of(this.getStaticData());
  }

  private getStaticData(): TenantDashboardData {
    return {
      overview: [
        { key: 'users', label: 'Total Users', value: 48, hint: 'Active kitchen & floor staff' },
        { key: 'items', label: 'Total Items', value: 326, hint: 'Inventory catalog' },
        { key: 'vendors', label: 'Total Vendors', value: 27, hint: 'Suppliers & services' },
        { key: 'forms', label: 'Total Forms', value: 19, hint: 'Ops & compliance forms' },
      ],
      operational: [
        { key: 'assigned', label: 'Assigned Forms', value: 64 },
        { key: 'pending', label: 'Pending Forms', value: 18 },
        { key: 'completed', label: 'Completed Forms', value: 41 },
        { key: 'overdue', label: 'Overdue Forms', value: 5 },
      ],
      inventory: [
        { key: 'total-items', label: 'Total Items', value: 326 },
        { key: 'low-stock', label: 'Low Stock', value: 14 },
        { key: 'below-par', label: 'Below PAR', value: 9 },
        { key: 'order-required', label: 'Order Required', value: 7 },
      ],
      recentActivity: [
        {
          id: '1',
          title: 'Opening checklist completed',
          detail: 'Line cook submitted morning prep form',
          timeAgo: '12 minutes ago',
        },
        {
          id: '2',
          title: 'Low stock flagged',
          detail: 'Roma tomatoes fell below PAR level',
          timeAgo: '35 minutes ago',
        },
        {
          id: '3',
          title: 'Vendor updated',
          detail: 'Fresh Farm Produce delivery schedule changed',
          timeAgo: '1 hour ago',
        },
        {
          id: '4',
          title: 'Form assigned',
          detail: 'Temperature log assigned to evening shift',
          timeAgo: '2 hours ago',
        },
        {
          id: '5',
          title: 'New item added',
          detail: 'Chicken breast added to Meat category',
          timeAgo: '3 hours ago',
        },
      ],
      reportingGroups: [
        {
          id: 'demo-psi',
          name: 'Product Specific Items',
          categories: ['Produce', 'Meat', 'Dairy'],
          itemCount: 42,
        },
        {
          id: 'demo-general',
          name: 'General Items',
          categories: ['Cleaning Supply', 'Paper Product'],
          itemCount: 28,
        },
        {
          id: 'demo-services',
          name: 'Professional Services',
          categories: ['Plumbing', 'Electrician'],
          itemCount: 6,
        },
      ],
    };
  }
}
