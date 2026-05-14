import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TenantAuthService } from '../../services/tenant-auth.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-tenant-forgot-password',
  standalone: false,
  templateUrl: './tenant-forgot-password.component.html',
  styleUrl: './tenant-forgot-password.component.scss',
})
export class TenantForgotPasswordComponent {
  form: FormGroup;
  submitted = false;
  loading = false;
  emailSent = false;
  sentEmail = '';

  constructor(
    private fb: FormBuilder,
    private tenantAuth: TenantAuthService,
    private toastr: ToastrService
  ) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
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

    this.loading = true;
    const email = this.form.value.email as string;

    this.tenantAuth.forgotPassword(email).subscribe({
      next: (res: any) => {
        this.emailSent = true;
        this.sentEmail = email;
        this.toastr.success(res?.message || 'Reset link sent to your email');
        this.loading = false;
      },
      error: (err) => {
        this.toastr.error(this.extractErrorMessage(err));
        this.loading = false;
      },
    });
  }

  resendEmail(): void {
    if (!this.sentEmail) {
      return;
    }

    this.loading = true;
    this.tenantAuth.forgotPassword(this.sentEmail).subscribe({
      next: (res: any) => {
        this.toastr.success(res?.message || 'Reset link sent again');
        this.loading = false;
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
    return 'Failed to send reset link';
  }
}
