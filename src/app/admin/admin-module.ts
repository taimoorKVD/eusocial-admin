import { NgModule } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';

import { AdminRoutingModule } from './admin-routing-module';
import { SharedModule } from '../shared/shared.module';
import { Navbar } from './navbar/navbar';
import { Sidebar } from './sidebar/sidebar';
import { Dashboard } from './dashboard/dashboard';
import { Admin } from './admin';
import { Profile } from './profile/profile';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { Users } from './users/users';
import { UserForm } from './users/user-form/user-form';
import { Roles } from './roles/roles';
import { RoleForm } from './roles/role-form/role-form';
import { Products } from './products/products';
import { ProductForm } from './products/product-form/product-form';
import { Tenants } from './tenants/tenants';
import { TenantForm } from './tenants/tenant-form/tenant-form';
import { TenantView } from './tenants/tenant-view/tenant-view';
import { PermissionsComponent } from './permissions/permissions.component';
import { PermissionsFormComponent } from './permissions/permissions-form/permissions-form.component';
import { Plans } from './plans/plans';
import { PlanForm } from './plans/plan-form/plan-form';
import { PlanView } from './plans/plan-view/plan-view';
import { Subscriptions } from './subscriptions/subscriptions';
import { SubscriptionView } from './subscriptions/subscription-view/subscription-view';
import { Invoices } from './invoices/invoices';
import { InvoiceView } from './invoices/invoice-view/invoice-view';

@NgModule({
  declarations: [
    Navbar,
    Sidebar,
    Dashboard,
    Admin,
    Profile,
    Users,
    UserForm,
    Roles,
    RoleForm,
    Products,
    ProductForm,
    Tenants,
    TenantForm,
    TenantView,
    PermissionsComponent,
    PermissionsFormComponent,
    Plans,
    PlanForm,
    PlanView,
    Subscriptions,
    SubscriptionView,
    Invoices,
    InvoiceView,
  ],
  imports: [
    CommonModule,
    AdminRoutingModule,
    ReactiveFormsModule,
    FormsModule,
    SharedModule,
    NgSelectModule,
  ],
  exports: [Admin],
  providers: [
    DatePipe, // ✅ For date: pipe usage
  ],
})
export class AdminModule {}
