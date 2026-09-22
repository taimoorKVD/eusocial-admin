import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { TenantLayoutComponent } from './tenant-layout/tenant-layout.component';
import { HomeComponent } from './pages/home/home.component';
import { UserDashboardComponent } from './pages/user-dashboard/user-dashboard.component';

import { EmployeeMyFormsComponent } from './pages/employee/employee-my-forms/employee-my-forms.component';
import { EmployeeAssignmentComponent } from './pages/employee/employee-assignment/employee-assignment.component';
import { EmployeeHistoryComponent } from './pages/employee/employee-history/employee-history.component';
import { EmployeeHistoryDetailComponent } from './pages/employee/employee-history/employee-history-detail.component';
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
import { permissionGuard } from '../guards/permission.guard';
import { SetupVendorsListing } from './pages/setup/Vendor/setup-vendors-listing/setup-vendors-listing';

import { TenantForgotPasswordComponent } from './tenant-forgot-password/tenant-forgot-password.component';
import { TenantResetPasswordComponent } from './tenant-reset-password/tenant-reset-password.component';

import { RoleComponent } from './pages/setup/Roles/role/role.component';
import { RoleListingComponent } from './pages/setup/Roles/role-listing/role-listing.component';
import { TenantProfileComponent } from './pages/profile/tenant-profile.component';
import { PERMISSIONS } from '../constants/permissions';

/**
 * Route groups under the authenticated tenant layout:
 *
 * 1. Shared reusable features — permissionGuard only (any account_type)
 * 2. Tenant-admin experience — tenantAdminGuard (+ permissions where set)
 * 3. Employee experience — tenantEmployeeGuard (+ permissions where set)
 *
 * account_type selects portal experience; permissions gate feature access.
 */
const routes: Routes = [
  {
    path: 'login',
    component: TenantLoginComponent,
  },
  {
    path: 'forgot-password',
    component: TenantForgotPasswordComponent,
  },
  {
    path: 'reset-password',
    component: TenantResetPasswordComponent,
  },
  {
    path: '',
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
      { path: 'user-dashboard', component: UserDashboardComponent },
      { path: 'employee-dashboard', redirectTo: 'user-dashboard', pathMatch: 'full' },

      /*
       * Reusable features: Users, Items, Vendors, Locations, Form Templates.
       * Accessible to tenant_admin and tenant_user when permissions allow.
       */
      {
        path: '',
        children: [
          {
            path: 'users',
            component: SetupUsersListing,
            canActivate: [permissionGuard],
            data: { permission: PERMISSIONS.USERS.VIEW },
          },
          {
            path: 'users/create',
            component: SetupUserComponent,
            canActivate: [permissionGuard],
            data: { permission: PERMISSIONS.USERS.CREATE },
          },
          {
            path: 'users/edit/:id',
            component: SetupUserComponent,
            canActivate: [permissionGuard],
            data: { permission: PERMISSIONS.USERS.EDIT },
          },

          {
            path: 'vendors',
            component: SetupVendorsListing,
            canActivate: [permissionGuard],
            data: { permission: PERMISSIONS.VENDORS.VIEW },
          },
          {
            path: 'vendors/create',
            component: SetupVendorComponent,
            canActivate: [permissionGuard],
            data: { permission: PERMISSIONS.VENDORS.CREATE },
          },
          {
            path: 'vendors/edit/:id',
            component: SetupVendorComponent,
            canActivate: [permissionGuard],
            data: { permission: PERMISSIONS.VENDORS.EDIT },
          },

          {
            path: 'items',
            component: SetupItemsListing,
            canActivate: [permissionGuard],
            data: { permission: PERMISSIONS.ITEMS.VIEW },
          },
          {
            path: 'items/create',
            component: SetupItemComponent,
            canActivate: [permissionGuard],
            data: { permission: PERMISSIONS.ITEMS.CREATE },
          },
          {
            path: 'items/edit/:id',
            component: SetupItemComponent,
            canActivate: [permissionGuard],
            data: { permission: PERMISSIONS.ITEMS.EDIT },
          },

          {
            path: 'location',
            component: LocationListingComponent,
            canActivate: [permissionGuard],
            data: { permission: PERMISSIONS.LOCATIONS.VIEW },
          },
          {
            path: 'location/create',
            component: LocationComponent,
            canActivate: [permissionGuard],
            data: { permission: PERMISSIONS.LOCATIONS.CREATE },
          },
          {
            path: 'location/edit/:id',
            component: LocationComponent,
            canActivate: [permissionGuard],
            data: { permission: PERMISSIONS.LOCATIONS.EDIT },
          },

          {
            path: 'dynamic-forms',
            loadChildren: () =>
              import('./pages/extra-management/forms/forms.routes').then(
                (m) => m.DYNAMIC_FORMS_ROUTES,
              ),
          },
        ],
      },

      /*
       * Tenant Admin experience-only features.
       */
      {
        path: '',
        canActivate: [tenantAdminGuard],
        children: [
          { path: 'home', component: HomeComponent },

          {
            path: 'roles',
            component: RoleListingComponent,
            canActivate: [permissionGuard],
            data: { permission: PERMISSIONS.ROLES.VIEW },
          },
          {
            path: 'roles/create',
            component: RoleComponent,
            canActivate: [permissionGuard],
            data: { permission: PERMISSIONS.ROLES.CREATE },
          },
          {
            path: 'roles/edit/:id',
            component: RoleComponent,
            canActivate: [permissionGuard],
            data: { permission: PERMISSIONS.ROLES.EDIT },
          },

          {
            path: 'job-position',
            component: SetupJobPositionListingComponent,
            canActivate: [permissionGuard],
            data: { permission: PERMISSIONS.JOB_POSITIONS.VIEW },
          },
          {
            path: 'job-position/create',
            component: SetupJobPositionComponent,
            canActivate: [permissionGuard],
            data: { permission: PERMISSIONS.JOB_POSITIONS.CREATE },
          },
          {
            path: 'job-position/edit/:id',
            component: SetupJobPositionComponent,
            canActivate: [permissionGuard],
            data: { permission: PERMISSIONS.JOB_POSITIONS.EDIT },
          },

          {
            path: 'reporting-group',
            component: SetupReportingGroup,
            canActivate: [permissionGuard],
            data: { permission: PERMISSIONS.REPORTING_GROUPS.VIEW },
          },

          {
            path: 'forms',
            canActivate: [permissionGuard],
            data: {
              anyPermission: [
                PERMISSIONS.FORM_BUILDER.VIEW,
                PERMISSIONS.FORM_BUILDER.CREATE,
                PERMISSIONS.FORM_BUILDER.EDIT,
              ],
            },
            loadChildren: () =>
              import('./forms/forms-module').then((m) => m.FormsModule),
          },

          {
            path: 'assigned-forms',
            loadComponent: () =>
              import('./pages/assigned-forms/assigned-forms.component').then(
                (m) => m.AssignedFormsComponent,
              ),
          },
          {
            path: 'assigned-forms/:id',
            loadComponent: () =>
              import('./pages/assigned-forms/assigned-form-view.component').then(
                (m) => m.AssignedFormViewComponent,
              ),
          },
        ],
      },

      /*
       * Employee experience-only features.
       */
      {
        path: '',
        canActivate: [tenantEmployeeGuard],
        children: [
          {
            path: 'my-forms',
            component: EmployeeMyFormsComponent,
            canActivate: [permissionGuard],
            data: { permission: PERMISSIONS.DATA_COLLECTION.VIEW_ASSIGNMENT },
          },
          {
            path: 'my-forms/:id',
            component: EmployeeAssignmentComponent,
            canActivate: [permissionGuard],
            data: {
              anyPermission: [
                PERMISSIONS.DATA_COLLECTION.VIEW_ASSIGNMENT,
                PERMISSIONS.DATA_COLLECTION.COMPLETE_ASSIGNMENT,
                PERMISSIONS.DATA_COLLECTION.VIEW_SUBMISSION,
              ],
            },
          },
          {
            path: 'history',
            component: EmployeeHistoryComponent,
          },
          {
            path: 'history/:id',
            component: EmployeeHistoryDetailComponent,
          },
        ],
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'login',
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TenantRoutingModule {}
