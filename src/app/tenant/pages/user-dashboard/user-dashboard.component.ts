import { Component } from '@angular/core';
import { TenantUserService } from '../../../services/tenant-user.service';


@Component({
  selector: 'app-user-dashboard',
  standalone: false,

  templateUrl: './user-dashboard.component.html',
  styleUrl: './user-dashboard.component.scss'
})
export class UserDashboardComponent {
constructor(private tenantUserService: TenantUserService) {}

ngOnInit(): void {
  this.tenantUserService.getUsers().subscribe((users) => {
    console.log(users);
  });
}
}
