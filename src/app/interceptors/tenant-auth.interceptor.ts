import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, Observable, throwError } from 'rxjs';
import { Injectable } from '@angular/core';
import { ToastrService } from 'ngx-toastr';

@Injectable()
export class TenantAuthInterceptor implements HttpInterceptor {

  constructor(
    private router: Router,
    private toastr: ToastrService,
  ) {}

  private isLoggingOut = false;

  intercept(
    req: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {

    const token = localStorage.getItem('tenant_token');
    const storedSlug = localStorage.getItem('tenant_slug');

    const hostname = window.location.hostname;

    // Derive tenant from the current frontend hostname.
    //
    // folio3.eusocial.thebetawebsite.com
    //                ↓
    //              folio3
    //
    const baseDomain = '.eusocial.thebetawebsite.com';

    let tenantSlug = storedSlug;

    if (hostname.endsWith(baseDomain)) {
      const subdomain = hostname.slice(
        0,
        -baseDomain.length
      );

      if (
        subdomain &&
        subdomain !== 'www' &&
        subdomain !== 'admin'
      ) {
        tenantSlug = subdomain.toLowerCase();
      }
    }

    const isLoginRequest = /\/login(\?|$)/.test(req.url);

    let authReq = req;

    const headers: Record<string, string> = {};

    // Attach tenant to API requests.
    if (tenantSlug) {
      headers['X-Tenant-Slug'] = tenantSlug;
    }

    // Attach tenant JWT after login.
    if (token && !isLoginRequest) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (Object.keys(headers).length > 0) {
      authReq = req.clone({
        setHeaders: headers,
      });
    }

    return next.handle(authReq).pipe(
      catchError((error: HttpErrorResponse) => {

        const message = error?.error?.message || '';

        if (token && !isLoginRequest) {

          if (error.status === 401) {
            this.forceLogout('Session expired');
          }

          else if (error.status === 403) {

            if (
              message.toLowerCase().includes('tenant') ||
              message.toLowerCase().includes('authenticated')
            ) {
              this.forceLogout('Session invalid for this tenant');
            } else {
              this.toastr.error('You do not have permission');
            }
          }
        }

        return throwError(() => error);
      })
    );
  }

  private forceLogout(msg: string) {

    if (this.isLoggingOut) return;

    this.isLoggingOut = true;

    localStorage.clear();

    this.toastr.error(msg);

    this.router.navigate(['/login']);
  }
}
