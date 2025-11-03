import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { Auth } from '../services/auth';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private auth: Auth, private router: Router) { }

  async canActivate(): Promise<boolean> {
    
    // Wait for user session validation (cookie + local)
    await this.auth.initUser();

    if (this.auth.isLoggedIn()) {
      return true;
    }

    // If not logged in, redirect to login
    this.router.navigate(['/login']);
    return false;
  }
}
