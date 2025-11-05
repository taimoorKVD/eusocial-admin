import { Component } from '@angular/core';
import { User } from '../../interfaces/user';
import { Auth } from '../../services/auth';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-profile',
  standalone: false,
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
})
export class Profile {
  user: User | null = null;
  loading = true;
  saving = false;
  message = '';
  form!: FormGroup;
  showPassword = false;
  showConfirmPassword = false;

  constructor(private auth: Auth, private fb: FormBuilder, private http: HttpClient) {}

  ngOnInit(): void {
    // Load current user
    this.auth.currentUser$.subscribe({
      next: (user) => {
        this.user = user;
        this.loading = false;

        // Initialize form with existing user data
        this.form = this.fb.group({
          name: [user?.name || '', Validators.required],
          email: [user?.email || '', [Validators.required, Validators.email]],
          password: [''],
          password_confirm: [''],
        });
      },
      error: () => (this.loading = false),
    });
  }

  saveProfile(): void {
    if (this.form.invalid || this.saving) return;

    this.saving = true;
    this.message = '';

    // 🧹 Prepare clean payload
    const payload = { ...this.form.value };

    // Remove empty strings or unnecessary fields
    Object.keys(payload).forEach((key) => {
      if (payload[key] === '' || payload[key] === null) {
        delete payload[key];
      }
    });

    // Remove empty passwords to prevent backend validation issues
    if (!payload.password || payload.password.trim() === '') {
      delete payload.password;
      delete payload.password_confirm;
    }

    // Trim name and email
    if (payload.name) payload.name = payload.name.trim();
    if (payload.email) payload.email = payload.email.trim();

    // 🚀 Send PUT request
    this.http.put(`${environment.apiUrl}/users/profile`, payload).subscribe({
      next: (res: any) => {
        this.saving = false;
        this.message = res?.message || 'Profile updated successfully ✅';

        // ✅ Update local state and localStorage
        if (this.user) {
          this.user.name = payload.name || this.user.name;
          this.user.email = payload.email || this.user.email;
        }

        this.auth.refreshUser(); // Refresh globally stored user
      },
      error: (err) => {
        console.error('Profile update failed:', err);
        this.saving = false;

        if (err.status === 400 && err.error?.message) {
          this.message = Array.isArray(err.error.message)
            ? err.error.message.join(', ')
            : err.error.message;
        } else {
          this.message = 'Failed to update profile ❌';
        }
      },
    });
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  get f() {
    return this.form.controls;
  }
}
