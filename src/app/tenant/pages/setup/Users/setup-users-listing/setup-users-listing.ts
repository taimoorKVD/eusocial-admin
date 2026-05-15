import { Component } from '@angular/core';
import { TenantUserService } from '../../../../../services/tenant-user.service';
import { ActivatedRoute, Router } from '@angular/router';
import { TenantSessionService } from '../../../../../services/tenant-session.service';

@Component({
  selector: 'app-setup-users-listing',
  standalone: false,
  templateUrl: './setup-users-listing.html',
  styleUrl: './setup-users-listing.scss',
})
export class SetupUsersListing {
  users: any[] = [];
  // loading: boolean = false;
  loading = false;
  slug: string = '';
  page = 1;
  lastPage = 1;
  total = 0;

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
    }
  ];

  constructor(private userService: TenantUserService, public session: TenantSessionService, private route:ActivatedRoute, private router: Router) {}

  ngOnInit(): void {
    this.allUsers(this.page);
    this.slug = this.route.parent?.parent?.snapshot.paramMap.get('slug') || '';
  }

  goToCreate() {
    this.router.navigate([
      '/tenant',
      this.session.getSlug(),
      'users',
      'create'
    ]);
  }

  // allUsers(page: number = 1): void {
  //   this.loading = true;

  //   const activeFilters = Object.fromEntries(
  //     Object.entries(this.filters).filter(([_, value]) => value)
  //   );

  //    const apiCall = Object.keys(activeFilters).length
  //   ? this.userService.searchUsers(activeFilters, 15)
  //   : this.userService.getUsers(page);

  //   apiCall.subscribe({
  //     next: (res) => {
  //       this.users = res.data;
  //       this.total = Number(res?.count || 0);
  //       this.page = Number(res?.page || 1);
  //       this.lastPage = Number(res?.lastPage || 1);
  //       this.loading = false;
  //     },
  //     error: () => {
  //       this.users = [];
  //       this.total = 0;
  //       this.loading = false;
  //     },
  //   });
  // }

  allUsers(page: number = 1): void {
  this.loading = true;

  const activeFilters = Object.fromEntries(
    Object.entries(this.filters).filter(([_, value]) => value)
  );

  const apiCall = Object.keys(activeFilters).length
    ? this.userService.searchUsers(activeFilters, 15)
    : this.userService.getUsers(page);

  apiCall.subscribe({
    next: (res) => {

      this.users = res.data || [];

      this.total = Number(res?.meta?.total || 0);
      this.page = Number(res?.meta?.page || 1);
      this.lastPage = Number(res?.meta?.lastPage || 1);

      this.loading = false;
    },

    error: () => {
      this.users = [];
      this.total = 0;
      this.loading = false;
    },
  });
}

  deleteUser(id: number) {
    if (!confirm('Are you sure you want to delete this user?')) return;

    this.userService.deleteUser(id).subscribe(() => {
      this.allUsers(this.page); // refresh list
    });
  }

  prevPage(): void {
    if (this.page > 1) {
      this.allUsers(this.page - 1);
    }
  }

  nextPage(): void {
    if (this.page < this.lastPage) {
      this.allUsers(this.page + 1);
    }
  }

  onFilterSearch(filters: any): void {
    this.filters = filters;
    this.page = 1;
    this.allUsers(this.page);
  }

  onFilterClear(): void {
    this.filters = {};
    this.page = 1;
    this.allUsers(this.page);
  }
}
