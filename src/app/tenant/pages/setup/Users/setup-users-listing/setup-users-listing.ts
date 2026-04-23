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
  loading: boolean = false;
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
        this.users = res.data || [];
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
