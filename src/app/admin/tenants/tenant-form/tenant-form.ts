import { Component, OnDestroy, OnInit } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { Subject, takeUntil } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { MasterPlan } from '../../../interfaces/master-billing';
import { Tenant } from '../../../interfaces/tenant';
import { MasterPlanService } from '../../../services/master-plan.service';
import {
  TenantCreatePayload,
  TenantService,
  TenantUpdatePayload,
} from '../../../services/tenant.service';
import { displayMoney } from '../../../shared/utils/money.util';

interface SelectOption {
  id: number;
  name: string;
}

@Component({
  selector: 'app-tenant-form',
  standalone: false,
  templateUrl: './tenant-form.html',
  styleUrl: './tenant-form.scss',
})
export class TenantForm implements OnInit, OnDestroy {
  form!: FormGroup;
  isEditMode = false;
  tenantId!: number;
  tenant: Tenant | null = null;
  loading = false;
  saving = false;

  countries: SelectOption[] = [];
  states: SelectOption[] = [];
  cities: SelectOption[] = [];
  plans: MasterPlan[] = [];

  readonly baseDomain = environment.baseDomain || 'eusocial.thebetawebsite.com';

  readonly trialOptions = [
    { value: 0, label: 'No trial' },
    { value: 7, label: '7 days' },
    { value: 14, label: '14 days' },
    { value: 30, label: '30 days' },
  ];

  private readonly destroy$ = new Subject<void>();
  /** Letters, numbers, spaces, hyphens only — no @ or other special characters. */
  private readonly tenantNamePattern = /^[A-Za-z0-9]+(?:[ A-Za-z0-9\-]*[A-Za-z0-9])?$/;
  private existingDomain = '';

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private tenantService: TenantService,
    private planService: MasterPlanService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.buildForm();
    this.loadLookups();

    this.form
      .get('countryId')
      ?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe((countryId) => {
        this.form.patchValue({ stateId: null, city: null }, { emitEvent: false });
        this.states = [];
        this.cities = [];
        this.syncLocationControls(!!countryId, false);
        if (countryId) this.loadStates(Number(countryId));
      });

    this.form
      .get('stateId')
      ?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe((stateId) => {
        this.form.patchValue({ city: null }, { emitEvent: false });
        this.cities = [];
        this.syncLocationControls(!!this.form.get('countryId')?.value, !!stateId);
        if (stateId) this.loadCities(Number(stateId));
      });

    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.isEditMode = true;
        this.tenantId = +id;
        this.applyEditModeValidators();
        this.loadTenant();
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get f() {
    return this.form.controls;
  }

  get tenantSlug(): string {
    return this.slugifyTenantName(this.form?.value?.name || '');
  }

  get businessEmailPlaceholder(): string {
    const slug = this.tenantSlug || 'folio3';
    return `hello@${slug}.com`;
  }

  get descriptionCount(): number {
    return String(this.form?.value?.description || '').length;
  }

  get addressCount(): number {
    return String(this.form?.value?.address || '').length;
  }

  get currentPlanLabel(): string {
    const planId = this.form?.value?.planId;
    const plan = this.plans.find((p) => p.id === planId);
    if (plan) return this.planLabel(plan);
    const tenantPlan = this.tenant?.plan;
    if (typeof tenantPlan === 'string') return tenantPlan;
    if (tenantPlan?.name) return tenantPlan.name;
    return '—';
  }

  buildForm(): void {
    this.form = this.fb.group({
      name: [
        '',
        [Validators.required, Validators.pattern(this.tenantNamePattern), this.tenantSlugValidator()],
      ],
      email: ['', [Validators.required, Validators.email]],
      phoneNumber: [''],
      description: ['', Validators.maxLength(500)],
      countryId: [null as number | null],
      stateId: [{ value: null as number | null, disabled: true }],
      city: [{ value: null as string | null, disabled: true }],
      address: ['', Validators.maxLength(200)],
      postalCode: [''],
      planId: [null as number | null, Validators.required],
      billingCycle: ['monthly', Validators.required],
      trialDays: [14],
    });
  }

  applyEditModeValidators(): void {
    ['planId', 'billingCycle'].forEach((key) => {
      const control = this.form.get(key);
      control?.clearValidators();
      control?.updateValueAndValidity({ emitEvent: false });
    });
  }

  loadLookups(): void {
    this.tenantService.getCountries().subscribe({
      next: (res) => {
        this.countries = this.asOptions(res);
        if (!this.countries.length) {
          this.toastr.warning('No countries returned from the server');
        }
      },
      error: (err) =>
        this.toastr.error(this.extractError(err, 'Failed to load countries')),
    });

    this.planService.getPlans().subscribe({
      next: (res) => {
        this.plans = (res?.data || [])
          .filter((p) => p.status !== 'inactive')
          .sort((a, b) =>
            String(a.name || '').localeCompare(String(b.name || ''), undefined, {
              sensitivity: 'base',
            })
          );
      },
      error: () => this.toastr.error('Failed to load plans'),
    });
  }

  loadStates(countryId: number): void {
    this.tenantService.getStates(countryId).subscribe({
      next: (res) => {
        this.states = this.asOptions(res);
      },
      error: () => {
        this.states = [];
        this.toastr.error('Failed to load states');
      },
    });
  }

  loadCities(stateId: number): void {
    this.tenantService.getCities(stateId).subscribe({
      next: (res) => {
        this.cities = this.asOptions(res);
      },
      error: () => {
        this.cities = [];
        this.toastr.error('Failed to load cities');
      },
    });
  }

  loadTenant(): void {
    this.loading = true;
    this.tenantService.getOne(this.tenantId).subscribe({
      next: (res) => {
        const t = res.data;
        this.tenant = t;
        const countryId = t.countryId ?? t.country_id ?? (typeof t.country === 'object' ? t.country?.id : null);
        const stateId = t.stateId ?? t.state_id ?? (typeof t.state === 'object' ? t.state?.id : null);
        const planId =
          t.planId ??
          t.plan_id ??
          (typeof t.plan === 'object' && t.plan ? t.plan.id : null);

        this.existingDomain =
          t.domain ||
          t.customDomain ||
          t.custom_domain ||
          (t.subdomain ? `${t.subdomain}.com` : '') ||
          '';

        this.form.patchValue(
          {
            name: t.name || '',
            email: t.email || '',
            phoneNumber: this.formatPhone(t),
            description: t.description || '',
            countryId: countryId ?? null,
            stateId: stateId ?? null,
            city: t.city || null,
            address: t.address || '',
            postalCode: t.postalCode || t.postal_code || '',
            planId: planId ?? null,
            billingCycle: t.billingCycle || t.billing_cycle || 'monthly',
            trialDays: t.trialDays ?? t.trial_days ?? 0,
          },
          { emitEvent: false }
        );

        this.syncLocationControls(!!countryId, !!stateId);
        if (countryId) this.loadStates(Number(countryId));
        if (stateId) this.loadCities(Number(stateId));
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.toastr.error('Failed to load organization');
      },
    });
  }

  saveTenant(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toastr.error('Please fill in all required fields correctly');
      return;
    }

    if (!this.isEditMode && !this.tenantSlug) {
      this.toastr.error('Organization name must produce a valid subdomain');
      return;
    }

    this.saving = true;

    if (this.isEditMode) {
      const payload = this.buildUpdatePayload();
      this.tenantService.update(this.tenantId, payload).subscribe({
        next: (res) => {
          this.saving = false;
          this.toastr.success(res?.message || 'Organization updated successfully');
          this.router.navigate(['/tenants']);
        },
        error: (err) => {
          this.saving = false;
          this.toastr.error(this.extractError(err, 'Failed to update organization'));
        },
      });
      return;
    }

    const payload = this.buildCreatePayload();
    this.tenantService.create(payload).subscribe({
      next: (res) => {
        this.saving = false;
        this.toastr.success(res?.message || 'Organization created successfully');
        this.router.navigate(['/tenants']);
      },
      error: (err) => {
        this.saving = false;
        this.toastr.error(this.extractError(err, 'Failed to create organization'));
      },
    });
  }

  planLabel(plan?: MasterPlan | null): string {
    if (!plan) return '—';
    const cycle = this.form?.value?.billingCycle || plan.billingCycle || 'monthly';
    if (cycle === 'yearly') {
      const yearly = displayMoney(
        plan.prices?.yearly?.formatted || plan.formattedYearlyPrice,
        plan.prices?.yearly?.amount ?? plan.yearlyPrice
      );
      return `${plan.name} — ${yearly} / yearly`;
    }
    const monthly = displayMoney(
      plan.prices?.monthly?.formatted || plan.formattedPrice,
      plan.prices?.monthly?.amount ?? plan.price
    );
    return `${plan.name} — ${monthly} / monthly`;
  }

  onClearMouseDown(event: Event, controlName: 'countryId' | 'stateId' | 'city'): void {
    event.preventDefault();
    event.stopPropagation();
    this.clearLocationControl(controlName);
  }

  clearLocationControl(controlName: 'countryId' | 'stateId' | 'city'): void {
    this.form.get(controlName)?.setValue(null);
  }

  backToList(): void {
    this.router.navigate(['/tenants']);
  }

  private buildCreatePayload(): TenantCreatePayload {
    const v = this.form.getRawValue();
    const slug = this.slugifyTenantName(v.name);
    const email = String(v.email || '').trim();
    const name = String(v.name || '').trim();
    const password = this.createRandomPassword();

    return {
      name,
      // Backend derives subdomain from domain (e.g. folio3.com → folio3.eusocial...).
      domain: `${slug}.com`,
      email,
      phoneNumber: String(v.phoneNumber || '').trim() || undefined,
      description: String(v.description || '').trim() || undefined,
      countryId: v.countryId != null ? Number(v.countryId) : null,
      stateId: v.stateId != null ? Number(v.stateId) : null,
      city: v.city ? String(v.city).trim() : undefined,
      address: String(v.address || '').trim() || undefined,
      postalCode: String(v.postalCode || '').trim() || undefined,
      planId: Number(v.planId),
      billingCycle: v.billingCycle,
      trialDays: Number(v.trialDays ?? 0),
      admin: {
        name,
        email,
        password,
        confirmPassword: password,
      },
    };
  }

  private buildUpdatePayload(): TenantUpdatePayload {
    const v = this.form.getRawValue();
    const payload: TenantUpdatePayload = {
      name: String(v.name || '').trim(),
      email: String(v.email || '').trim(),
      phoneNumber: String(v.phoneNumber || '').trim() || undefined,
      description: String(v.description || '').trim() || undefined,
      countryId: v.countryId != null ? Number(v.countryId) : null,
      stateId: v.stateId != null ? Number(v.stateId) : null,
      city: v.city ? String(v.city).trim() : undefined,
      address: String(v.address || '').trim() || undefined,
      postalCode: String(v.postalCode || '').trim() || undefined,
    };

    if (this.existingDomain) {
      payload.domain = this.existingDomain;
    }

    return payload;
  }

  /** folio3 / Acme Corp → folio3 / acmecorp (subdomain slug). */
  private slugifyTenantName(name: string): string {
    return String(name || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
      .slice(0, 40);
  }

  private tenantSlugValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = String(control.value || '').trim();
      if (!value) return null;
      const slug = this.slugifyTenantName(value);
      return slug.length >= 2 ? null : { invalidSlug: true };
    };
  }

  private createRandomPassword(): string {
    const length = 12;
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

  private formatPhone(t: Tenant): string {
    const number = String(t.phoneNumber || t.phone_number || '').trim();
    const code = String(t.phoneCountryCode || t.phone_country_code || '').trim();
    if (number && code && !number.startsWith('+')) {
      return `${code} ${number}`.trim();
    }
    return number;
  }

  private syncLocationControls(hasCountry: boolean, hasState: boolean): void {
    const stateCtrl = this.form.get('stateId');
    const cityCtrl = this.form.get('city');

    if (hasCountry) stateCtrl?.enable({ emitEvent: false });
    else stateCtrl?.disable({ emitEvent: false });

    if (hasState) cityCtrl?.enable({ emitEvent: false });
    else cityCtrl?.disable({ emitEvent: false });
  }

  private asOptions(res: any): SelectOption[] {
    const rows = Array.isArray(res)
      ? res
      : res?.data || res?.items || res?.results || res?.countries || res?.states || res?.cities || [];
    return (rows || [])
      .map((row: any) => ({
        id: Number(row.id ?? row.value ?? row.country_id ?? row.state_id ?? row.city_id),
        name: String(
          row.name ?? row.label ?? row.title ?? row.country_name ?? row.state_name ?? row.city_name ?? ''
        ),
      }))
      .filter((row: SelectOption) => Number.isFinite(row.id) && row.id > 0 && !!row.name)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }

  private extractError(err: any, fallback: string): string {
    const msg = err?.error?.message;
    if (Array.isArray(msg)) return msg.join(', ');
    if (typeof msg === 'string') return msg;
    return fallback;
  }
}
