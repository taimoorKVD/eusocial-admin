import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { SharedModule } from '../../../../shared/shared.module';
import { TenantSessionService } from '../../../../services/tenant-session.service';
import { EmployeeAssignmentsService } from '../../../../services/employee-assignments.service';
import {
  EmployeeAssignmentListItem,
  EmployeeAssignmentStatus,
} from '../../../../interfaces/employee-assignment';

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
  private readonly session = inject(TenantSessionService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly filters: StatusFilter[] = [
    { label: 'All', value: '' },
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
  readonly status = signal<EmployeeAssignmentStatus | ''>('');

  readonly hasAssignments = computed(() => this.assignments().length > 0);
  readonly showPagination = computed(
    () => !this.loading() && this.hasAssignments() && this.lastPage() > 1,
  );

  private readonly defaultLimit = environment.limit;

  ngOnInit(): void {
    const initialStatus = this.route.snapshot.queryParamMap.get('status');
    if (this.isSupportedStatus(initialStatus)) {
      this.status.set(initialStatus);
    }
    this.loadAssignments(this.page());
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
    this.router.navigate(['/tenant', this.session.getSlug(), 'my-forms', item.id]);
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

    this.assignmentsService
      .getMyWork({
        page,
        limit: this.defaultLimit,
        status: this.status(),
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
          this.errorMessage.set(
            err?.error?.message || 'Unable to load your assigned forms. Please try again.',
          );
        },
      });
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
