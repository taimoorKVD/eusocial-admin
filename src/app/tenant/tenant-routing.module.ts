import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TenantLayoutComponent } from './tenant-layout/tenant-layout.component';
import { HomeComponent } from './pages/home/home.component';
import { UserDashboardComponent } from './pages/user-dashboard/user-dashboard.component';
import { EmployeeDashboardComponent } from './pages/employee/employee-dashboard/employee-dashboard.component';
import { EmployeeMyFormsComponent } from './pages/employee/employee-my-forms/employee-my-forms.component';
import { EmployeeAssignmentComponent } from './pages/employee/employee-assignment/employee-assignment.component';
import { EmployeeHistoryComponent } from './pages/employee/employee-history/employee-history.component';
// import { SetupUserComponent } from './pages/setup/setup-user/setup-user.component';
import { SetupJobPositionComponent } from './pages/setup/Job-Positions/setup-job-position/setup-job-position.component';
import { TenantLoginComponent } from './tenant-login/tenant-login.component';
import { SetupVendorComponent } from './pages/setup/Vendor/setup-vendor/setup-vendor.component';
import { SetupReportingGroup } from './pages/setup/setup-reporting-group/setup-reporting-group';
import { SetupItemsListing } from './pages/setup/Items/setup-items-listing/setup-items-listing';
import { SetupItemComponent } from './pages/setup/Items/setup-item/setup-item.component';
import { SetupUserComponent } from './pages/setup/Users/setup-user/setup-user.component';
import { SetupUsersListing } from './pages/setup/Users/setup-users-listing/setup-users-listing';
import { SetupJobPositionListingComponent } from './pages/setup/Job-Positions/setup-job-position-listing/setup-job-position-listing.component';
import { LocationComponent } from './pages/extra-management/location/location.component';
import { LocationListingComponent } from './pages/extra-management/location-listing/location-listing.component';
import { tenantAuthGuard } from '../guards/tenant-auth-guard';
import {
  tenantAdminGuard,
  tenantEmployeeGuard,
  tenantHomeRedirectGuard,
} from '../guards/tenant-role.guard';
import { SetupVendorsListing } from './pages/setup/Vendor/setup-vendors-listing/setup-vendors-listing';
import { TenantForgotPasswordComponent } from './tenant-forgot-password/tenant-forgot-password.component';
import { TenantResetPasswordComponent } from './tenant-reset-password/tenant-reset-password.component';
import { RoleComponent } from './pages/setup/Roles/role/role.component';
import { RoleListingComponent } from './pages/setup/Roles/role-listing/role-listing.component';
import { TenantProfileComponent } from './pages/profile/tenant-profile.component';

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
      {
        path: '',
        pathMatch: 'full',
        canActivate: [tenantHomeRedirectGuard],
        component: UserDashboardComponent,
      },

      { path: 'profile', component: TenantProfileComponent },

      {
        path: '',
        canActivate: [tenantAdminGuard],
        children: [
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

          { path: 'vendors', component: SetupVendorsListing },
          { path: 'vendors/create', component: SetupVendorComponent },
          { path: 'vendors/edit/:id', component: SetupVendorComponent },

          { path: 'items', component: SetupItemsListing },
          { path: 'items/create', component: SetupItemComponent },
          { path: 'items/edit/:id', component: SetupItemComponent },

          { path: 'reporting-group', component: SetupReportingGroup },

          { path: 'location', component: LocationListingComponent },
          { path: 'location/create', component: LocationComponent },
          { path: 'location/edit/:id', component: LocationComponent },

          {
            path: 'dynamic-forms',
            loadChildren: () =>
              import('./pages/extra-management/forms/forms.routes').then(
                (m) => m.DYNAMIC_FORMS_ROUTES,
              ),
          },

          {
            path: 'forms',
            loadChildren: () =>
              import('./forms/forms-module').then((m) => m.FormsModule),
          },
        ],
      },

      {
        path: '',
        canActivate: [tenantEmployeeGuard],
        children: [
          { path: 'employee-dashboard', component: EmployeeDashboardComponent },
          { path: 'my-forms', component: EmployeeMyFormsComponent },
          { path: 'my-forms/:id', component: EmployeeAssignmentComponent },
          { path: 'history', component: EmployeeHistoryComponent },
        ],
      },
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
