import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TenantSessionService } from '../../../../services/tenant-session.service';
import { EmployeeDashboardService } from '../../../../services/employee-dashboard.service';
import { EmployeeDashboardData } from '../../../../interfaces/employee-assignment';
import { TenantProfileService } from '../../../../services/tenant-profile.service';

@Component({
  selector: 'app-employee-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './employee-dashboard.component.html',
})
export class EmployeeDashboardComponent {
  private readonly dashboardService = inject(EmployeeDashboardService);
  private readonly session = inject(TenantSessionService);
  private readonly profileService = inject(TenantProfileService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly data = signal<EmployeeDashboardData | null>(null);

  get displayName(): string {
    return this.profileService.getDisplayName();
  }

  ngOnInit(): void {
    this.dashboardService
      .getDashboardData()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (dashboard) => {
          this.data.set(dashboard);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
        },
      });
  }

  goToMyForms(): void {
    this.router.navigate(['/tenant', this.session.getSlug(), 'my-forms']);
  }

  statusLabel(status: string): string {
    switch (status) {
      case 'in_progress':
        return 'In Progress';
      case 'pending':
        return 'Pending';
      case 'completed':
        return 'Completed';
      default:
        return status;
    }
  }
}
