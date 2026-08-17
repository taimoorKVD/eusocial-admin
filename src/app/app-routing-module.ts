import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { Login } from './public/login/login';
import { Register } from './public/register/register';
import { ForgotPassword } from './public/forgot-password/forgot-password';
import { ResetPassword } from './public/reset-password/reset-password';
import { Public } from './public/public';

import { Admin } from './admin/admin';
import { Profile } from './admin/profile/profile';
import { Dashboard } from './admin/dashboard/dashboard';
import { Users } from './admin/users/users';
import { UserForm } from './admin/users/user-form/user-form';
import { Roles } from './admin/roles/roles';
import { RoleForm } from './admin/roles/role-form/role-form';
import { Products } from './admin/products/products';
import { ProductForm } from './admin/products/product-form/product-form';
import { Tenants } from './admin/tenants/tenants';
import { TenantForm } from './admin/tenants/tenant-form/tenant-form';
import { PermissionsComponent } from './admin/permissions/permissions.component';
import { PermissionsFormComponent } from './admin/permissions/permissions-form/permissions-form.component';

import { TenantPortalGuard } from './guards/tenant-portal.guard';
import { AdminPortalGuard } from './guards/admin-portal.guard';
import { AdminPublicGuard } from './guards/admin-public.guard';

const routes: Routes = [

  /*
   * ============================================================
   * ADMIN PORTAL
   *
   * admin.eusocial.thebetawebsite.com
   *
   * ============================================================
   */

  {
    path: '',
    children: [

      /*
       * Admin public pages
       *
       * /login
       * /register
       * /forgot-password
       * /reset-password
       */
      {
        path: '',
        component: Public,
        canActivate: [AdminPublicGuard],
        children: [
          {
            path: '',
            redirectTo: 'login',
            pathMatch: 'full',
          },
          {
            path: 'login',
            component: Login,
          },
          {
            path: 'register',
            component: Register,
          },
          {
            path: 'forgot-password',
            component: ForgotPassword,
          },
          {
            path: 'reset-password',
            component: ResetPassword,
          },
        ],
      },

      /*
       * Admin application
       */
      {
        path: '',
        component: Admin,
        canActivate: [AdminPortalGuard],
        children: [

          {
            path: 'dashboard',
            component: Dashboard,
          },

          {
            path: 'profile',
            component: Profile,
          },

          /*
           * Users
           */
          {
            path: 'users',
            component: Users,
          },
          {
            path: 'users/create',
            component: UserForm,
          },
          {
            path: 'users/:id/edit',
            component: UserForm,
          },

          /*
           * Roles
           */
          {
            path: 'roles',
            component: Roles,
          },
          {
            path: 'roles/create',
            component: RoleForm,
          },
          {
            path: 'roles/:id/edit',
            component: RoleForm,
          },

          /*
           * Permissions
           */
          {
            path: 'permissions',
            component: PermissionsComponent,
          },
          {
            path: 'permissions/create',
            component: PermissionsFormComponent,
          },
          {
            path: 'permissions/:id/edit',
            component: PermissionsFormComponent,
          },

          /*
           * Products
           */
          {
            path: 'products',
            children: [
              {
                path: '',
                component: Products,
              },
              {
                path: 'create',
                component: ProductForm,
              },
              {
                path: ':id/edit',
                component: ProductForm,
              },
            ],
          },

          /*
           * Tenants
           */
          {
            path: 'tenants',
            children: [
              {
                path: '',
                component: Tenants,
              },
              {
                path: 'create',
                component: TenantForm,
              },
              {
                path: ':id/edit',
                component: TenantForm,
              },
            ],
          },

        ],
      },

    ],
  },

  /*
   * ============================================================
   * TENANT PORTAL
   *
   * The hostname determines the tenant.
   *
   * tenant1.eusocial.thebetawebsite.com
   * folio3.eusocial.thebetawebsite.com
   *
   * TenantModule now owns:
   *
   * /login
   * /user-dashboard
   * /users
   * /roles
   * /profile
   * /forms
   * etc.
   *
   * ============================================================
   */

  {
    path: '',
    canActivate: [TenantPortalGuard],
    children: [
      {
        path: '',
        loadChildren: () =>
          import('./tenant/tenant.module').then(
            (m) => m.TenantModule,
          ),
      },
    ],
  },

  /*
   * ============================================================
   * FALLBACK
   * ============================================================
   */

  {
    path: '**',
    redirectTo: 'login',
  },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      scrollPositionRestoration: 'enabled',
    }),
  ],
  exports: [
    RouterModule,
  ],
})
export class AppRoutingModule {}
