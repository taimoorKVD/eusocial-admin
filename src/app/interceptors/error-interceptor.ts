import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpHandler,
  HttpRequest,
  HttpEvent,
  HttpErrorResponse,
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { Auth } from '../services/auth';
import { environment } from '../../environments/environment';

@Injectable()
export class ErrorInterceptor implements HttpInterceptor {
  constructor(private router: Router, private auth: Auth) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const isMasterApi = req.url.startsWith(environment.apiUrl);

    // Tenant 401/403 is handled by TenantAuthInterceptor. Logging out the
    // admin session on a tenant permission error navigates to /login while
    // the tenant token is still present, which re-triggers tenant preloads.
    if (!isMasterApi) {
      return next.handle(req);
    }

    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {

        if ([401, 403].includes(error.status)) {
          console.warn(`${error.status} → logging out user`);
          this.auth.logout();
        }

        // Optionally handle server errors
        if (error.status >= 500) {
          console.error('Server error:', error.message);
        }

        return throwError(() => error);
      })
    );
  }
}
