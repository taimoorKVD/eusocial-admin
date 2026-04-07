import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';

import { TenantRoutingModule } from './tenant-routing.module';
import { HomeComponent } from './home/home.component';
import { UserDashboardComponent } from './user-dashboard/user-dashboard.component';
import { SidebarComponent } from './sidebar/sidebar.component';
import { TopbarComponent } from './topbar/topbar.component';
import { UIShellModule, SideNavModule, IconModule } from 'carbon-components-angular';
import { TenantLayoutComponent } from './tenant-layout/tenant-layout.component';


@NgModule({
  declarations: [
    HomeComponent,
    UserDashboardComponent,
    SidebarComponent,
    TopbarComponent,
    TenantLayoutComponent
  ],
  imports: [
    CommonModule,
    TenantRoutingModule,
    UIShellModule,  // For header + layout
    SideNavModule,  // For ibm-side-nav-link
    IconModule      // For ibm icons
  ],
    schemas: [CUSTOM_ELEMENTS_SCHEMA] // optional, suppresses template errors

})
export class TenantModule { }
