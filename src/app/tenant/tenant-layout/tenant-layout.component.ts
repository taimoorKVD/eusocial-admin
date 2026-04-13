import { Component } from '@angular/core';


@Component({
  selector: 'app-tenant-layout',
  standalone: false,

  templateUrl: './tenant-layout.component.html',
  styleUrl: './tenant-layout.component.scss'
})
export class TenantLayoutComponent {
  sidebarOpen = false;

  toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen;
  }
}
