import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class TenantSessionService {
  constructor() { }
    private TOKEN_KEY = 'tenant_token';
  private SLUG_KEY = 'tenant_slug';
  private USER_KEY = 'tenant_user';

  setSession(token: string, slug: string, user: any) {
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.SLUG_KEY, slug);
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  getSlug(): string | null {
    return localStorage.getItem(this.SLUG_KEY);
  }

  getUser(): any {
    return JSON.parse(localStorage.getItem(this.USER_KEY) || 'null');
  }

  clear() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.SLUG_KEY);
    localStorage.removeItem(this.USER_KEY);
  }
}
