import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { EmployeeDashboardData } from '../interfaces/employee-assignment';

/**
 * Static employee dashboard data for Phase 2.
 * Replace `getDashboardData` internals with an API call later — UI can stay the same.
 */
@Injectable({ providedIn: 'root' })
export class EmployeeDashboardService {
  getDashboardData(): Observable<EmployeeDashboardData> {
    return of(this.getStaticData());
  }

  private getStaticData(): EmployeeDashboardData {
    return {
      stats: [
        { key: 'today', label: "Today's Tasks", value: 4, hint: 'Assigned for today' },
        { key: 'pending', label: 'Pending Tasks', value: 6, hint: 'Waiting to start' },
        { key: 'in-progress', label: 'In Progress', value: 2, hint: 'Currently open' },
        { key: 'completed', label: 'Completed Tasks', value: 11, hint: 'Submitted this week' },
      ],
      upcoming: [
        {
          id: '1',
          title: 'Opening checklist',
          when: 'Today · 8:00 AM',
          status: 'pending',
        },
        {
          id: '2',
          title: 'Temperature log',
          when: 'Today · 2:00 PM',
          status: 'in_progress',
        },
        {
          id: '3',
          title: 'Closing sanitation form',
          when: 'Tomorrow · 9:00 PM',
          status: 'pending',
        },
      ],
      recentActivity: [
        {
          id: '1',
          title: 'Prep checklist submitted',
          detail: 'Morning kitchen prep form was completed',
          timeAgo: '18 minutes ago',
        },
        {
          id: '2',
          title: 'Assignment started',
          detail: 'Temperature log marked in progress',
          timeAgo: '1 hour ago',
        },
        {
          id: '3',
          title: 'New form assigned',
          detail: 'Closing sanitation form assigned to you',
          timeAgo: '3 hours ago',
        },
      ],
    };
  }
}
