import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { SharedModule } from '../../../../shared/shared.module';
import { EmployeeAssignmentsService } from '../../../../services/employee-assignments.service';
import {
  EmployeeAssignmentListItem,
  EmployeeAssignmentStatus,
} from '../../../../interfaces/employee-assignment';

@Component({
  selector: 'app-employee-history',
  standalone: true,
  imports: [CommonModule, SharedModule],
  templateUrl: './employee-history.component.html',
})
export class EmployeeHistoryComponent implements OnInit {
  private readonly assignmentsService = inject(EmployeeAssignmentsService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly historyItems = signal<EmployeeAssignmentListItem[]>([]);
  readonly loading = signal(false);
  readonly errorMessage = signal('');
  readonly page = signal(1);
  readonly lastPage = signal(1);
  readonly total = signal(0);

  readonly hasItems = computed(() => this.historyItems().length > 0);
  readonly showPagination = computed(
    () => !this.loading() && this.hasItems() && this.lastPage() > 1,
  );

  private readonly defaultLimit = environment.limit;
  private readonly status: EmployeeAssignmentStatus = 'completed';

  ngOnInit(): void {
    this.loadHistory(this.page());
  }

  prevPage(): void {
    if (this.page() > 1) {
      this.loadHistory(this.page() - 1);
    }
  }

  nextPage(): void {
    if (this.page() < this.lastPage()) {
      this.loadHistory(this.page() + 1);
    }
  }

  retry(): void {
    this.loadHistory(this.page());
  }

  openAssignment(item: EmployeeAssignmentListItem): void {
    this.router.navigate(['/my-forms', item.id]);
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

  private loadHistory(page: number): void {
    this.loading.set(true);
    this.errorMessage.set('');

    this.assignmentsService
      .getMyWork({
        page,
        limit: this.defaultLimit,
        status: this.status,
      })
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) => {
          this.historyItems.set(result.items);
          this.total.set(result.total);
          this.page.set(result.page || page);
          this.lastPage.set(Math.max(1, result.lastPage || 1));
        },
        error: (err) => {
          this.historyItems.set([]);
          this.total.set(0);
          this.errorMessage.set(
            err?.error?.message || 'Unable to load your history. Please try again.',
          );
        },
      });
  }
}
