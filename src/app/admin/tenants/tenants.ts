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
  // page = 1;
  // total = 0;
  // lastPage = 1;
  page: number = 1;
  lastPage: number = 1;
  total: number = 0;
  message = '';

  constructor(private router: Router, private tenantService: TenantService) {}

  ngOnInit(): void {
    this.allTenants();
  }

  allTenants(page: number = 1): void {
    this.loading = true;
    this.message = '';
    this.tenantService.getTenants(page).subscribe({
      next: (res) => {
        this.tenants = res.data;
        // this.total = res.meta.total;
        // this.page = res.meta.page;
        // this.lastPage = res.meta.lastPage;
        this.total = Number(res.meta.total);
        this.lastPage = Number(res.meta.lastPage);
        this.page = Number(res.meta.page);
        this.loading = false;
      },
      error: () => {
        this.tenants = [];
        this.total = 0;
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
