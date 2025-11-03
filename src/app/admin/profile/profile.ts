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
  constructor(
    private auth: Auth,
    private fb: FormBuilder,
    private http: HttpClient
  ) { }

  ngOnInit(): void {
    // Load current user
    this.auth.currentUser$.subscribe({
      next: (user) => {
        this.user = user;
        this.loading = false;

        // Initialize form after user data is available
        this.form = this.fb.group({
          first_name: [user?.first_name || '', Validators.required],
          last_name: [user?.last_name || '', Validators.required],
          email: [user?.email || '', [Validators.required, Validators.email]],
          password: [''],
          password_confirm: [''],
        });
      },
      error: () => (this.loading = false),
    });
  }

  saveProfile() {
    if (this.form.invalid) return;
    this.saving = true;
    this.message = '';

    this.http
      .put(`${environment.apiUrl}/users/info`, this.form.value, {
        withCredentials: true,
      })
      .subscribe({
        next: (res: any) => {
          this.message = 'Profile updated successfully ✅';
          this.saving = false;

          // Optimistically update local user info
          if (this.user) {
            Object.assign(this.user, this.form.value);
          }

          // ✅ Refresh the locally stored user data
          this.auth.refreshUser();
        },
        error: (err) => {
          console.error('Profile update failed:', err);
          if (err.status === 400 && err.error?.message) {
            this.message = err.error.message;
          } else {
            this.message = 'Failed to update profile ❌';
          }
          this.saving = false;
        },
      });
  }

}
