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
  page = 1;
  total = 0;
  lastPage = 1;
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
        this.tenants = Array.isArray(res?.data) ? res.data : [];

        const meta = res?.meta || {};
        const total = Number(meta.total ?? this.tenants.length);
        const lastPage = Number(meta.lastPage ?? meta.last_page ?? 1);
        const currentPage = Number(
          meta.currentPage ?? meta.current_page ?? meta.page ?? page
        );

        this.total = Number.isFinite(total) ? total : this.tenants.length;
        this.lastPage = Number.isFinite(lastPage) && lastPage > 0 ? lastPage : 1;
        const safePage = Number.isFinite(currentPage) && currentPage > 0 ? currentPage : page;
        this.page = Math.min(safePage, this.lastPage);
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
