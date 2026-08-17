import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { TenantDashboardService } from '../../../services/tenant-dashboard.service';
import {
  EmployeeDashboardData,
  NormalizedDashboard,
  TenantAdminDashboardData,
} from '../../../interfaces/dashboard';

@Component({
  selector: 'app-user-dashboard',
  standalone: false,
  templateUrl: './user-dashboard.component.html',
  styleUrl: './user-dashboard.component.scss',
})
export class UserDashboardComponent {
  private readonly dashboardService = inject(TenantDashboardService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly errorMessage = signal('');
  readonly payload = signal<NormalizedDashboard | null>(null);

  readonly employeeData = computed<EmployeeDashboardData | null>(() => {
    const dashboard = this.payload();
    return dashboard?.accountType === 'tenant_user' ? dashboard.employee : null;
  });

  readonly adminData = computed<TenantAdminDashboardData | null>(() => {
    const dashboard = this.payload();
    return dashboard?.accountType === 'tenant_admin' ? dashboard.admin : null;
  });

  ngOnInit(): void {
    this.loadDashboard();
  }

  retry(): void {
    this.loadDashboard();
  }

  private loadDashboard(): void {
    this.loading.set(true);
    this.errorMessage.set('');

    this.dashboardService
      .getDashboardData()
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (dashboard) => {
          this.payload.set(dashboard);
        },
        error: (err: { error?: { message?: string }; message?: string }) => {
          this.payload.set(null);
          this.errorMessage.set(
            err?.error?.message || err?.message || 'Unable to load dashboard. Please try again.',
          );
        },
      });
  }
}
