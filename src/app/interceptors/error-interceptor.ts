import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpHandler,
  HttpRequest,
  HttpEvent,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { Auth } from '../services/auth';

@Injectable()
export class ErrorInterceptor implements HttpInterceptor {
  constructor(private router: Router, private auth: Auth) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        // ⚠️ Handle Unauthorized (401)
        if (error.status === 401) {
          console.warn('401 Unauthorized → logging out...');
          this.auth.logout(); // clears user + redirects
        }

        // Optionally handle other errors
        if (error.status >= 500) {
          console.error('Server error:', error.message);
        }

        return throwError(() => error);
      })
    );
  }
}
