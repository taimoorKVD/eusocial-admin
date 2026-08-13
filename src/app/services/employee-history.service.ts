import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { EmployeeHistoryItem } from '../interfaces/employee-assignment';

/**
 * Static employee history data for Phase 2.
 * Replace `getHistory` internals with an API call later — UI can stay the same.
 */
@Injectable({ providedIn: 'root' })
export class EmployeeHistoryService {
  getHistory(): Observable<EmployeeHistoryItem[]> {
    return of(this.getStaticData());
  }

  private getStaticData(): EmployeeHistoryItem[] {
    return [
      {
        id: '1',
        title: 'Opening checklist',
        submittedAt: '2026-08-11T08:12:00.000Z',
        status: 'completed',
        detail: 'Submitted to kitchen manager',
      },
      {
        id: '2',
        title: 'Temperature log',
        submittedAt: '2026-08-10T14:40:00.000Z',
        status: 'completed',
        detail: 'Walk-in and line temps recorded',
      },
      {
        id: '3',
        title: 'Closing sanitation form',
        submittedAt: '2026-08-09T21:18:00.000Z',
        status: 'completed',
        detail: 'End-of-day sanitation completed',
      },
      {
        id: '4',
        title: 'Equipment inspection',
        submittedAt: '2026-08-08T16:05:00.000Z',
        status: 'completed',
        detail: 'Oven and fryer inspection submitted',
      },
    ];
  }
}
