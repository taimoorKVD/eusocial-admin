import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Public } from './public';
import { Login } from './login/login';
import { Register } from './register/register';
import { AdminRoutingModule } from "../admin/admin-routing-module";
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';



@NgModule({
  declarations: [
    Public,
    Login,
    Register
  ],
  imports: [
    CommonModule,
    AdminRoutingModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule
]
})
export class PublicModule { }
