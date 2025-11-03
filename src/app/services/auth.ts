import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { User } from '../interfaces/user';

@Injectable({ providedIn: 'root' })
export class Auth {
  private apiUrl = `${environment.apiUrl}`;
  private userKey = 'user';
  private currentUserSubject = new BehaviorSubject<User | null>(this.getStoredUser());
  currentUser$: Observable<User | null> = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient, private router: Router) { }

  // --------------------------
  // LOGIN
  // --------------------------
  login(credentials: { email: string; password: string }): Observable<User> {
    return this.http
      .post<User>(`${this.apiUrl}/login`, credentials, { withCredentials: true })
      .pipe(
        tap((res: User) => {
          localStorage.setItem(this.userKey, JSON.stringify(res));
          this.currentUserSubject.next(res);
        })
      );
  }

  // --------------------------
  // LOGOUT
  // --------------------------
  logout(): void {
    this.http.post(`${this.apiUrl}/logout`, {}, { withCredentials: true }).subscribe({
      next: () => this.clearAndRedirect(),
      error: () => this.clearAndRedirect(),
    });
  }

  private clearAndRedirect(): void {
    localStorage.removeItem(this.userKey);
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
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
    return this.http
      .post<User>(`${this.apiUrl}/register`, data, { withCredentials: true })
      .pipe(
        tap((res: User) => {
          localStorage.setItem(this.userKey, JSON.stringify(res));
          this.currentUserSubject.next(res);
          this.router.navigate(['/dashboard']);
        })
      );
  }

  // -----------------------------
  // FETCH USER FROM COOKIE
  // -----------------------------
  user(): Observable<User> {
    return this.http
      .get<User>(`${this.apiUrl}/user`, { withCredentials: true })
      .pipe(
        tap({
          next: (res: User) => {
            localStorage.setItem(this.userKey, JSON.stringify(res));
            this.currentUserSubject.next(res);
          },
          error: (err) => {
            if (err.status === 401) {
              // ❌ unauthorized session
              localStorage.removeItem(this.userKey);
              this.currentUserSubject.next(null);
            }
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

      this.http.get<User>(`${this.apiUrl}/user`, { withCredentials: true }).subscribe({
        next: (res) => {
          localStorage.setItem(this.userKey, JSON.stringify(res));
          this.currentUserSubject.next(res);
          resolve();
        },
        error: (err) => {
          if (err.status === 401) {
            localStorage.removeItem(this.userKey);
            this.currentUserSubject.next(null);
          }
          resolve(); // ✅ always resolve
        },
      });
    });
  }

  refreshUser() {
    this.http
      .get<User>(`${environment.apiUrl}/auth/user`, { withCredentials: true })
      .subscribe({
        next: (user) => this.currentUserSubject.next(user),
      });
  }

  // --------------------------
  // HELPERS
  // --------------------------
  private getStoredUser(): User | null {
    const stored = localStorage.getItem(this.userKey);
    return stored ? (JSON.parse(stored) as User) : null;
  }

  isLoggedIn(): boolean {
    return !!this.currentUserSubject.value;
  }

  currentUser(): User | null {
    return this.currentUserSubject.value;
  }
}
