import { HttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Router } from '@angular/router';
import { User } from '../../interfaces/user';
import { UserService } from '../../services/user.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-users',
  standalone: false,
  templateUrl: './users.html',
  styleUrl: './users.scss',
})
export class Users {
  users: User[] = []; // ✅ array of users
  loading = true;
  page = 1;
  total = 0;
  lastPage = 1;
  message = '';
  showDeleteModal = false;
  deleteTargetId: number | null = null;

  constructor(
    private http: HttpClient,
    private router: Router,
    private userService: UserService,
    private toastr: ToastrService
  ) { }

  ngOnInit(): void {
    this.allUsers();
  }

  allUsers(page: number = 1): void {
    this.loading = true;
    this.message = '';
    this.userService.getUsers(page).subscribe({
      next: (res) => {
        this.users = Array.isArray(res?.data) ? res.data : [];

        const meta = res?.meta || {};
        const total = Number(meta.total ?? this.users.length);
        const lastPage = Number(meta.lastPage ?? meta.last_page ?? 1);
        const currentPage = Number(
          meta.currentPage ?? meta.current_page ?? meta.page ?? page
        );

        this.total = Number.isFinite(total) ? total : this.users.length;
        this.lastPage = Number.isFinite(lastPage) && lastPage > 0 ? lastPage : 1;
        const safePage = Number.isFinite(currentPage) && currentPage > 0 ? currentPage : page;
        this.page = Math.min(safePage, this.lastPage);
        this.loading = false;
      },
      error: () => {
        this.users = [];
        this.total = 0;
        this.loading = false;
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
    if (this.page > 1) this.allUsers(this.page - 1);
  }

  nextPage(): void {
    if (this.page < this.lastPage) this.allUsers(this.page + 1);
  }

  addUser(): void {
    this.router.navigate(['/users/create']);
  }


}
