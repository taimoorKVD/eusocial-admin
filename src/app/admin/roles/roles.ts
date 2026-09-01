import { Component } from '@angular/core';
import { Role } from '../../interfaces/role';
import { RoleService } from '../../services/role.service';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { environment } from '../../../environments/environment.prod';
import { BulkSelectionState } from '../../shared/dynamic-listing/bulk-selection.state';

@Component({
  selector: 'app-roles',
  standalone: false,
  templateUrl: './roles.html',
  styleUrl: './roles.scss',
})
export class Roles {
  roles: Role[] = [];
  total = 0;
  loading = true;
  page = 1;
  lastPage = 1;
  showDeleteModal = false;
  deleteTargetId: number | null = null;
  showBulkDeleteConfirmModal = false;
  bulkDeleting = false;

  bulkSelection = new BulkSelectionState();

  filters: any = {};
  filterFields = [
    {
      key: 'name',
      label: 'Name',
      type: 'text',
      placeholder: 'Search by Role name...'
    }
  ];
  private defaultLimit = environment.limit;

  constructor(private roleService: RoleService, private router: Router, private toastr: ToastrService) {}

  ngOnInit(): void {
    this.allRoles();
  }

  get bulkDeleteConfirmDescription(): string {
    const count = this.bulkSelection.count();
    return `Delete ${count} selected role${count === 1 ? '' : 's'}? This action cannot be undone.`;
  }

  isRoleSelectable(role: Role): boolean {
    return role.name !== 'Super Admin';
  }

  selectableRoleIds(): number[] {
    return this.roles.filter((r) => this.isRoleSelectable(r)).map((r) => r.id);
  }

  isSelected(role: Role): boolean {
    return this.bulkSelection.isSelected(role.id);
  }

  toggleSelect(role: Role): void {
    if (!this.isRoleSelectable(role)) return;
    this.bulkSelection.toggle(role.id);
  }

  isAllSelected(): boolean {
    return this.bulkSelection.isAllSelected(this.selectableRoleIds());
  }

  isIndeterminate(): boolean {
    return this.bulkSelection.isIndeterminate(this.selectableRoleIds());
  }

  toggleSelectAll(): void {
    this.bulkSelection.toggleAll(this.selectableRoleIds());
  }

  openBulkDeleteConfirm(): void {
    if (!this.bulkSelection.hasSelection()) return;
    this.showBulkDeleteConfirmModal = true;
  }

  closeBulkDeleteConfirmModal(): void {
    this.showBulkDeleteConfirmModal = false;
  }

  onConfirmBulkDelete(): void {
    const ids = [...this.bulkSelection.selectedIds()];
    if (!ids.length) return;

    const allVisibleSelected =
      this.roles.length > 0 && this.bulkSelection.count() === this.selectableRoleIds().length;

    this.closeBulkDeleteConfirmModal();
    this.bulkDeleting = true;

    this.roleService.bulkDeleteRoles(ids).subscribe({
      next: () => {
        this.toastr.success('Roles deleted successfully');
        this.bulkSelection.clear();
        this.bulkDeleting = false;
        if (allVisibleSelected && this.page > 1) {
          this.allRoles(this.page - 1);
        } else {
          this.allRoles(this.page);
        }
      },
      error: (err) => {
        this.bulkDeleting = false;
        this.toastr.error(err?.error?.message || 'Failed to delete roles');
      },
    });
  }

  allRoles(page: number = 1): void {
    this.loading = true;

     const activeFilters = Object.fromEntries(
      Object.entries(this.filters).filter(([_, value]) => value)
    );

     const apiCall = Object.keys(activeFilters).length
    ? this.roleService.searchRoles(activeFilters, this.defaultLimit)
    : this.roleService.getRoles(page, this.defaultLimit);

    apiCall.subscribe({
      next: (res) => {
        this.roles = res.data;
        this.total = Number(res?.meta?.total) || 1;
        this.page = Number(res?.meta?.page) || 1;
        this.lastPage = Number(res?.meta?.lastPage) || 1;
        this.loading = false;
      },
      error: () => {
        this.roles = [];
        this.total = 0;
        this.loading = false;
        this.bulkSelection.clear();
      },
    });
  }

  addRole() {
    this.router.navigate(['/roles/create']);
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

    this.roleService.deleteRole(id).subscribe({
      next: () => {
        this.toastr.success('Role deleted successfully');
        this.bulkSelection.clear();
        this.allRoles(this.page);
      },
      error: (err) => {
        this.toastr.error(err?.error?.message || 'Failed to delete role');
      },
    });
  }

  /** Pagination controls */
  prevPage(): void {
    if (this.page > 1) {
      this.bulkSelection.clear();
      this.allRoles(this.page - 1);
    }
  }

  nextPage(): void {
    if (this.page < this.lastPage) {
      this.bulkSelection.clear();
      this.allRoles(this.page + 1);
    }
  }

  onFilterSearch(filters: any): void {
    this.filters = filters;
    this.page = 1;
    this.bulkSelection.clear();
    this.allRoles(this.page);
  }

  onFilterClear(): void {
    this.filters = {};
    this.page = 1;
    this.bulkSelection.clear();
    this.allRoles(this.page);
  }
}
