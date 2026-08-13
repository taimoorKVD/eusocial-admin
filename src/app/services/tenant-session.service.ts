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

  /** Reads `user_type` / `userType` from the stored login user. */
  getUserType(): string {
    const user = this.readUser();
    if (!user || typeof user !== 'object') {
      return '';
    }
    return this.readString(user.user_type ?? user.userType).toLowerCase();
  }

  /** Reads `account_type` / `accountType` from the stored login user. */
  getAccountType(): string {
    const user = this.readUser();
    if (!user || typeof user !== 'object') {
      return '';
    }
    return this.readString(user.account_type ?? user.accountType).toLowerCase();
  }

  /**
   * Employee / staff: tenant user with account_type tenant_user.
   * Missing user_type is treated as tenant so existing sessions still work.
   */
  isEmployee(): boolean {
    const userType = this.getUserType();
    const isTenant = !userType || userType === 'tenant';
    return isTenant && this.getAccountType() === 'tenant_user';
  }

  /**
   * Tenant admin experience. Missing account_type defaults to admin so
   * existing Phase 1 sessions are unchanged.
   */
  isTenantAdmin(): boolean {
    if (this.isEmployee()) {
      return false;
    }
    const userType = this.getUserType();
    const isTenant = !userType || userType === 'tenant';
    if (!isTenant) {
      return false;
    }
    const accountType = this.getAccountType();
    return !accountType || accountType === 'tenant_admin';
  }

  /** Default landing commands after login / home redirect. */
  getHomeCommands(): string[] {
    const slug = this.getSlug();
    if (!slug) {
      return ['/tenant/login'];
    }
    if (this.isEmployee()) {
      return ['/tenant', slug, 'employee-dashboard'];
    }
    return ['/tenant', slug, 'user-dashboard'];
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

  private readString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }
}
