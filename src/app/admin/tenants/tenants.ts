import { Component } from '@angular/core';
import { Tenant } from '../../interfaces/tenant';
import { TenantService } from '../../services/tenant.service';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';

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
  showDeleteModal = false;
  deleteTargetId: number | null = null;

  constructor(private router: Router, private tenantService: TenantService, private toastr: ToastrService) {}

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

  openDeleteModal(id: number): void {
    this.deleteTargetId = id;
    this.showDeleteModal = true;
  }

  cancelDelete(): void {
    this.showDeleteModal = false;
    this.deleteTargetId = null;
  }

  confirmDelete(): void {
    if (this.deleteTargetId === null) return;
    const id = this.deleteTargetId;
    this.showDeleteModal = false;
    this.deleteTargetId = null;

    this.tenantService.delete(id).subscribe({
      next: () => {
        this.toastr.success('Tenant deleted successfully');
        this.allTenants(this.page);
      },
      error: (err) => {
        this.toastr.error(err?.error?.message || 'Failed to delete tenant');
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
