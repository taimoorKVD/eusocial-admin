import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TenantSessionService {
  private TOKEN_KEY = 'tenant_token';
  private SLUG_KEY = 'tenant_slug';
  private USER_KEY = 'tenant_user';

  private readonly userSubject = new BehaviorSubject<any>(this.readUser());
  readonly user$ = this.userSubject.asObservable();

  setSession(token: string, slug: string, user: any) {
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.SLUG_KEY, slug);
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    this.userSubject.next(user ?? null);
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  getSlug(): string | null {
    return localStorage.getItem(this.SLUG_KEY);
  }

  getUser(): any {
    return this.readUser();
  }

  /** Merge and persist user fields (used by Profile updates). */
  updateUser(partial: Record<string, unknown>): any {
    const current = this.readUser() || {};
    const updated = { ...current, ...partial };
    localStorage.setItem(this.USER_KEY, JSON.stringify(updated));
    this.userSubject.next(updated);
    return updated;
  }

  clear() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.SLUG_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.userSubject.next(null);
  }

  private readUser(): any {
    try {
      return JSON.parse(localStorage.getItem(this.USER_KEY) || 'null');
    } catch {
      return null;
    }
  }
}
