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

  constructor(private userService: TenantUserService, private route:ActivatedRoute) {}

  ngOnInit(): void {
    this.getUsers();
    this.slug = this.route.parent?.parent?.snapshot.paramMap.get('slug') || '';
  }

  getUsers() {
    this.loading = true;

    this.userService.getUsers().subscribe({
      next: (res: any) => {
        const rows = Array.isArray(res?.data) ? res.data : [];
        this.users = [...rows].sort((a: any, b: any) => {
          const aTime = a?.created_at ? new Date(a.created_at).getTime() : 0;
          const bTime = b?.created_at ? new Date(b.created_at).getTime() : 0;

          if (aTime && bTime && aTime !== bTime) {
            return bTime - aTime;
          }

          return (b?.id || 0) - (a?.id || 0);
        });
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
}
