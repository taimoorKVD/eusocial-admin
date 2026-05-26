import { Component } from '@angular/core';
import { RoleService } from '../../../../../services/role.service';
import { Router } from '@angular/router';
import { TenantRoleService } from '../../../../../services/tenant-role.service';
import { TenantSessionService } from '../../../../../services/tenant-session.service';
import { GlobalFilterField } from '../../../../../shared/global-filter/global-filter';
import { environment } from '../../../../../../environments/environment.prod';

@Component({
  selector: 'app-role-listing',
  standalone: false,
  templateUrl: './role-listing.component.html',
  styleUrl: './role-listing.component.scss',
})
export class RoleListingComponent {
  roles: any[] = [];
  isLoading = false;
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

  constructor(
    private rolesService: TenantRoleService,
    private router: Router,
    private tenantSession: TenantSessionService,
  ) {}

  ngOnInit(): void {
    this.loadRoles();
  }

  loadRoles() {
    this.isLoading = true;
     const activeFilters = Object.fromEntries(
      Object.entries(this.filters).filter(([_, value]) => value),
    );
    const field = this.filterFields.find(f => f.key === 'role_id');

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
      }
    });
  }

  goToCreate() {
    this.router.navigate([
      '/tenant',
      this.tenantSession.getSlug(),
      'roles',
      'create'
    ]);
  }

  editRole(id: number) {
    this.router.navigate([ '/tenant', this.tenantSession.getSlug(),'roles/edit', id]);
  }

  deleteRole(id: number) {
    if (!confirm('Are you sure?')) return;

    this.rolesService.deleteRole(id).subscribe(() => {
      this.loadRoles();
    });
  }

  onFilterSearch(filters: any): void {
    this.filters = filters;
    this.loadRoles();
  }

  onFilterClear(): void {
    this.filters = {};
    this.loadRoles();
  }
}
