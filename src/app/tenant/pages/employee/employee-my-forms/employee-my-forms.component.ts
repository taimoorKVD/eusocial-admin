import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { SharedModule } from '../../../../shared/shared.module';
import { EmployeeAssignmentsService } from '../../../../services/employee-assignments.service';
import {
  EmployeeAssignmentListItem,
  EmployeeAssignmentStatus,
} from '../../../../interfaces/employee-assignment';
import { TenantPermissionService } from '../../../../services/tenant-permission.service';
import { PERMISSIONS } from '../../../../constants/permissions';

/** Listing filter values — includes API filter `today` (not an assignment status). */
type MyFormsStatusFilter = EmployeeAssignmentStatus | 'today' | '';

interface StatusFilter {
  label: string;
  value: MyFormsStatusFilter;
}

@Component({
  selector: 'app-employee-my-forms',
  standalone: true,
  imports: [CommonModule, SharedModule],
  templateUrl: './employee-my-forms.component.html',
})
export class EmployeeMyFormsComponent implements OnInit {
  private readonly assignmentsService = inject(EmployeeAssignmentsService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly permissionService = inject(TenantPermissionService);

  readonly canCompleteAssignment = this.permissionService.hasPermissionName(
    PERMISSIONS.DATA_COLLECTION.COMPLETE_ASSIGNMENT,
  );
  readonly canViewSubmission = this.permissionService.hasPermissionName(
    PERMISSIONS.DATA_COLLECTION.VIEW_SUBMISSION,
  );

  readonly filters: StatusFilter[] = [
    { label: 'All', value: '' },
    { label: 'Today', value: 'today' },
    { label: 'Pending', value: 'pending' },
    { label: 'In Progress', value: 'in_progress' },
    { label: 'Completed', value: 'completed' },
    { label: 'Overdue', value: 'overdue' },
    { label: 'Cancelled', value: 'cancelled' },
  ];

  readonly assignments = signal<EmployeeAssignmentListItem[]>([]);
  readonly loading = signal(false);
  readonly errorMessage = signal('');
  readonly page = signal(1);
  readonly lastPage = signal(1);
  readonly total = signal(0);
  /** Defaults to Today — backend returns today's tasks via `status=today`. */
  readonly status = signal<MyFormsStatusFilter>('today');
  /** Optional `Y-m-d` due-date query param. */
  readonly dueDateFilter = signal<string | null>(null);
  readonly filtersOpen = signal(false);

  readonly hasAssignments = computed(() => this.assignments().length > 0);
  readonly showPagination = computed(
    () => !this.loading() && this.hasAssignments() && this.lastPage() > 1,
  );

  readonly activeFilterSummary = computed(() => {
    const status = this.status();
    const dateKey = this.dueDateFilter();
    const statusText = status ? this.filterLabel(status) : '';
    const dateText = dateKey ? formatDisplayDateKey(dateKey) : '';

    if (status === 'today' && !dateKey) {
      return "Today's Tasks";
    }

    if (statusText && dateText) {
      return `${statusText} · ${dateText}`;
    }
    if (statusText) {
      return statusText;
    }
    if (dateText) {
      return `Due ${dateText}`;
    }
    return 'All forms';
  });

  readonly hasActiveFilters = computed(
    () => this.status() !== '' || this.dueDateFilter() !== null,
  );

  private readonly defaultLimit = environment.limit;

  ngOnInit(): void {
    const initialStatus = this.route.snapshot.queryParamMap.get('status');
    if (this.isSupportedStatusFilter(initialStatus)) {
      this.status.set(initialStatus);
    }

    const initialDate = this.route.snapshot.queryParamMap.get('date');
    if (initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate)) {
      this.dueDateFilter.set(initialDate);
    }

    this.syncQueryParams();
    this.loadAssignments(this.page());
  }

  toggleFilters(): void {
    this.filtersOpen.update((open) => !open);
  }

  onFilterChange(value: MyFormsStatusFilter): void {
    if (this.status() === value) {
      return;
    }
    this.status.set(value);
    this.page.set(1);
    this.syncQueryParams();
    this.loadAssignments(1);
  }

  onDueDateChange(value: string | null): void {
    const next = value?.trim() || null;
    if (this.dueDateFilter() === next) {
      return;
    }
    this.dueDateFilter.set(next);
    this.page.set(1);
    this.syncQueryParams();
    this.loadAssignments(1);
  }

  clearDueDate(): void {
    this.onDueDateChange(null);
  }

  prevPage(): void {
    if (this.page() > 1) {
      this.loadAssignments(this.page() - 1);
    }
  }

  nextPage(): void {
    if (this.page() < this.lastPage()) {
      this.loadAssignments(this.page() + 1);
    }
  }

  retry(): void {
    this.loadAssignments(this.page());
  }

  openAssignment(item: EmployeeAssignmentListItem): void {
    this.router.navigate(['/my-forms', item.id]);
  }

  canOpenAssignment(item: EmployeeAssignmentListItem): boolean {
    if (item.status === 'completed') {
      return this.canViewSubmission;
    }
    if (item.status === 'cancelled') {
      return true;
    }
    return this.canCompleteAssignment;
  }

  filterLabel(status: MyFormsStatusFilter): string {
    if (status === 'today') {
      return 'Today';
    }
    return this.statusLabel(status);
  }

  statusLabel(status: string): string {
    switch (status) {
      case 'today':
        return 'Today';
      case 'in_progress':
        return 'In Progress';
      case 'pending':
        return 'Pending';
      case 'completed':
        return 'Completed';
      case 'overdue':
        return 'Overdue';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status || 'Unknown';
    }
  }

  statusClass(status: string): string {
    switch (status) {
      case 'in_progress':
        return 'bg-[#EEF4FF] text-[#2563EB]';
      case 'completed':
        return 'bg-[#ECFDF3] text-[#067647]';
      case 'overdue':
        return 'bg-[#FEF3F2] text-[#B42318]';
      case 'cancelled':
        return 'bg-[#F5F5F5] text-[#6F6F6F]';
      default:
        return 'bg-[#FFF4EA] text-[#FF9015]';
    }
  }

  private loadAssignments(page: number): void {
    this.loading.set(true);
    this.errorMessage.set('');

    this.assignmentsService
      .getMyWork({
        page,
        limit: this.defaultLimit,
        status: this.status(),
        date: this.dueDateFilter(),
      })
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) => {
          this.assignments.set(result.items);
          this.total.set(result.total);
          this.page.set(result.page || page);
          this.lastPage.set(Math.max(1, result.lastPage || 1));
        },
        error: (err) => {
          this.assignments.set([]);
          this.total.set(0);
          this.lastPage.set(1);
          this.errorMessage.set(
            err?.error?.message || 'Unable to load your assigned forms. Please try again.',
          );
        },
      });
  }

  private syncQueryParams(): void {
    const status = this.status();
    const date = this.dueDateFilter();
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        status: status || null,
        date: date || null,
      },
      queryParamsHandling: '',
      replaceUrl: true,
    });
  }

  private isSupportedStatusFilter(value: string | null): value is MyFormsStatusFilter {
    return (
      value === 'today' ||
      value === 'pending' ||
      value === 'in_progress' ||
      value === 'completed' ||
      value === 'overdue' ||
      value === 'cancelled'
    );
  }
}

function formatDisplayDateKey(dateKey: string): string {
  const match = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return dateKey;
  }
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
