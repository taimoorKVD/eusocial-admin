import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TenantSessionService } from '../../../services/tenant-session.service';
import { TenantAdminDashboardData } from '../../../interfaces/dashboard';

interface AdminStatCardView {
  key: string;
  title: string;
  value: number;
  label: string;
  icon: 'users' | 'items' | 'vendors' | 'forms' | 'templates' | 'alert';
  emphasize?: boolean;
}

@Component({
  selector: 'app-tenant-admin-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tenant-admin-dashboard.component.html',
})
export class TenantAdminDashboardComponent {
  private readonly session = inject(TenantSessionService);
  private readonly router = inject(Router);

  @Input({ required: true }) data!: TenantAdminDashboardData;

  get welcomeHeading(): string {
    const name = this.data.user.name;
    return name ? `Welcome Back, ${name}!` : 'Welcome Back!';
  }

  get welcomeSubtitle(): string {
    return this.data.user.role;
  }

  get overviewCards(): AdminStatCardView[] {
    const overview = this.data.overview;
    return [
      {
        key: 'users',
        title: 'Users',
        value: overview.totalUsers,
        label: overview.labels.totalUsers,
        icon: 'users',
      },
      {
        key: 'items',
        title: 'Items',
        value: overview.totalItems,
        label: overview.labels.totalItems,
        icon: 'items',
      },
      {
        key: 'vendors',
        title: 'Vendors',
        value: overview.totalVendors,
        label: overview.labels.totalVendors,
        icon: 'vendors',
      },
      {
        key: 'forms',
        title: 'Forms',
        value: overview.totalForms,
        label: overview.labels.totalForms,
        icon: 'forms',
      },
    ];
  }

  get breakdownCards(): AdminStatCardView[] {
    const breakdown = this.data.overview.breakdown;
    return [
      {
        key: 'formBuilderForms',
        title: 'Form Builder Forms',
        value: breakdown.formBuilderForms,
        label: '',
        icon: 'forms',
      },
      {
        key: 'dataCollectionTemplates',
        title: 'Data Collection Templates',
        value: breakdown.dataCollectionTemplates,
        label: '',
        icon: 'templates',
      },
    ];
  }

  get inventoryCards(): AdminStatCardView[] {
    const inventory = this.data.inventory;
    return [
      {
        key: 'totalItems',
        title: 'Total Items',
        value: inventory.totalItems,
        label: '',
        icon: 'items',
      },
      {
        key: 'lowStock',
        title: 'Low Stock',
        value: inventory.lowStock,
        label: '',
        icon: 'alert',
        emphasize: inventory.lowStock > 0,
      },
      {
        key: 'belowPar',
        title: 'Below PAR',
        value: inventory.belowPar,
        label: '',
        icon: 'alert',
        emphasize: inventory.belowPar > 0,
      },
      {
        key: 'orderRequired',
        title: 'Order Required',
        value: inventory.orderRequired,
        label: '',
        icon: 'alert',
        emphasize: inventory.orderRequired > 0,
      },
    ];
  }

  get inventoryAvailable(): boolean {
    return this.data.inventory.available;
  }

  goToModule(module: string): void {
    this.router.navigate(['/tenant', this.session.getSlug(), module]);
  }

  goToCreate(module: string): void {
    this.router.navigate(['/tenant', this.session.getSlug(), module, 'create']);
  }
}
