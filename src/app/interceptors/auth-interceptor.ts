import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Auth } from '../services/auth';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private auth: Auth) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = this.auth.getToken();

    // Skip adding the header for login or register requests
    if (req.url.includes('/login') || req.url.includes('/register')) {
      return next.handle(req);
    }

    // Clone and add header only if token exists
    const authReq = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

    // ✅ Corrected method name: should be next.handle(req), not next.Handle(req)
    return next.handle(authReq);
  }
}
