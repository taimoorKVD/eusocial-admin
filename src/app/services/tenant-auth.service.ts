import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, Observable, tap, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TenantAuthService {
  private apiUrl = `${environment.tenantApiUrl}`;


  constructor(private http: HttpClient, private router: Router) { }

  login(email: string, password: string, slug?: string): Observable<any> {
    const normalizedSlug = slug?.trim();
    const body: { email: string; password: string; tenant_slug?: string } = {
      email,
      password,
      ...(normalizedSlug ? { tenant_slug: normalizedSlug } : {})
    };

    return this.http.post<any>(`${this.apiUrl}/login`, body, {
      headers: normalizedSlug ? { 'X-Tenant-Slug': normalizedSlug } : {}
    }).pipe(
      tap((response) => {
        if (response && response.accessToken) {

          localStorage.setItem('tenant_token', response.accessToken);

          // ✅ FIX: store slug
          if (response.tenant_slug) {
            localStorage.setItem('tenant_slug', response.tenant_slug);
          }

          if (response.user) {
            localStorage.setItem('tenant_user', JSON.stringify(response.user));
          }

        } else {
          console.warn('Tenant token not found in API response');
        }
      })
    );
  }

  forgotPassword(email: string): Observable<any> {
    const slug = this.extractTenantSlugFromEmail(email);
    const body: { email: string; tenant_slug?: string } = {
      email,
      ...(slug ? { tenant_slug: slug } : {}),
    };

    return this.http.post<any>(`${this.apiUrl}/forgot-password`, body, {
      headers: slug ? { 'X-Tenant-Slug': slug } : {},
    });
  }

  verifyResetToken(email: string, token: string): Observable<any> {
    const slug = this.extractTenantSlugFromEmail(email);
    const body: { email: string; token: string; tenant_slug?: string } = {
      email,
      token,
      ...(slug ? { tenant_slug: slug } : {}),
    };

    return this.http.post<any>(`${this.apiUrl}/verify-reset-token`, body, {
      headers: slug ? { 'X-Tenant-Slug': slug } : {},
    });
  }

  resetPassword(payload: {
    email: string;
    token: string;
    password: string;
    password_confirm: string;
  }): Observable<any> {
    const slug = this.extractTenantSlugFromEmail(payload.email);
    const body = {
      ...payload,
      ...(slug ? { tenant_slug: slug } : {}),
    };

    return this.http.post<any>(`${this.apiUrl}/reset-password`, body, {
      headers: slug ? { 'X-Tenant-Slug': slug } : {},
    });
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

  private extractTenantSlugFromEmail(email: string): string | null {
    if (!email || !email.includes('@')) return null;
    const domain = email.split('@')[1]?.trim().toLowerCase();
    if (!domain || !domain.includes('.')) return null;
    const slug = domain.split('.')[0]?.trim();
    return slug || null;
  }
}
