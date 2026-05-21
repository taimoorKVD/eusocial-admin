import { Component } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { PermissionService } from '../../services/permission.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-permissions',
  standalone: false,
  templateUrl: './permissions.component.html',
  styleUrl: './permissions.component.scss',
})
export class PermissionsComponent {
  permissions: any[] = [];
  isLoading = false;
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
        this.loadPermissions();
      },
      error: () => {
        this.toastr.error('Delete failed');
      },
    });
  }
  onFilterSearch(filters: any): void {
    console.log('Search filters:', filters); // Debug log
    this.filters = filters;
    this.loadPermissions();
  }

  onFilterClear(): void {
    this.filters = {};
    this.loadPermissions();
  }
}
