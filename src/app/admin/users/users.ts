import { HttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Router } from '@angular/router';
import { User } from '../../interfaces/user';
import { UserService } from '../../services/user.service';
import { ToastrService } from 'ngx-toastr';
import { RoleService } from '../../services/role.service';
import { BulkSelectionState } from '../../shared/dynamic-listing/bulk-selection.state';

@Component({
  selector: 'app-users',
  standalone: false,
  templateUrl: './users.html',
  styleUrl: './users.scss',
})
export class Users {
  users: User[] = [];
  loading = true;
  page: number = 1;
  lastPage: number = 1;
  total: number = 0;
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
      placeholder: 'Search by name...'
    },
    {
      key: 'email',
      label: 'Email',
      type: 'email',
      placeholder: 'Search by email...'
    },
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
    private http: HttpClient,
    private router: Router,
    private userService: UserService,
    private toastr: ToastrService,
    private roleService: RoleService,

  ) { }

  ngOnInit(): void {
    this.allUsers(this.page);
    this.getRoles();
  }

  get bulkDeleteConfirmDescription(): string {
    const count = this.bulkSelection.count();
    return `Delete ${count} selected user${count === 1 ? '' : 's'}? This action cannot be undone.`;
  }

  isUserSelectable(user: User): boolean {
    return user.role?.name !== 'Super Admin';
  }

  selectableUserIds(): number[] {
    return this.users.filter((u) => this.isUserSelectable(u)).map((u) => u.id);
  }

  isSelected(user: User): boolean {
    return this.bulkSelection.isSelected(user.id);
  }

  toggleSelect(user: User): void {
    if (!this.isUserSelectable(user)) return;
    this.bulkSelection.toggle(user.id);
  }

  isAllSelected(): boolean {
    return this.bulkSelection.isAllSelected(this.selectableUserIds());
  }

  isIndeterminate(): boolean {
    return this.bulkSelection.isIndeterminate(this.selectableUserIds());
  }

  toggleSelectAll(): void {
    this.bulkSelection.toggleAll(this.selectableUserIds());
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
      this.users.length > 0 && this.bulkSelection.count() === this.selectableUserIds().length;

    this.closeBulkDeleteConfirmModal();
    this.bulkDeleting = true;

    this.userService.bulkDeleteUsers(ids).subscribe({
      next: () => {
        this.toastr.success('Users deleted successfully');
        this.bulkSelection.clear();
        this.bulkDeleting = false;
        if (allVisibleSelected && this.page > 1) {
          this.allUsers(this.page - 1);
        } else {
          this.allUsers(this.page);
        }
      },
      error: (err) => {
        this.bulkDeleting = false;
        this.toastr.error(err?.error?.message || 'Failed to delete users');
      },
    });
  }

  getRoles(): void {
    const field = this.filterFields.find(f => f.key === 'role_id');
    this.roleService.getAllRoles().subscribe({
      next: (roles) => {
        if (field && field.type === 'select') {
          field.options = roles;
        }
      },
      error: () => console.error('Failed to load roles'),
    });
  }

  allUsers(page: number = 1): void {
    this.loading = true;
    const activeFilters = Object.fromEntries(
      Object.entries(this.filters).filter(([_, value]) => value)
    );

     const apiCall = Object.keys(activeFilters).length
    ? this.userService.searchUsers(activeFilters, this.defaultLimit)
    : this.userService.getUsers(page, this.defaultLimit);

    apiCall.subscribe({
      next: (res) => {
        this.users = res.data;
        this.total = Number(res?.meta?.total) || 1;
        this.page = Number(res?.meta?.page) || 1;
        this.lastPage = Number(res?.meta?.lastPage) || 1;
        this.loading = false;
      },
      error: () => {
        this.users = [];
        this.total = 0;
        this.loading = false;
        this.bulkSelection.clear();
      },
    });
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

    this.userService.deleteUser(id).subscribe({
      next: () => {
        this.toastr.success('User deleted successfully');
        this.bulkSelection.clear();
        this.allUsers(this.page);
      },
      error: (err) => {
        this.toastr.error(err?.error?.message || 'Failed to delete user');
      },
    });
  }

  editUser(user: User): void {
    this.router.navigate(['/users', user.id, 'edit']);
  }

  prevPage(): void {
    if (this.page > 1) {
      this.bulkSelection.clear();
      this.allUsers(this.page - 1);
    }
  }

  nextPage(): void {
    if (this.page < this.lastPage) {
      this.bulkSelection.clear();
      this.allUsers(this.page + 1);
    }
  }

  addUser(): void {
    this.router.navigate(['/users/create']);
  }

  onFilterSearch(filters: any): void {
    this.filters = filters;
    this.page = 1;
    this.bulkSelection.clear();
    this.allUsers(this.page);
  }

  onFilterClear(): void {
    this.filters = {};
    this.page = 1;
    this.bulkSelection.clear();
    this.allUsers(this.page);
  }
}
