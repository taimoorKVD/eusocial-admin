import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { User } from '../interfaces/user';
import { AuthResponse } from '../interfaces/authresponse';

@Injectable({ providedIn: 'root' })
export class Auth {
  private justLoggedIn = false;
  private apiUrl = `${environment.apiUrl}`;
  private userKey = 'user';
  private tokenKey = 'access_token';
  private currentUserSubject = new BehaviorSubject<User | null>(this.getStoredUser());
  currentUser$: Observable<User | null> = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient, private router: Router) {}

  // --------------------------
  // LOGIN
  // --------------------------
  login(credentials: { email: string; password: string }): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, credentials).pipe(
      tap({
        next: (res: AuthResponse) => {
          // Make sure we have a valid token response
          if (res && res.access_token) {
            // ✅ Save token & user info locally
            localStorage.setItem(this.tokenKey, res.access_token);
            localStorage.setItem(this.userKey, JSON.stringify(res.user));

            // ✅ Update BehaviorSubject so components see the new user immediately
            this.currentUserSubject.next(res.user);
            this.justLoggedIn = true; // ✅ mark as just logged in
          }
        },
        error: (err) => {
          console.error('Login failed:', err);
        },
      })
    );
  }

  // --------------------------
  // LOGOUT
  // --------------------------
  logout(): void {
    // Just clear locally (no cookies now)
    localStorage.removeItem(this.userKey);
    localStorage.removeItem(this.tokenKey);
    this.currentUserSubject.next(null);
    const url = window.location.pathname;
    if (url === '/tenant' || url.startsWith('/tenant/')) {
      this.router.navigate(['/login']);
    } else {
      this.router.navigate(['/login']);
    }
  }

  private clearAndRedirect(): void {
    localStorage.removeItem(this.userKey);
    this.currentUserSubject.next(null);
    const url = window.location.pathname;
    if (url === '/tenant' || url.startsWith('/tenant/')) {
      this.router.navigate(['/login']);
    } else {
      this.router.navigate(['/login']);
    }
  }

  // --------------------------
  // REGISTER
  // --------------------------
  register(data: {
    first_name: string;
    last_name: string;
    email: string;
    password: string;
  }): Observable<User> {
    return this.http.post<User>(`${this.apiUrl}/register`, data, { withCredentials: true }).pipe(
      tap((res: User) => {
        localStorage.setItem(this.userKey, JSON.stringify(res));
        this.currentUserSubject.next(res);
        this.router.navigate(['/dashboard']);
      })
    );
  }

  forgotPassword(email: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/forgot-password`, { email });
  }

  verifyResetToken(email: string, token: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/verify-reset-token`, {
      email,
      token,
    });
  }

  resetPassword(payload: {
    email: string;
    token: string;
    password: string;
    password_confirm: string;
  }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/reset-password`, payload);
  }

  // -----------------------------
  // FETCH USER FROM API (USING TOKEN)
  // -----------------------------
  user(): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/auth/user`).pipe(
      tap({
        next: (res: User) => {
          localStorage.setItem(this.userKey, JSON.stringify(res));
          this.currentUserSubject.next(res);
        },
        error: (err) => {
          if (err.status === 401) this.logout();
        },
      })
    );
  }

  // -----------------------------
  // INITIALISE USER ON APP LOAD
  // -----------------------------
  initUser(): Promise<void> {
    return new Promise((resolve) => {
      const localUser = this.getStoredUser();
      if (localUser) this.currentUserSubject.next(localUser);

      const token = localStorage.getItem(this.tokenKey);
      if (!token) return resolve();

      // ✅ Skip if just logged in
      if (this.justLoggedIn) {
        this.justLoggedIn = false;
        return resolve();
      }

      this.user().subscribe({
        next: () => resolve(),
        error: () => resolve(),
      });
    });
  }

  refreshUser(): void {
    this.http.get<User>(`${this.apiUrl}/auth/user`).subscribe({
      next: (user) => {
        localStorage.setItem(this.userKey, JSON.stringify(user));
        this.currentUserSubject.next(user);
      },
      error: (err) => {
        if (err.status === 401) this.logout();
      },
    });
  }

  // --------------------------
  // HELPERS
  // --------------------------
  private getStoredUser(): User | null {
    const stored = localStorage.getItem(this.userKey);
    return stored ? (JSON.parse(stored) as User) : null;
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  currentUser(): User | null {
    return this.currentUserSubject.value;
  }
}
