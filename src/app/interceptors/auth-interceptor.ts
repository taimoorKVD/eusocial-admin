import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { Auth } from '../services/auth';
import { environment } from '../../environments/environment';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private auth: Auth) {}

  intercept(
    req: HttpRequest<any>,
    next: HttpHandler,
  ): Observable<HttpEvent<any>> {

    // Only attach the admin token to master API calls.
    // Tenant API (local and production) is handled by TenantAuthInterceptor.
    if (!req.url.startsWith(environment.apiUrl)) {
      return next.handle(req);
    }

    const token = this.auth.getToken();

    // Don't attach admin token to login/register requests.
    if (req.url.includes('/login') || req.url.includes('/register')) {
      return next.handle(req);
    }

    const authReq = token
      ? req.clone({
          setHeaders: {
            Authorization: `Bearer ${token}`,
          },
        })
      : req;

    return next.handle(authReq);
  }
}
