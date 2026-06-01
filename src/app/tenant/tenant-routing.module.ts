import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TenantLayoutComponent } from './tenant-layout/tenant-layout.component';
import { HomeComponent } from './pages/home/home.component';
import { UserDashboardComponent } from './pages/user-dashboard/user-dashboard.component';
// import { SetupUserComponent } from './pages/setup/setup-user/setup-user.component';
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
import { tenantAuthGuard } from '../guards/tenant-auth-guard';
import { SetupVendorsListingComponent } from './pages/setup/Vendor/setup-vendors-listing/setup-vendors-listing.component';
import { TenantForgotPasswordComponent } from './tenant-forgot-password/tenant-forgot-password.component';
import { TenantResetPasswordComponent } from './tenant-reset-password/tenant-reset-password.component';
import { RoleComponent } from './pages/setup/Roles/role/role.component';
import { RoleListingComponent } from './pages/setup/Roles/role-listing/role-listing.component';
import { BuilderComponent } from './form-builder/components/builder/builder.component';

const routes: Routes = [

  // ✅ /tenant/login
  { path: 'login', component: TenantLoginComponent },
  { path: 'forgot-password', component: TenantForgotPasswordComponent },
  { path: 'reset-password', component: TenantResetPasswordComponent },
  // ✅ legacy URL support: /tenant/:slug/login -> /tenant/login
  { path: ':slug/login', redirectTo: '/tenant/login', pathMatch: 'full' },
  {
    path: ':slug',
    component: TenantLayoutComponent,
    canActivate: [tenantAuthGuard],
    canActivateChild: [tenantAuthGuard],
    children: [
      { path: '', redirectTo: 'home', pathMatch: 'full' },
      { path: 'home', component: HomeComponent },
      { path: 'user-dashboard', component: UserDashboardComponent },

      { path: 'users', component: SetupUsersListing },
      { path: 'users/create', component: SetupUserComponent },
      { path: 'users/edit/:id', component: SetupUserComponent },

      { path: 'roles', component: RoleListingComponent },
      { path: 'roles/create', component: RoleComponent },
      { path: 'roles/edit/:id', component: RoleComponent },

      { path: 'job-position', component: SetupJobPositionListingComponent },
      { path: 'job-position/create', component: SetupJobPositionComponent },
      { path: 'job-position/edit/:id', component: SetupJobPositionComponent },

      { path: 'vendors', component: SetupVendorsListingComponent },
      { path: 'vendors/create', component: SetupVendorsComponent },
      { path: 'vendors/edit/:id', component: SetupVendorsComponent },

      { path: 'item', component: SetupItems },
      { path: 'reporting-group', component: SetupReportingGroup },

      { path: 'location', component: LocationListingComponent },
      { path: 'location/create', component: LocationComponent },
      { path: 'location/edit/:id', component: LocationComponent },


      { path: 'form-builder', component: BuilderComponent },

    ]
  },
    // fallback
  { path: '**', redirectTo: '/tenant/login' }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class TenantRoutingModule { }
