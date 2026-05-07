import { HttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Router } from '@angular/router';
import { User } from '../../interfaces/user';
import { UserService } from '../../services/user.service';

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

  constructor(
    private http: HttpClient,
    private router: Router,
    private userService: UserService
  ) { }

  ngOnInit(): void {
    this.allUsers();
  }

  allUsers(page: number = 1): void {
    this.loading = true;
    this.message = '';
    this.userService.getUsers(page).subscribe({
      next: (res) => {
        this.users = res.data;
        console.log(this.users);
        this.total = res.meta.total;
        this.lastPage = res.meta.lastPage;
        this.page = res.meta.page;
        this.loading = false;
      },
      error: () => {
        this.users = [];
        this.total = 0;
        this.loading = false;
      },
    });
  }

  deleteUser(id: number): void {
    if (!confirm('Are you sure you want to delete this user?')) return;

    this.userService.deleteUser(id).subscribe({
      next: () => {
        this.message = 'User deleted successfully ✅';
        this.allUsers(this.page);
      },
      error: () => {
        this.message = 'Failed to delete user ❌';
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
