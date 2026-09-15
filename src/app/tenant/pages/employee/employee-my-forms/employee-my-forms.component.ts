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

interface StatusFilter {
  label: string;
  value: EmployeeAssignmentStatus | '';
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
    { label: 'Pending', value: 'pending' },
    { label: 'In Progress', value: 'in_progress' },
    { label: 'Completed', value: 'completed' },
    { label: 'Overdue', value: 'overdue' },
    { label: 'Cancelled', value: 'cancelled' },
  ];

  /** Unfiltered page payload from the API (status already applied server-side). */
  private readonly loadedAssignments = signal<EmployeeAssignmentListItem[]>([]);

  readonly loading = signal(false);
  readonly errorMessage = signal('');
  readonly page = signal(1);
  readonly lastPage = signal(1);
  readonly total = signal(0);
  readonly status = signal<EmployeeAssignmentStatus | ''>('');
  /** `Y-m-d` calendar date, or null when date filter is cleared. Defaults to today. */
  readonly dueDateFilter = signal<string | null>(localTodayDateKey());
  readonly filtersOpen = signal(false);

  readonly filteredAssignments = computed(() => {
    const dateKey = this.dueDateFilter();
    const items = this.loadedAssignments();
    if (!dateKey) {
      return items;
    }
    return items.filter((item) => assignmentDueDateKey(item.dueDate) === dateKey);
  });

  readonly assignments = computed(() => {
    const items = this.filteredAssignments();
    if (!this.dueDateFilter()) {
      return items;
    }
    const limit = this.defaultLimit;
    const start = (this.page() - 1) * limit;
    return items.slice(start, start + limit);
  });

  readonly hasAssignments = computed(() => this.assignments().length > 0);
  readonly showPagination = computed(() => {
    if (this.loading() || !this.hasAssignments()) {
      return false;
    }
    return this.lastPage() > 1;
  });

  readonly activeFilterSummary = computed(() => {
    const status = this.status();
    const dateKey = this.dueDateFilter();
    const statusText = status ? this.statusLabel(status) : '';
    const today = localTodayDateKey();

    if (dateKey === today && !status) {
      return "Today's Tasks";
    }

    const dateText = dateKey ? formatDisplayDateKey(dateKey) : '';

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
    () => !!this.status() || this.dueDateFilter() !== null,
  );

  private readonly defaultLimit = environment.limit;
  /** When filtering by date, load a larger page so client-side date match is complete. */
  private readonly dateFilterFetchLimit = 200;

  ngOnInit(): void {
    const initialStatus = this.route.snapshot.queryParamMap.get('status');
    if (this.isSupportedStatus(initialStatus)) {
      this.status.set(initialStatus);
    }
    this.loadAssignments(1);
  }

  toggleFilters(): void {
    this.filtersOpen.update((open) => !open);
  }

  onFilterChange(value: EmployeeAssignmentStatus | ''): void {
    if (this.status() === value) {
      return;
    }
    this.status.set(value);
    this.page.set(1);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: value ? { status: value } : {},
      replaceUrl: true,
    });
    this.loadAssignments(1);
  }

  onDueDateChange(value: string | null): void {
    const next = value?.trim() || null;
    if (this.dueDateFilter() === next) {
      return;
    }
    this.dueDateFilter.set(next);
    this.page.set(1);
    this.loadAssignments(1);
  }

  clearDueDate(): void {
    this.onDueDateChange(null);
  }

  prevPage(): void {
    if (this.page() > 1) {
      if (this.dueDateFilter()) {
        this.page.update((p) => p - 1);
        this.syncClientPaginationMeta();
        return;
      }
      this.loadAssignments(this.page() - 1);
    }
  }

  nextPage(): void {
    if (this.page() < this.lastPage()) {
      if (this.dueDateFilter()) {
        this.page.update((p) => p + 1);
        this.syncClientPaginationMeta();
        return;
      }
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

  statusLabel(status: string): string {
    switch (status) {
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

    const dateFilter = this.dueDateFilter();
    const requestPage = dateFilter ? 1 : page;
    const requestLimit = dateFilter ? this.dateFilterFetchLimit : this.defaultLimit;

    this.assignmentsService
      .getMyWork({
        page: requestPage,
        limit: requestLimit,
        status: this.status(),
      })
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) => {
          this.loadedAssignments.set(result.items);

          if (dateFilter) {
            this.page.set(1);
            this.syncClientPaginationMeta();
            return;
          }

          this.total.set(result.total);
          this.page.set(result.page || page);
          this.lastPage.set(Math.max(1, result.lastPage || 1));
        },
        error: (err) => {
          this.loadedAssignments.set([]);
          this.total.set(0);
          this.lastPage.set(1);
          this.errorMessage.set(
            err?.error?.message || 'Unable to load your assigned forms. Please try again.',
          );
        },
      });
  }

  private syncClientPaginationMeta(): void {
    const total = this.filteredAssignments().length;
    const lastPage = Math.max(1, Math.ceil(total / this.defaultLimit) || 1);
    const page = Math.min(Math.max(1, this.page()), lastPage);
    this.total.set(total);
    this.lastPage.set(lastPage);
    this.page.set(page);
  }

  private isSupportedStatus(value: string | null): value is EmployeeAssignmentStatus {
    return (
      value === 'pending' ||
      value === 'in_progress' ||
      value === 'completed' ||
      value === 'overdue' ||
      value === 'cancelled'
    );
  }
}

/** Local calendar today as `Y-m-d` (not UTC). */
function localTodayDateKey(): string {
  const now = new Date();
  return formatLocalDateKey(now);
}

/**
 * Calendar due-date key for comparison.
 * Prefer the API `YYYY-MM-DD` prefix (from dueAt ISO) so UTC midnight
 * does not shift the due day via local timezone conversion.
 */
function assignmentDueDateKey(dueDate: string | null | undefined): string | null {
  if (!dueDate) {
    return null;
  }
  const trimmed = String(dueDate).trim();
  const prefix = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (prefix) {
    return prefix[1];
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return formatLocalDateKey(parsed);
}

function formatLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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
