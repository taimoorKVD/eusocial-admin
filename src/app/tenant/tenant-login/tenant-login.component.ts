import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TenantAuthService } from '../../services/tenant-auth.service';
import { Router } from '@angular/router';
import { TenantSessionService } from '../../services/tenant-session.service';
import { ToastrService } from 'ngx-toastr';

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

    constructor( private session: TenantSessionService, private fb: FormBuilder, private tenantAuth: TenantAuthService, private router: Router, private toastr: ToastrService ) {}

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
    this.router.navigate(['/tenant', slug, 'home']);
  }
}

  // easy access
  get f() {
    return this.loginForm.controls;
  }

 onSubmit(): void {
  this.submitted = true;

  if (this.loginForm.invalid) return;

  this.loading = true; // ✅ start loader

  const { email, password } = this.loginForm.value;
  const detectedSlug = this.extractTenantSlugFromEmail(email);

  if (!detectedSlug) {
    this.toastr.error('Unable to detect tenant from email domain');
    this.loading = false;
    return;
  }

  this.tenantAuth.login(email, password, detectedSlug).subscribe({
    next: (res) => {
      const token = res.accessToken;
      const slug = res.tenant_slug || detectedSlug;
      const user = res.user;

      if (!slug) {
        this.toastr.error('Tenant slug is missing from login response');
        this.loading = false;
        return;
      }

      this.session.setSession(token, slug, user);
      this.toastr.success('Login successful');
      this.router.navigate(['/tenant', slug, 'home']);
      this.loading = false;
    },

    error: (err) => {
      let message = 'Something went wrong during login. Please try again.';
      if (err.status === 0) {
        message = 'Unable to connect to the server. This may be a CORS or network issue.';
      } else if (err.error?.message) {
        message = err.error.message;
      }
      this.toastr.error(message);
      this.loading = false;
    }
  });
}

private extractTenantSlugFromEmail(email: string): string | null {
  if (!email || !email.includes('@')) {
    return null;
  }

  const domain = email.split('@')[1]?.trim().toLowerCase();

  if (!domain || !domain.includes('.')) {
    return null;
  }

  // Example: user@company.com -> company
  const slug = domain.split('.')[0]?.trim();

  return slug || null;
}

// onSubmit(): void {
//   this.submitted = true;

//   if (this.loginForm.invalid) return;

//   this.loading = true;

//   const { email, password } = this.loginForm.value;

//   this.tenantAuth.login(email, password).subscribe({
//     next: (res) => {
//       const token = res.accessToken;
//       const slug = res.tenant_slug;
//       const user = res.user;

//       this.session.setSession(token, slug, user);

//       // ❌ Toastr removed
//       // this.toastr.success(res.message);

//       this.router.navigate(['/tenant', slug, 'home']);
//       this.loading = false;
//     },

//     error: (err) => {
//       console.error(err);

//       // ❌ Toastr removed
//       // this.toastr.error(err?.error?.message);

//       this.loading = false;
//     }
//   });
// }
}
