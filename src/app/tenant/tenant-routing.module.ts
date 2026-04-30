import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TenantLayoutComponent } from './tenant-layout/tenant-layout.component';
import { HomeComponent } from './pages/home/home.component';
import { UserDashboardComponent } from './pages/user-dashboard/user-dashboard.component';
// import { SetupUserComponent } from './pages/setup/setup-user/setup-user.component';
import { SetupJobPositionComponent } from './pages/setup/Job-Positions/setup-job-position/setup-job-position.component';
import { TenantLoginComponent } from './tenant-login/tenant-login.component';
import { SetupVendorsComponent } from './pages/setup/Vendor/setup-vendors/setup-vendors.component';
import { SetupItems } from './pages/setup/setup-items/setup-items';
import { SetupReportingGroup } from './pages/setup/setup-reporting-group/setup-reporting-group';
import { SetupUserComponent } from './pages/setup/Users/setup-user/setup-user.component';
import { SetupUsersListing } from './pages/setup/Users/setup-users-listing/setup-users-listing';
import { SetupJobPositionListingComponent } from './pages/setup/Job-Positions/setup-job-position-listing/setup-job-position-listing.component';
import { LocationComponent } from './pages/extra-management/location/location.component';
import { LocationListingComponent } from './pages/extra-management/location-listing/location-listing.component';

const routes: Routes = [

  // ✅ /tenant/login
  { path: 'login', component: TenantLoginComponent },
  {
    path: ':slug',
    component: TenantLayoutComponent,
    children: [
      { path: '', redirectTo: 'home', pathMatch: 'full' },
      { path: 'home', component: HomeComponent },
      { path: 'user-dashboard', component: UserDashboardComponent },

      { path: 'users', component: SetupUsersListing },
      { path: 'users/create', component: SetupUserComponent },
      { path: 'users/edit/:id', component: SetupUserComponent },

      { path: 'job-position', component: SetupJobPositionListingComponent },
      { path: 'job-position/create', component: SetupJobPositionComponent },
      { path: 'job-position/edit/:id', component: SetupJobPositionComponent },

      { path: 'vendor', component: SetupVendorsComponent },
      { path: 'vendor/create', component: SetupVendorsComponent },
      { path: 'vendor/edit/:id', component: SetupVendorsComponent },

      { path: 'item', component: SetupItems },
      { path: 'reporting-group', component: SetupReportingGroup },

      { path: 'location', component: LocationListingComponent },
      { path: 'location/create', component: LocationComponent },
      { path: 'location/edit/:id', component: LocationComponent },

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
