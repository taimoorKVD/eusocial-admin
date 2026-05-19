import { Component } from '@angular/core';
import { RoleService } from '../../../../../services/role.service';
import { Router } from '@angular/router';
import { TenantRoleService } from '../../../../../services/tenant-role.service';
import { TenantSessionService } from '../../../../../services/tenant-session.service';

@Component({
  selector: 'app-role-listing',
  standalone: false,
  templateUrl: './role-listing.component.html',
  styleUrl: './role-listing.component.scss',
})
export class RoleListingComponent {
  roles: any[] = [];
  isLoading = false;

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

    this.rolesService.getRoles().subscribe({
      next: (res: any) => {
        this.roles = res.data || [];
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
}
