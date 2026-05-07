import { Component } from '@angular/core';
import { Role } from '../../interfaces/role';
import { RoleService } from '../../services/role.service';
import { Router } from '@angular/router';

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
  message = '';
  page = 1;
  lastPage = 1;

  constructor(private roleService: RoleService, private router: Router) {}

  ngOnInit(): void {
    this.allRoles();
    // console.log(this.allRoles());
  }

  allRoles(page: number = 1): void {
    this.loading = true;
    this.message = '';

    this.roleService.getRoles(page).subscribe({
      next: (roles) => {
        this.roles = roles;
        this.total = roles.length; // ✅ we no longer have res.meta
        this.loading = false;
      },
      error: () => {
        this.roles = [];
        this.total = 0;
        this.loading = false;
      },
    });
  }

  addRole() {
    this.router.navigate(['/roles/create']);
  }

  deleteRole(id: number): void {
    if (!confirm('Are you sure you want to delete this role?')) return;

    this.roleService.deleteRole(id).subscribe({
      next: () => {
        this.message = 'Role deleted successfully ✅';
        this.allRoles();
      },
      error: () => {
        this.message = 'Failed to delete role ❌';
      },
    });
  }

  /** Pagination controls */
  prevPage(): void {
    if (this.page > 1) this.allRoles(this.page - 1);
  }

  nextPage(): void {
    if (this.page < this.lastPage) this.allRoles(this.page + 1);
  }
}
