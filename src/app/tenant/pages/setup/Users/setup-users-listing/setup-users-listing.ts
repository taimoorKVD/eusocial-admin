import { Component } from '@angular/core';
import { TenantUserService } from '../../../../../services/tenant-user.service';
import { ActivatedRoute } from '@angular/router';

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

  constructor(private userService: TenantUserService, private route:ActivatedRoute) {}

  ngOnInit(): void {
    this.getUsers();
    this.slug = this.route.parent?.parent?.snapshot.paramMap.get('slug') || '';
  }

  // getUsers() {
  //   this.loading = true;

  //   this.userService.getUsers().subscribe({
  //     next: (res: any) => {
  //       const rows = Array.isArray(res?.data) ? res.data : [];
  //       this.users = [...rows].sort((a: any, b: any) => {
  //         const aTime = a?.created_at ? new Date(a.created_at).getTime() : 0;
  //         const bTime = b?.created_at ? new Date(b.created_at).getTime() : 0;

  //         if (aTime && bTime && aTime !== bTime) {
  //           return bTime - aTime;
  //         }

  //         return (b?.id || 0) - (a?.id || 0);
  //       });
  //       this.loading = false;
  //     },
  //     error: (err) => {
  //       console.error(err);
  //       this.loading = false;
  //     }
  //   });
  // }

  getUsers(page: number = 1) {

  this.loading = true;

  this.userService.getUsers(page).subscribe({

    next: (res: any) => {

      const rows = Array.isArray(res?.data)
        ? res.data
        : [];

      this.users = [...rows].sort((a: any, b: any) => {

        const aTime = a?.created_at
          ? new Date(a.created_at).getTime()
          : 0;

        const bTime = b?.created_at
          ? new Date(b.created_at).getTime()
          : 0;

        if (aTime && bTime && aTime !== bTime) {
          return bTime - aTime;
        }

        return (b?.id || 0) - (a?.id || 0);
      });

      this.total = Number(res?.count || 0);
      this.page = Number(res?.page || 1);
      this.lastPage = Number(res?.lastPage || 1);

      this.loading = false;
    },

    error: (err) => {

      console.error(err);
      this.loading = false;
    }
  });
}

  deleteUser(id: number) {
  if (!confirm('Are you sure you want to delete this user?')) return;

  this.userService.deleteUser(id).subscribe(() => {
    this.getUsers(); // refresh list
  });
}

  prevPage(): void {
    if (this.page > 1) {
      this.getUsers(this.page - 1);
    }
  }

  nextPage(): void {
    if (this.page < this.lastPage) {
      this.getUsers(this.page + 1);
    }
  }
}
