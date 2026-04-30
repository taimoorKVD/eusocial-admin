import { HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { Router } from '@angular/router';
import { TenantSessionService } from '../services/tenant-session.service';
import { catchError, Observable, throwError } from 'rxjs';
import { Injectable } from '@angular/core';
import { ToastrService } from 'ngx-toastr';

// export const tenantAuthInterceptor: HttpInterceptorFn = (req, next) => {
//   return next(req);
// };

@Injectable()
export class TenantAuthInterceptor implements HttpInterceptor {

  constructor(
    private router: Router,
    // private session: TenantSessionService,
    private toastr: ToastrService,
  ) {}

  private isLoggingOut = false;

// intercept(req: HttpRequest<any>, next: HttpHandler) {

//   const token = localStorage.getItem('tenant_token');
//   const isLoginRequest = req.url.includes('/tenant/login');

//   let authReq = req;

//   // attach token
//   if (token && !isLoginRequest) {
//     authReq = req.clone({
//       setHeaders: {
//         Authorization: `Bearer ${token}`
//       }
//     });
//   }

//   return next.handle(authReq).pipe(
//     catchError((error: HttpErrorResponse) => {

//       // ✅ ONLY THIS CONDITION MATTERS
//       if (error.status === 401 && !this.isLoggingOut) {

//         this.isLoggingOut = true;

//         // clear session
//         localStorage.clear();

//         // redirect
//         this.router.navigate(['/tenant/login']);

//         // optional message
//         // alert('Session expired, please login again');\
//         this.toastr.error('Session expired');
//       }

//       return throwError(() => error);
//     })
//   );
// }
  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {

    const token = localStorage.getItem('tenant_token');
    const slug = localStorage.getItem('tenant_slug');

    const isLoginRequest = req.url.includes('/tenant/login');

    let authReq = req;

    // ✅ attach token + tenant slug
    if (token && !isLoginRequest) {
      authReq = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`,
          // 'X-Tenant-Slug': slug
        }
      });
    }

    return next.handle(authReq).pipe(
      catchError((error: HttpErrorResponse) => {

        const message = error?.error?.message || '';

        // 🔴 401 → always logout
        if (error.status === 401) {
          this.forceLogout('Session expired');
        }

        // 🔴 403 → smart handling
        else if (error.status === 403) {

          // tenant/session issue → logout
          if (
            message.includes('tenant') ||
            message.includes('authenticated')
          ) {
            this.forceLogout('Session invalid for this tenant');
          }
          else {
            // permission issue → no logout
            this.toastr.error('You do not have permission');
          }
        }

        return throwError(() => error);
      })
    );
  }

  // 🔥 central logout
  private forceLogout(msg: string) {

    if (this.isLoggingOut) return;

    this.isLoggingOut = true;

    localStorage.clear();

    this.toastr.error(msg);

    this.router.navigate(['/tenant/login']);
  }
}
