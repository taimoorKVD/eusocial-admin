import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TenantLayoutComponent } from './tenant-layout/tenant-layout.component';
import { HomeComponent } from './pages/home/home.component';
import { UserDashboardComponent } from './pages/user-dashboard/user-dashboard.component';
import { SetupUserComponent } from './pages/setup/setup-user/setup-user.component';
import { SetupJobPositionComponent } from './pages/setup/setup-job-position/setup-job-position.component';
import { TenantLoginComponent } from './tenant-login/tenant-login.component';
import { SetupVendorsComponent } from './pages/setup/setup-vendors/setup-vendors.component';

const routes: Routes = [

  // ✅ /tenant → /tenant/login
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  // ✅ /tenant/login
  { path: 'login', component: TenantLoginComponent },

  // ✅ /tenant/:slug/*
  {
    path: ':slug',
    component: TenantLayoutComponent,
    children: [

      // 🔥 IMPORTANT (default)
      { path: '', redirectTo: 'home', pathMatch: 'full' },

      { path: 'home', component: HomeComponent },
      { path: 'user-dashboard', component: UserDashboardComponent },
      { path: 'users', component: SetupUserComponent },
      { path: 'job-position', component: SetupJobPositionComponent },
      { path: 'vendor', component: SetupVendorsComponent },
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class TenantRoutingModule { }
