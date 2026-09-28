import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
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
import { TenantProfile, TenantTimezoneOption } from '../../../interfaces/tenant-profile';
import { TenantProfileService } from '../../../services/tenant-profile.service';
import { TenantSessionService } from '../../../services/tenant-session.service';
import { DropdownPanelDirective } from '../../../shared/directives/dropdown-panel/dropdown-panel.directive';

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
  readonly timezones = signal<TenantTimezoneOption[]>([]);
  readonly timezoneSearch = signal('');
  readonly timezoneDropdownGroup = 'tenant-profile-timezone';

  readonly filteredTimezones = computed(() => {
    const query = this.timezoneSearch().trim().toLowerCase();
    const options = this.timezones();
    if (!query) {
      return options;
    }
    return options.filter(
      (tz) =>
        tz.label.toLowerCase().includes(query) ||
        tz.name.toLowerCase().includes(query),
    );
  });

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
      timezone: [{ value: '', disabled: true }],
      avatarUrl: ['', [Validators.maxLength(500)]],
    });

    this.profileService.refresh();
    this.loadProfile();
    this.loadTimezones();

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

  /**
   * Job position for Employee (tenant_user) profiles only.
   * Empty when not an employee or when job_position is missing.
   */
  get jobPositionName(): string {
    if (!this.session.isEmployee()) {
      return '';
    }

    return this.resolveJobPositionName(this.profile() ?? this.session.getUser());
  }

  get avatarSrc(): string | null {
    return this.profile()?.avatarUrl || null;
  }

  /** Selected timezone display label (falls back to IANA name). */
  get timezoneDisplayLabel(): string {
    const selected = String(this.form.getRawValue().timezone || '').trim();
    if (!selected) {
      return 'Select Timezone';
    }
    const match = this.timezones().find((tz) => tz.name === selected);
    return match?.label || selected;
  }

  get hasTimezoneValue(): boolean {
    return !!String(this.form.getRawValue().timezone || '').trim();
  }

  startEdit(): void {
    this.snapshot = this.form.getRawValue();
    this.form.controls['timezone'].enable({ emitEvent: false });
    this.editing.set(true);
  }

  cancelEdit(): void {
    if (this.snapshot) {
      this.form.reset(this.snapshot);
    }
    this.form.controls['timezone'].disable({ emitEvent: false });
    this.timezoneSearch.set('');
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

    const raw = this.form.getRawValue();

    this.profileService
      .updateProfile({
        firstName: String(raw.firstName || '').trim(),
        lastName: String(raw.lastName || '').trim(),
        phone: String(raw.phone || '').trim(),
        timezone: String(raw.timezone || '').trim(),
        // avatarUrl: String(raw.avatarUrl || '').trim(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.profile.set(updated);
          this.patchForm(updated);
          this.form.controls['timezone'].disable({ emitEvent: false });
          this.timezoneSearch.set('');

          this.editing.set(false);
          this.snapshot = null;

          this.toastr.success('Profile updated successfully');
          this.saving.set(false);
        },

        error: (error) => {
          this.toastr.error(
            error instanceof Error
              ? error.message
              : 'Failed to update profile'
          );

          this.saving.set(false);
        },
      });
  }

  onTimezoneSearch(event: Event): void {
    this.timezoneSearch.set((event.target as HTMLInputElement).value);
  }

  selectTimezone(
    name: string,
    dropdown: DropdownPanelDirective,
    event?: Event,
  ): void {
    event?.stopPropagation();
    if (!this.editing()) {
      return;
    }
    this.form.controls['timezone'].setValue(name);
    this.timezoneSearch.set('');
    dropdown.close();
  }

  clearTimezone(dropdown: DropdownPanelDirective, event: Event): void {
    event.stopPropagation();
    if (!this.editing()) {
      return;
    }
    this.form.controls['timezone'].setValue('');
    this.timezoneSearch.set('');
    dropdown.close();
  }

  isTimezoneSelected(name: string): boolean {
    return String(this.form.getRawValue().timezone || '') === name;
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

  private loadTimezones(): void {
    this.profileService
      .getTimezones()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (options) => {
          this.timezones.set(options);
          const current = this.profile();
          if (current && !this.editing()) {
            this.patchForm(current);
          }
        },
        error: () => {
          this.timezones.set([]);
        },
      });
  }

  private patchForm(profile: TenantProfile): void {
    this.form.patchValue({
      firstName: profile.firstName || '',
      lastName: profile.lastName || '',
      email: profile.email || '',
      phone: profile.phone || '',
      username: profile.username || '',
      role: this.profileService.getRoleLabel(profile),
      timezone: profile.timezone || '',
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

  /** Same job_position.name source as the Employee Portal topbar. */
  private resolveJobPositionName(user: unknown): string {
    if (!user || typeof user !== 'object') {
      return '';
    }

    const record = user as Record<string, unknown>;
    const jobPosition = record['job_position'] ?? record['jobPosition'];

    if (jobPosition && typeof jobPosition === 'object') {
      const name = (jobPosition as { name?: unknown }).name;
      if (typeof name === 'string' && name.trim()) {
        return name.trim();
      }
    }

    if (typeof jobPosition === 'string' && jobPosition.trim()) {
      return jobPosition.trim();
    }

    return '';
  }
}
