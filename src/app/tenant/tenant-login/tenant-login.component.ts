import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TenantAuthService } from '../../services/tenant-auth.service';
import { Router } from '@angular/router';
import { TenantSessionService } from '../../services/tenant-session.service';

@Component({
  selector: 'app-tenant-login',
  standalone: false,

  templateUrl: './tenant-login.component.html',
  styleUrl: './tenant-login.component.scss'
})
export class TenantLoginComponent {
  loginForm!: FormGroup;
  submitted = false;
  loading = false;
  errorMessage = '';

    constructor( private session: TenantSessionService, private fb: FormBuilder, private tenantAuth: TenantAuthService, private router: Router ) {}

ngOnInit(): void {

  // ✅ 1. build form
  this.loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  // ✅ 2. auto redirect if already logged in
  const token = localStorage.getItem('tenant_token');
  const slug = localStorage.getItem('tenant_slug');

  if (token && slug) {
    this.router.navigate([`/tenant/${slug}/home`]);
  }
}

  // easy access
  get f() {
    return this.loginForm.controls;
  }

  onSubmit(): void {

    this.submitted = true;
    if (this.loginForm.invalid) return;

    const { email, password } = this.loginForm.value;

    this.tenantAuth.login(email, password).subscribe({
      next: (res) => {

        const token = res.accessToken;
        const slug = res.tenant_slug;
        const user = res.user;

        // ✅ STORE VIA HELPER
        this.session.setSession(token, slug, user);

        // 🚀 redirect
        this.router.navigate([`/tenant/${slug}/home`]);
      },

      error: (err) => {
        console.error(err);
      }
    });
  }
}
