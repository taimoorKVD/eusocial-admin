import { Component } from '@angular/core';
import { Tenant } from '../../interfaces/tenant';
import { TenantService } from '../../services/tenant.service';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-tenants',
  standalone: false,
  templateUrl: './tenants.html',
  styleUrl: './tenants.scss',
})
export class Tenants {
  tenants: Tenant[] = [];
  loading = true;
  page = 1;
  total = 0;
  lastPage = 1;
  message = '';

  constructor(private router: Router, private tenantService: TenantService) {}

  ngOnInit(): void {
    this.allTenants();
  }

  allTenants(page: number = 1): void {
    this.loading = true;
    this.tenantService.getTenants(page).subscribe({
      next: (res) => {
        this.tenants = res.data;
        this.total = res.meta.total;
        this.page = res.meta.page;
        this.lastPage = res.meta.lastPage;
        this.loading = false;
      },
      error: () => {
        this.message = 'Failed to load tenants ❌';
        this.loading = false;
      },
    });
  }

  addTenant(): void {
    this.router.navigate(['/tenants/create']);
  }

  editTenant(id: number): void {
    this.router.navigate(['/tenants', id, 'edit']);
  }

  deleteTenant(id: number): void {
    if (!confirm('Are you sure you want to delete this tenant?')) return;

    this.tenantService.delete(id).subscribe({
      next: () => {
        this.message = 'Tenant deleted successfully ✅';
        this.allTenants(this.page);
      },
      error: () => {
        this.message = 'Failed to delete tenant ❌';
      },
    });
  }

  prevPage(): void {
    if (this.page > 1) this.allTenants(this.page - 1);
  }

  nextPage(): void {
    if (this.page < this.lastPage) this.allTenants(this.page + 1);
  }
}
