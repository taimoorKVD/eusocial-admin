import { Component } from '@angular/core';
import { TenantUserService } from '../../../services/tenant-user.service';
import { Router } from '@angular/router';
import { inject } from '@angular/core';
import { TenantSessionService } from '../../../services/tenant-session.service';


@Component({
  selector: 'app-user-dashboard',
  standalone: false,
  templateUrl: './user-dashboard.component.html',
  styleUrl: './user-dashboard.component.scss'
})
export class UserDashboardComponent {
  readonly session = inject(TenantSessionService);
  private readonly tenantUserService = inject(TenantUserService);
  private readonly router = inject(Router);


  ngOnInit(): void {
    this.tenantUserService.getUsers().subscribe((users) => {
      console.log(users);
    });
  }

  goToPage(module: string): void {
    this.router.navigate(['/tenant', this.session.getSlug(), module, 'create']);
  }


}
