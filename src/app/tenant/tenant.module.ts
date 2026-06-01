import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; // ✅ IMPORTANT
import { NgSelectModule } from '@ng-select/ng-select';
import { ReactiveFormsModule } from '@angular/forms';
import { SharedModule } from '../shared/shared.module';


import { TenantRoutingModule } from './tenant-routing.module';
import { TenantLayoutComponent } from './tenant-layout/tenant-layout.component';
import { TenantSidebarComponent } from './tenant-sidebar/tenant-sidebar.component';
import { TenantTopbarComponent } from './tenant-topbar/tenant-topbar.component';
import { UserDashboardComponent } from './pages/user-dashboard/user-dashboard.component';
import { SetupJobPositionComponent } from './pages/setup/Job-Positions/setup-job-position/setup-job-position.component';
import { TenantLoginComponent } from './tenant-login/tenant-login.component';
import { SetupVendorsComponent } from './pages/setup/Vendor/setup-vendors/setup-vendors.component';
import { SetupItems } from './pages/setup/setup-items/setup-items';
import { SetupReportingGroup } from './pages/setup/setup-reporting-group/setup-reporting-group';
import { SetupUserComponent } from './pages/setup/Users/setup-user/setup-user.component';
import { SetupUsersListing } from './pages/setup/Users/setup-users-listing/setup-users-listing';
import { SetupJobPositionListingComponent } from './pages/setup/Job-Positions/setup-job-position-listing/setup-job-position-listing.component';
import { LocationComponent } from './pages/extra-management/location/location.component';
import { LocationListingComponent } from './pages/extra-management/location-listing/location-listing.component';
import { SetupVendorsListingComponent } from './pages/setup/Vendor/setup-vendors-listing/setup-vendors-listing.component';
import { TenantForgotPasswordComponent } from './tenant-forgot-password/tenant-forgot-password.component';
import { TenantResetPasswordComponent } from './tenant-reset-password/tenant-reset-password.component';
import { RoleComponent } from './pages/setup/Roles/role/role.component';
import { RoleListingComponent } from './pages/setup/Roles/role-listing/role-listing.component';
// import { FieldSettingsComponent } from './form-builder/field-settings/field-settings.component';
import { RouterModule } from '@angular/router';



@NgModule({
  declarations: [
    TenantLayoutComponent,
    TenantSidebarComponent,
    TenantTopbarComponent,
    UserDashboardComponent,
    SetupUserComponent,
    SetupUsersListing,
    SetupJobPositionComponent,
    SetupJobPositionListingComponent,
    TenantLoginComponent,
    TenantForgotPasswordComponent,
    TenantResetPasswordComponent,
    SetupVendorsComponent,
    SetupVendorsListingComponent,
    SetupItems,
    SetupReportingGroup,
    LocationComponent,
    LocationListingComponent,
    RoleComponent,
    RoleListingComponent,
    // FieldSettingsComponent

  ],
  imports: [
    CommonModule,
    TenantRoutingModule,
    FormsModule,
    NgSelectModule,
    ReactiveFormsModule,
    SharedModule,
    RouterModule
  ]
})
export class TenantModule { }
