import { HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { Router } from '@angular/router';
import { TenantSessionService } from '../services/tenant-session.service';
import { catchError, Observable, throwError } from 'rxjs';
import { Injectable } from '@angular/core';

// export const tenantAuthInterceptor: HttpInterceptorFn = (req, next) => {
//   return next(req);
// };

@Injectable()
export class TenantAuthInterceptor implements HttpInterceptor {

  constructor(
    private router: Router,
    private session: TenantSessionService
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler) {

    const token = localStorage.getItem('tenant_token');

    const isLoginRequest = req.url.includes('/login');

    let authReq = req;

    // ✅ attach token except login
    if (token && !isLoginRequest) {
      authReq = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });
    }

    return next.handle(authReq).pipe(
      catchError((error: HttpErrorResponse) => {

        // 🔥 AUTO LOGOUT
        if (error.status === 401 && !isLoginRequest) {

          localStorage.removeItem('tenant_token');
          localStorage.removeItem('tenant_slug');
          localStorage.removeItem('tenant_user');

          this.router.navigate(['/tenant/login']);
        }

        return throwError(() => error);
      })
    );
  }
}
