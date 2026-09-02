import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { TenantRoleService } from '../../../../../services/tenant-role.service';
import { GlobalFilterField } from '../../../../../shared/global-filter/global-filter';
import { environment } from '../../../../../../environments/environment.prod';
import {
  BulkSelectionState,
  toNumericIds,
} from '../../../../../shared/dynamic-listing/bulk-selection.state';

@Component({
  selector: 'app-role-listing',
  standalone: false,
  templateUrl: './role-listing.component.html',
  styleUrl: './role-listing.component.scss',
})
export class RoleListingComponent {
  roles: any[] = [];
  isLoading = false;
  deleting = false;
  filters: any = {};
  filterFields: GlobalFilterField[] = [
    {
      key: 'role_id',
      label: 'Role',
      type: 'select',
      options: [],
      placeholder: 'Select role',
    },
  ];
  private defaultLimit = environment.limit;

  bulkSelection = new BulkSelectionState();
  showBulkDeleteConfirmModal = false;

  get bulkDeleteConfirmDescription(): string {
    const count = this.bulkSelection.count();
    return `Delete ${count} selected role${count === 1 ? '' : 's'}? This action cannot be undone.`;
  }

  constructor(
    private rolesService: TenantRoleService,
    private router: Router,
    private toastr: ToastrService,
  ) {}

  ngOnInit(): void {
    this.loadRoles();
  }

  loadRoles() {
    this.isLoading = true;
    const activeFilters = Object.fromEntries(
      Object.entries(this.filters).filter(([_, value]) => value),
    );
    const field = this.filterFields.find((f) => f.key === 'role_id');

    const apiCall = Object.keys(activeFilters).length
      ? this.rolesService.searchRoles(activeFilters, this.defaultLimit)
      : this.rolesService.getRoles(1, this.defaultLimit);

    apiCall.subscribe({
      next: (res: any) => {
        this.roles = res.data || [];
        if (field && field.type === 'select' && Object.keys(activeFilters).length === 0) {
          field.options = this.roles;
        }
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.bulkSelection.clear();
      },
    });
  }

  goToCreate() {
    this.router.navigate(['/roles', 'create']);
  }

  editRole(id: number) {
    this.router.navigate(['/roles', 'edit', id]);
  }

  isAdminRole(role: any): boolean {
    return role?.name === 'Admin';
  }

  deleteRole(id: number) {
    if (!confirm('Are you sure?')) return;

    this.rolesService.deleteRole(id).subscribe({
      next: () => {
        this.toastr.success('Role deleted successfully');
        this.bulkSelection.clear();
        this.loadRoles();
      },
      error: (err) => {
        this.toastr.error(err?.error?.message || 'Failed to delete role');
      },
    });
  }

  isSelected(role: any): boolean {
    const id = Number(role?.id);
    return !Number.isNaN(id) && this.bulkSelection.isSelected(id);
  }

  toggleSelect(role: any): void {
    if (this.isAdminRole(role)) return;
    const id = Number(role?.id);
    if (!Number.isNaN(id)) {
      this.bulkSelection.toggle(id);
    }
  }

  selectableRoleIds(): number[] {
    return toNumericIds(
      this.roles.filter((role) => !this.isAdminRole(role)).map((role) => role?.id),
    );
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

    this.closeBulkDeleteConfirmModal();
    this.deleting = true;

    this.rolesService.bulkDeleteRoles(ids).subscribe({
      next: () => {
        this.toastr.success('Roles deleted successfully');
        this.bulkSelection.clear();
        this.deleting = false;
        this.loadRoles();
      },
      error: (err) => {
        this.deleting = false;
        this.toastr.error(err?.error?.message || 'Failed to delete roles');
      },
    });
  }

  onFilterSearch(filters: any): void {
    this.filters = filters;
    this.bulkSelection.clear();
    this.loadRoles();
  }

  onFilterClear(): void {
    this.filters = {};
    this.bulkSelection.clear();
    this.loadRoles();
  }
}
