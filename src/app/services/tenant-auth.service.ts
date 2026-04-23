import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, Observable, tap, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TenantAuthService {
  private apiUrl = `${environment.tenantApiUrl}/login`;


  constructor(private http: HttpClient, private router: Router) { }

  login(email: string, password: string): Observable<any> {
    const body = { email, password };

    return this.http.post<any>(this.apiUrl, body).pipe(
      tap((response) => {
        if (response && response.accessToken) {

          // ✅ IMPORTANT: different key from admin
          localStorage.setItem('tenant_token', response.accessToken);

          if (response.user) {
            localStorage.setItem('tenant_user', JSON.stringify(response.user));
          }

        } else {
          console.warn('Tenant token not found in API response');
        }
      })
    );
  }

logout(): void {
  localStorage.removeItem('tenant_token');
  localStorage.removeItem('tenant_slug');
  localStorage.removeItem('tenant_user');

  this.router.navigate(['/tenant/login']);
}

  // ✅ Same reusable API call with auth
  postWithAuth<T>(url: string, body: any): Observable<T> {
    const token = localStorage.getItem('tenant_token');

    return this.http.post<T>(url, body, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }).pipe(
      catchError(err => {
        if (err.status === 401) {
          this.handleUnauthorized();
        }
        return throwError(() => err);
      })
    );
  }

  private handleUnauthorized() {
    this.logout();
  }
}
