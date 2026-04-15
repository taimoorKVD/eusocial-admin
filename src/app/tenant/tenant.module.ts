import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; // ✅ IMPORTANT
import { NgSelectModule } from '@ng-select/ng-select';
import { ReactiveFormsModule } from '@angular/forms';


import { TenantRoutingModule } from './tenant-routing.module';
import { TenantLayoutComponent } from './tenant-layout/tenant-layout.component';
import { TenantSidebarComponent } from './tenant-sidebar/tenant-sidebar.component';
import { TenantTopbarComponent } from './tenant-topbar/tenant-topbar.component';
import { UserDashboardComponent } from './pages/user-dashboard/user-dashboard.component';
import { SetupUserComponent } from './pages/setup/setup-user/setup-user.component';
import { SetupJobPositionComponent } from './pages/setup/setup-job-position/setup-job-position.component';
import { TenantLoginComponent } from './tenant-login/tenant-login.component';
import { SetupVendorsComponent } from './pages/setup/setup-vendors/setup-vendors.component';



@NgModule({
  declarations: [
    TenantLayoutComponent,
    TenantSidebarComponent,
    TenantTopbarComponent,
    UserDashboardComponent,
    SetupUserComponent,
    SetupJobPositionComponent,
    TenantLoginComponent,
    SetupVendorsComponent
  ],
  imports: [
    CommonModule,
    TenantRoutingModule,
    FormsModule,
    NgSelectModule,
    ReactiveFormsModule
  ]
})
export class TenantModule { }
