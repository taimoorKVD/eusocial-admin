import { NgModule } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';

import { AdminRoutingModule } from './admin-routing-module';
import { Navbar } from './navbar/navbar';
import { Sidebar } from './sidebar/sidebar';
import { Dashboard } from './dashboard/dashboard';
import { Admin } from './admin';
import { Profile } from './profile/profile';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Users } from './users/users';
import { UserForm } from './users/user-form/user-form';
import { Roles } from './roles/roles';
import { RoleForm } from './roles/role-form/role-form';
import { Products } from './products/products';
import { ProductForm } from './products/product-form/product-form';


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
    ProductForm
  ],
  imports: [
    CommonModule,
    AdminRoutingModule,
    ReactiveFormsModule,
    FormsModule
  ],
  exports: [
    Admin
  ],
   providers: [
    DatePipe,               // ✅ For date: pipe usage
  ]
})
export class AdminModule { }
