import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TenantLayoutComponent } from './tenant-layout/tenant-layout.component';
import { HomeComponent } from './pages/home/home.component';
import { UserDashboardComponent } from './pages/user-dashboard/user-dashboard.component';

const routes: Routes = [
  {
    path: '',
    component: TenantLayoutComponent,
    children: [
      { path: 'home', component: HomeComponent },
      { path: 'user-dashboard', component: UserDashboardComponent },
      { path: '', redirectTo: 'home', pathMatch: 'full' },
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class TenantRoutingModule { }
