import { Component } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { PermissionService } from '../../services/permission.service';
import { Router } from '@angular/router';
import { BulkSelectionState } from '../../shared/dynamic-listing/bulk-selection.state';

@Component({
  selector: 'app-permissions',
  standalone: false,
  templateUrl: './permissions.component.html',
  styleUrl: './permissions.component.scss',
})
export class PermissionsComponent {
  permissions: any[] = [];
  isLoading = false;
  bulkDeleting = false;
  showBulkDeleteConfirmModal = false;

  bulkSelection = new BulkSelectionState();

  filters: any = {};
  filterFields = [
    {
      key: 'name',
      label: 'Name',
      type: 'text',
      placeholder: 'Search by name...'
    }
  ];

  constructor(
    private permissionsService: PermissionService,
    private toastr: ToastrService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadPermissions();
  }

  get bulkDeleteConfirmDescription(): string {
    const count = this.bulkSelection.count();
    return `Delete ${count} selected permission${count === 1 ? '' : 's'}? This action cannot be undone.`;
  }

  selectablePermissionIds(): number[] {
    return this.permissions.map((p) => p.id).filter((id) => id != null);
  }

  isSelected(permission: { id: number }): boolean {
    return this.bulkSelection.isSelected(permission.id);
  }

  toggleSelect(permission: { id: number }): void {
    if (permission?.id == null) return;
    this.bulkSelection.toggle(permission.id);
  }

  isAllSelected(): boolean {
    return this.bulkSelection.isAllSelected(this.selectablePermissionIds());
  }

  isIndeterminate(): boolean {
    return this.bulkSelection.isIndeterminate(this.selectablePermissionIds());
  }

  toggleSelectAll(): void {
    this.bulkSelection.toggleAll(this.selectablePermissionIds());
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
    this.bulkDeleting = true;

    this.permissionsService.bulkDeletePermissions(ids).subscribe({
      next: () => {
        this.toastr.success('Permissions deleted successfully');
        this.bulkSelection.clear();
        this.bulkDeleting = false;
        this.loadPermissions();
      },
      error: (err) => {
        this.bulkDeleting = false;
        this.toastr.error(err?.error?.message || 'Failed to delete permissions');
      },
    });
  }

  loadPermissions() {
    this.isLoading = true;
    const activeFilters = Object.fromEntries(
      Object.entries(this.filters).filter(([_, value]) => value),
    );

    const apiCall = Object.keys(activeFilters).length
      ? this.permissionsService.searchPermissions(activeFilters)
      : this.permissionsService.getPermissions();

    apiCall.subscribe({
      next: (res: any) => {
        this.permissions = res.data;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.bulkSelection.clear();
        this.toastr.error('Failed to load permissions');
      },
    });
  }

  goToCreate() {
    this.router.navigate(['permissions/create']);
  }

  edit(id: number) {
    this.router.navigate([`permissions/${id}/edit`]);
  }

  delete(id: number) {
    this.permissionsService.deletePermission(id).subscribe({
      next: () => {
        this.toastr.success('Deleted successfully');
        this.bulkSelection.clear();
        this.loadPermissions();
      },
      error: () => {
        this.toastr.error('Delete failed');
      },
    });
  }

  onFilterSearch(filters: any): void {
    this.filters = filters;
    this.bulkSelection.clear();
    this.loadPermissions();
  }

  onFilterClear(): void {
    this.filters = {};
    this.bulkSelection.clear();
    this.loadPermissions();
  }
}
