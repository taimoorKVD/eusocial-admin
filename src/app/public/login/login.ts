import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { Auth } from '../../services/auth';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-login',
  standalone: false,
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  loginForm: FormGroup;
  submitted = false;
  loading = false;

  constructor(
    private fb: FormBuilder,
    private auth: Auth,
    private router: Router,
    private toastr: ToastrService
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  ngOnInit(): void {
    if (this.auth.isLoggedIn()) {
      this.router.navigate(['/dashboard']);
    }
  }
  get f() {
    return this.loginForm.controls;
  }

  onSubmit(): void {
    this.submitted = true;
    if (this.loginForm.invalid) {
      return;
    }
    this.loading = true;
    const credentials = this.loginForm.value;
    this.auth.login(credentials).subscribe({
      next: (res: any) => {
        this.toastr.success(`Welcome back ${res.name || ''}!`);
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        console.error('❌ Login failed:', err);
        this.toastr.error('Invalid email or password.');
        this.loading = false;
      },
    });
  }

}
