import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; // ✅ IMPORTANT


import { TenantRoutingModule } from './tenant-routing.module';
import { TenantLayoutComponent } from './tenant-layout/tenant-layout.component';
import { TenantSidebarComponent } from './tenant-sidebar/tenant-sidebar.component';
import { TenantTopbarComponent } from './tenant-topbar/tenant-topbar.component';
import { UserDashboardComponent } from './pages/user-dashboard/user-dashboard.component';


@NgModule({
  declarations: [
    TenantLayoutComponent,
    TenantSidebarComponent,
    TenantTopbarComponent,
    UserDashboardComponent
  ],
  imports: [
    CommonModule,
    TenantRoutingModule,
    FormsModule
  ]
})
export class TenantModule { }
