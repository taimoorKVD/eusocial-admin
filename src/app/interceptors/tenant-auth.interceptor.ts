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
import { environment } from '../../environments/environment';
import { PortalService } from '../services/portal.service';

@Injectable()
export class TenantAuthInterceptor implements HttpInterceptor {

  constructor(
    private portal: PortalService,
    private router: Router,
    private toastr: ToastrService,
  ) {}

  private isLoggingOut = false;

  intercept(
    req: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {

    const isMasterApi = req.url.startsWith(environment.apiUrl);
    const isTenantApi =
      req.url.startsWith(environment.tenantApiUrl) && !isMasterApi;

    if (!isTenantApi) {
      return next.handle(req);
    }

    const token = localStorage.getItem('tenant_token');
    const tenantSlug =
      this.portal.tenantSlug || localStorage.getItem('tenant_slug');

    const isLoginRequest = /\/login(\?|$)/.test(req.url);

    const headers: Record<string, string> = {};

    if (tenantSlug) {
      headers['X-Tenant-Slug'] = tenantSlug;
    }

    if (token && !isLoginRequest) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const authReq =
      Object.keys(headers).length > 0
        ? req.clone({ setHeaders: headers })
        : req;

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

    localStorage.removeItem('tenant_token');
    localStorage.removeItem('tenant_slug');
    localStorage.removeItem('tenant_user');

    this.toastr.error(msg);

    this.router.navigate(['/login']);
  }
}
