import { NgModule, provideBrowserGlobalErrorListeners } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing-module';
import { App } from './app';
import { AdminModule } from './admin/admin-module';
import { PublicModule } from './public/public-module';
import { HTTP_INTERCEPTORS, HttpClientModule, provideHttpClient } from '@angular/common/http';
import { AuthInterceptor } from './interceptors/auth-interceptor';
import { ErrorInterceptor } from './interceptors/error-interceptor';
import { TenantAuthInterceptor } from './interceptors/tenant-auth.interceptor';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ToastrModule } from 'ngx-toastr';
import { FormBuilderModule } from './tenant/form-builder/form-builder-module';


@NgModule({
  declarations: [
    App,
  ],
  imports: [
    BrowserModule,
    FormBuilderModule,
    AppRoutingModule,
    AdminModule,
    HttpClientModule,
    PublicModule,
    BrowserAnimationsModule, // ✅ REQUIRED
    ToastrModule.forRoot({
      positionClass: 'toast-top-right',
      timeOut: 3000,
      closeButton: true,
      progressBar: true
    })
  ],
  providers: [
    provideBrowserGlobalErrorListeners(),
    // provideHttpClient(),
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: TenantAuthInterceptor, multi: true },
  ],
  bootstrap: [App]
})
export class AppModule { }
