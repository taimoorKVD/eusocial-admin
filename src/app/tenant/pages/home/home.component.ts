import { Component } from '@angular/core';
import { TenantUserService } from '../../../services/tenant-user.service';

@Component({
  selector: 'app-home',
  standalone: false,

  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {
  constructor(private tenantUserService: TenantUserService) {}
  ngOnInit(): void {
    this.tenantUserService.getUsers().subscribe((users) => {
      console.log(users);
    });
  }
}
