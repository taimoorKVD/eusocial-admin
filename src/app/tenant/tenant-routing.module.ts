import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { UserDashboardComponent } from './user-dashboard/user-dashboard.component';
import { Sidebar } from '../admin/sidebar/sidebar';
import { TopbarComponent } from './topbar/topbar.component';
import { TenantLayoutComponent } from './tenant-layout/tenant-layout.component';

const routes: Routes = [
  {
    path: '',                   // /tenant
    component: TenantLayoutComponent, // wrapper
    children: [
      { path: '', redirectTo: 'home', pathMatch: 'full' },
      { path: 'home', component: HomeComponent },           // /tenant/home
      { path: 'user-dashboard', component: UserDashboardComponent } // /tenant/user-dashboard
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class TenantRoutingModule { }
