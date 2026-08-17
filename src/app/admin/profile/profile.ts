import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { Auth } from '../../services/auth';
import { MasterProfileService } from '../../services/master-profile.service';
import { MasterProfile } from '../../interfaces/master-dashboard';

@Component({
  selector: 'app-profile',
  standalone: false,
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
})
export class Profile implements OnInit, OnDestroy {
  profile: MasterProfile | null = null;
  loading = true;
  saving = false;
  form!: FormGroup;
  showPassword = false;
  showConfirmPassword = false;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private auth: Auth,
    private fb: FormBuilder,
    private profileService: MasterProfileService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      first_name: ['', Validators.required],
      last_name: ['', Validators.required],
      email: [{ value: '', disabled: true }],
      role: [{ value: '', disabled: true }],
      password: [''],
      password_confirm: [''],
    });

    this.loadProfile();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get f() {
    return this.form.controls;
  }

  get roleLabel(): string {
    const role = this.profile?.role;
    if (!role) return 'Super Admin';
    if (typeof role === 'string') return role;
    return role.name || 'Super Admin';
  }

  loadProfile(): void {
    this.loading = true;
    this.profileService
      .getProfile()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.profile = res?.data ?? null;
          this.patchForm(this.profile);
          this.syncLocalUser(this.profile);
          this.loading = false;
        },
        error: (err) => {
          console.error('Profile load failed:', err);
          this.loading = false;
          this.toastr.error(this.extractErrorMessage(err, 'Failed to load profile'));
        },
      });
  }

  saveProfile(): void {
    if (this.form.invalid || this.saving) {
      this.form.markAllAsTouched();
      this.toastr.error('Please fill in all required fields correctly');
      return;
    }

    const password = (this.form.getRawValue().password || '').trim();
    const passwordConfirm = (this.form.getRawValue().password_confirm || '').trim();

    if (password || passwordConfirm) {
      if (password.length < 8) {
        this.toastr.error('Password must be at least 8 characters.');
        return;
      }
      if (password !== passwordConfirm) {
        this.toastr.error('Password confirmation does not match.');
        return;
      }
    }

    this.saving = true;

    const raw = this.form.getRawValue();
    const payload: Record<string, string> = {
      first_name: (raw.first_name || '').trim(),
      last_name: (raw.last_name || '').trim(),
    };

    if (password) {
      payload['password'] = password;
      payload['password_confirm'] = passwordConfirm;
    }

    this.profileService.updateProfile(payload).subscribe({
      next: (res) => {
        this.saving = false;
        this.profile = res?.data ?? this.profile;
        this.patchForm(this.profile);
        this.syncLocalUser(this.profile);
        this.form.patchValue({ password: '', password_confirm: '' });
        this.toastr.success(res?.message || 'Profile updated successfully');
      },
      error: (err) => {
        console.error('Profile update failed:', err);
        this.saving = false;
        this.toastr.error(this.extractErrorMessage(err, 'Failed to update profile'));
      },
    });
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  generatePassword(): void {
    const password = this.createRandomPassword();
    this.form.patchValue({
      password,
      password_confirm: password,
    });
    this.form.get('password')?.markAsDirty();
    this.form.get('password')?.markAsTouched();
    this.form.get('password_confirm')?.markAsDirty();
    this.form.get('password_confirm')?.markAsTouched();
    this.showPassword = true;
    this.showConfirmPassword = true;
  }

  private createRandomPassword(): string {
    const length = 12 + Math.floor(Math.random() * 5);
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '!@#$%^&*';
    const all = upper + lower + numbers + special;

    const chars = [
      upper[Math.floor(Math.random() * upper.length)],
      lower[Math.floor(Math.random() * lower.length)],
      numbers[Math.floor(Math.random() * numbers.length)],
      special[Math.floor(Math.random() * special.length)],
      ...Array.from({ length: length - 4 }, () => all[Math.floor(Math.random() * all.length)]),
    ];

    for (let i = chars.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }

    return chars.join('');
  }

  private patchForm(profile: MasterProfile | null): void {
    if (!profile) return;

    const first =
      profile.first_name ||
      (profile.name ? profile.name.split(/\s+/)[0] : '') ||
      '';
    const last =
      profile.last_name ||
      (profile.name ? profile.name.split(/\s+/).slice(1).join(' ') : '') ||
      '';

    this.form.patchValue({
      first_name: first,
      last_name: last,
      email: profile.email || '',
      role: this.roleLabel,
    });
  }

  private syncLocalUser(profile: MasterProfile | null): void {
    if (!profile) return;
    const current = this.auth.currentUser();
    const role =
      typeof profile.role === 'string'
        ? { id: 0, name: profile.role }
        : profile.role || current?.role;

    this.auth.setCurrentUser({
      ...(current || { id: profile.id, name: '', email: '' }),
      id: profile.id,
      name: profile.name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
      email: profile.email,
      role: role as any,
    });
  }

  private extractErrorMessage(err: any, fallback: string): string {
    const body = err?.error;
    if (body?.message) {
      return Array.isArray(body.message) ? body.message.join(', ') : String(body.message);
    }
    return fallback;
  }
}
