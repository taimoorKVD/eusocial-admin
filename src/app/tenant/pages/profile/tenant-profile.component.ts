import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { TenantProfile } from '../../../interfaces/tenant-profile';
import { TenantProfileService } from '../../../services/tenant-profile.service';
import { TenantSessionService } from '../../../services/tenant-session.service';

@Component({
  selector: 'app-tenant-profile',
  standalone: false,
  templateUrl: './tenant-profile.component.html',
  styleUrl: './tenant-profile.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TenantProfileComponent implements OnInit {
  private readonly profileService = inject(TenantProfileService);
  private readonly session = inject(TenantSessionService);
  private readonly fb = inject(FormBuilder);
  private readonly toastr = inject(ToastrService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly editing = signal(false);
  readonly saving = signal(false);
  readonly profile = signal<TenantProfile | null>(null);

  form!: FormGroup;
  private snapshot: Record<string, unknown> | null = null;

  ngOnInit(): void {
    this.form = this.fb.group({
      firstName: ['', [Validators.required, Validators.maxLength(80)]],
      lastName: ['', [Validators.maxLength(80)]],
      email: [{ value: '', disabled: true }],
      phone: ['', [this.phoneValidator]],
      username: [{ value: '', disabled: true }],
      role: [{ value: '', disabled: true }],
      avatarUrl: ['', [Validators.maxLength(500)]],
    });

    this.profileService.refresh();
    this.loadProfile();

    this.session.user$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (!this.editing()) {
          this.loadProfile();
        }
      });
  }

  get f() {
    return this.form.controls;
  }

  get displayName(): string {
    return this.profileService.getDisplayName(this.profile());
  }

  get roleLabel(): string {
    return this.profileService.getRoleLabel(this.profile());
  }

  get avatarSrc(): string | null {
    return this.profile()?.avatarUrl || null;
  }

  startEdit(): void {
    this.snapshot = this.form.getRawValue();
    this.editing.set(true);
  }

  cancelEdit(): void {
    if (this.snapshot) {
      this.form.reset(this.snapshot);
    }
    this.editing.set(false);
    this.snapshot = null;
  }

  saveProfile(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      this.toastr.error('Please fix the highlighted fields.');
      return;
    }

    this.saving.set(true);

    try {
      const raw = this.form.getRawValue();
      const updated = this.profileService.updateProfile({
        firstName: String(raw.firstName || '').trim(),
        lastName: String(raw.lastName || '').trim(),
        phone: String(raw.phone || '').trim(),
        avatarUrl: String(raw.avatarUrl || '').trim(),
      });

      this.profile.set(updated);
      this.patchForm(updated);
      this.editing.set(false);
      this.snapshot = null;
      this.toastr.success('Profile updated successfully');
    } catch (error) {
      this.toastr.error(
        error instanceof Error ? error.message : 'Failed to update profile'
      );
    } finally {
      this.saving.set(false);
    }
  }

  onAvatarError(event: Event): void {
    const image = event.target as HTMLImageElement | null;
    if (image) {
      image.style.display = 'none';
    }
  }

  private loadProfile(): void {
    const profile = this.profileService.getProfile();
    this.profile.set(profile);
    if (profile) {
      this.patchForm(profile);
    }
    this.loading.set(false);
  }

  private patchForm(profile: TenantProfile): void {
    this.form.patchValue({
      firstName: profile.firstName || '',
      lastName: profile.lastName || '',
      email: profile.email || '',
      phone: profile.phone || '',
      username: profile.username || '',
      role: this.profileService.getRoleLabel(profile),
      avatarUrl: profile.avatarUrl || '',
    });
  }

  private phoneValidator(control: AbstractControl): ValidationErrors | null {
    const value = String(control.value || '').trim();
    if (!value) {
      return null;
    }

    // Allow common phone formats: digits, spaces, +, -, (), .
    const valid = /^[+]?[\d\s().-]{7,20}$/.test(value);
    return valid ? null : { phone: true };
  }
}
