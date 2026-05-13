import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TenantAuthService } from '../../services/tenant-auth.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-tenant-reset-password',
  standalone: false,
  templateUrl: './tenant-reset-password.component.html',
  styleUrl: './tenant-reset-password.component.scss',
})
export class TenantResetPasswordComponent {
  form: FormGroup;
  submitted = false;
  loading = false;
  verifying = true;
  tokenValid = false;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private tenantAuth: TenantAuthService,
    private toastr: ToastrService
  ) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      token: ['', Validators.required],
      password: ['', [Validators.required, Validators.minLength(6)]],
      password_confirm: ['', [Validators.required]],
    });
  }

  ngOnInit(): void {
    const email = this.route.snapshot.queryParamMap.get('email') || '';
    const token = this.route.snapshot.queryParamMap.get('token') || '';

    this.form.patchValue({ email, token });

    if (!email || !token) {
      this.verifying = false;
      this.tokenValid = false;
      this.toastr.error('Reset link is invalid or incomplete');
      return;
    }

    this.tenantAuth.verifyResetToken(email, token).subscribe({
      next: () => {
        this.verifying = false;
        this.tokenValid = true;
      },
      error: (err) => {
        this.verifying = false;
        this.tokenValid = false;
        this.toastr.error(this.extractErrorMessage(err));
      },
    });
  }

  get f() {
    return this.form.controls;
  }

  onSubmit(): void {
    this.submitted = true;
    if (this.form.invalid) {
      return;
    }

    const { password, password_confirm } = this.form.value;
    if (password !== password_confirm) {
      this.toastr.error('Password and confirm password do not match');
      return;
    }

    this.loading = true;

    this.tenantAuth.resetPassword(this.form.value).subscribe({
      next: (res: any) => {
        this.toastr.success(res?.message || 'Password reset successful');
        this.loading = false;
        this.router.navigate(['/tenant/login']);
      },
      error: (err) => {
        this.toastr.error(this.extractErrorMessage(err));
        this.loading = false;
      },
    });
  }

  private extractErrorMessage(err: any): string {
    const body = err?.error;
    if (body?.message) {
      return Array.isArray(body.message) ? body.message.join(', ') : String(body.message);
    }
    return 'Failed to reset password';
  }
}
