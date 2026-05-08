import { Component } from '@angular/core';
import { Role } from '../../interfaces/role';
import { RoleService } from '../../services/role.service';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';

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
  showDeleteModal = false;
  deleteTargetId: number | null = null;

  constructor(private roleService: RoleService, private router: Router, private toastr: ToastrService) {}

  ngOnInit(): void {
    this.allRoles();
    // console.log(this.allRoles());
  }

  allRoles(page: number = 1): void {
    this.loading = true;
    this.message = '';

    this.roleService.getRoles(page).subscribe({
      next: (res) => {
        this.roles = res.data;
        // this.total = roles.length;
        this.total = Number(res.meta.total);
        this.page = Number(res.meta.page);
        this.lastPage = Number(res.meta.lastPage);
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
        this.allRoles(this.page);
      },
      error: (err) => {
        this.toastr.error(err?.error?.message || 'Failed to delete role');
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
