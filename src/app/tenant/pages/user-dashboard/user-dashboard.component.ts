import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { TenantSessionService } from '../../../services/tenant-session.service';
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
  readonly session = inject(TenantSessionService);
  private readonly dashboardService = inject(TenantDashboardService);
  private readonly router = inject(Router);
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

  goToPage(module: string): void {
    this.router.navigate(['/tenant', this.session.getSlug(), module, 'create']);
  }

  goToModule(module: string): void {
    this.router.navigate(['/tenant', this.session.getSlug(), module]);
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
