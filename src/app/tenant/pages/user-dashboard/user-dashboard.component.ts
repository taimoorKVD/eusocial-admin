import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { TenantSessionService } from '../../../services/tenant-session.service';
import {
  TenantDashboardData,
  TenantDashboardService,
} from '../../../services/tenant-dashboard.service';

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
  readonly data = signal<TenantDashboardData | null>(null);

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

  goToPage(module: string): void {
    this.router.navigate(['/tenant', this.session.getSlug(), module, 'create']);
  }

  goToModule(module: string): void {
    this.router.navigate(['/tenant', this.session.getSlug(), module]);
  }
}
