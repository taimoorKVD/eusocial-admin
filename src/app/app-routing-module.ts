import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { Login } from './public/login/login';
import { Register } from './public/register/register';
import { Public } from './public/public';
import { Admin } from './admin/admin';
import { Profile } from './admin/profile/profile';
import { AuthGuard } from './guards/auth-guard';
import { Dashboard } from './admin/dashboard/dashboard';
import { Users } from './admin/users/users';
import { UserForm } from './admin/users/user-form/user-form';
import { Roles } from './admin/roles/roles';
import { RoleForm } from './admin/roles/role-form/role-form';
import { Products } from './admin/products/products';
import { ProductForm } from './admin/products/product-form/product-form';
import { Tenants } from './admin/tenants/tenants';
// import { Tenants } from './admin/tenants/tenants';
import { TenantForm } from './admin/tenants/tenant-form/tenant-form';

const routes: Routes = [
  // ✅ Protected root (dashboard)
  {
    path: '',
    component: Admin, // main layout
    // canActivate: [AuthGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }, // ✅ main dashboard
      { path: 'dashboard', component: Dashboard }, // ✅ main dashboard
      { path: 'profile', component: Profile }, // protected profile page

      { path: 'users', component: Users },
      { path: 'users/create', component: UserForm },
      { path: 'users/:id/edit', component: UserForm },

      { path: 'roles', component: Roles },
      { path: 'roles/create', component: RoleForm },
      { path: 'roles/:id/edit', component: RoleForm },

      {
        path: 'products',
        children: [
          { path: '', component: Products },
          { path: 'create', component: ProductForm },
          { path: ':id/edit', component: ProductForm },
        ],
      },
      {
        path: 'tenants',
        children: [
          { path: '', component: Tenants },
          { path: 'create', component: TenantForm },
          { path: ':id/edit', component: TenantForm },
        ],
      },
    ],
  },

    {
    path: 'tenant',
    loadChildren: () =>
      import('./tenant/tenant.module').then(m => m.TenantModule)
  },

  // ✅ Public routes (login/register)
  {
    path: '',
    component: Public,
    children: [
      { path: 'login', component: Login },
      { path: 'register', component: Register },
    ],
  },

  // ✅ Wildcard (catch-all)
  { path: '**', redirectTo: 'login' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { scrollPositionRestoration: 'enabled' })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
