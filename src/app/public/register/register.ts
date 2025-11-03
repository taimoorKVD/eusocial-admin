import { HttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Router } from '@angular/router';
import { Auth } from '../../services/auth';

@Component({
  selector: 'app-register',
  standalone: false,
  templateUrl: './register.html',
  styleUrl: './register.scss',
})
export class Register {
  firstName = '';
  lastName = '';
  email = '';
  password = '';
  passwordConfirm = '';
  submitted = false;
  loading = false;

  constructor(
    private http: HttpClient,
    private router: Router,
    private auth: Auth
  ) { }

  ngOnInit() {
    console.log('Register component initialized');
  }

  onSubmit(form: any): void {
    this.submitted = true;

    if (form.invalid || this.password !== this.passwordConfirm) {
      console.log('❌ Validation failed');
      return;
    }

    const userData = {
      first_name: this.firstName,
      last_name: this.lastName,
      email: this.email,
      password: this.password,
      password_confirm: this.passwordConfirm,
      role_id: 2, // Default role ID for new users
    };

    this.auth.register(userData).subscribe({
      next: (res: any) => {
        console.log('✅ Registered Successfully:', res);

        // Optional: store user info or show toast here
        alert(`Welcome ${res.first_name}! Your account has been created.`);

        // Redirect to login page after a short delay
        this.router.navigate(['/login']);
      },
      error: (err) => {
        console.error('❌ Registration Failed:', err);
        alert('Registration failed. Please check your details and try again.');
      },
      complete: () => {
        this.loading = false;
      }
    });
  }

}
