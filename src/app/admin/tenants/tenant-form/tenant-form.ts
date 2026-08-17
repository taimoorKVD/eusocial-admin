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

  industries: string[] = [
    'Bakery',
    'Bar',
    'Cafe',
    'Catering',
    'Cloud Kitchen',
    'Food Truck',
    'Hotel',
    'Other',
    'QSR',
    'Restaurant',
  ];
  countries: SelectOption[] = [];
  states: SelectOption[] = [];
  cities: SelectOption[] = [];
  plans: MasterPlan[] = [];

  showPassword = false;
  showConfirmPassword = false;

  readonly trialOptions = [
    { value: 0, label: 'No trial' },
    { value: 7, label: '7 days' },
    { value: 14, label: '14 days' },
    { value: 30, label: '30 days' },
  ];

  private readonly destroy$ = new Subject<void>();
  private readonly domainPattern =
    /^(?=.{1,253}$)(?!-)(?:[a-zA-Z0-9-]{1,63}\.)+[a-zA-Z]{2,63}$/;

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

  get subdomainPreview(): string {
    const domain = String(this.form?.value?.domain || '').trim().toLowerCase();
    if (!domain) return 'acme.eusocial.com';
    const slug = domain.split('.')[0] || 'acme';
    return `${slug}.eusocial.com`;
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
    this.form = this.fb.group(
      {
        name: ['', Validators.required],
        domain: ['', [Validators.required, Validators.pattern(this.domainPattern)]],
        email: ['', [Validators.required, Validators.email]],
        phoneNumber: [''],
        industry: [''],
        description: ['', Validators.maxLength(500)],
        countryId: [null as number | null],
        stateId: [{ value: null as number | null, disabled: true }],
        city: [{ value: null as string | null, disabled: true }],
        address: ['', Validators.maxLength(200)],
        postalCode: [''],
        planId: [null as number | null, Validators.required],
        billingCycle: ['monthly', Validators.required],
        trialDays: [14],
        adminName: ['', Validators.required],
        adminEmail: ['', [Validators.required, Validators.email]],
        adminPassword: ['', [Validators.required, Validators.minLength(8)]],
        adminConfirmPassword: ['', Validators.required],
      },
      { validators: this.passwordsMatchValidator() }
    );
  }

  applyEditModeValidators(): void {
    ['adminName', 'adminEmail', 'adminPassword', 'adminConfirmPassword', 'planId', 'billingCycle'].forEach(
      (key) => {
        const control = this.form.get(key);
        control?.clearValidators();
        control?.updateValueAndValidity({ emitEvent: false });
      }
    );
    this.form.setValidators(null);
    this.form.updateValueAndValidity({ emitEvent: false });
  }

  loadLookups(): void {
    this.tenantService.getIndustries().subscribe({
      next: (res) => {
        const list = this.asStringList(res);
        if (list.length) this.industries = list;
      },
      error: () => undefined,
    });

    this.tenantService.getCountries().subscribe({
      next: (res) => {
        this.countries = this.asOptions(res);
      },
      error: () => this.toastr.error('Failed to load countries'),
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

        this.form.patchValue(
          {
            name: t.name || '',
            domain: t.domain || t.customDomain || t.custom_domain || '',
            email: t.email || '',
            phoneNumber: this.formatPhone(t),
            industry: t.industry || '',
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
        this.toastr.error('Failed to load tenant');
      },
    });
  }

  saveTenant(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toastr.error('Please fill in all required fields correctly');
      return;
    }

    this.saving = true;

    if (this.isEditMode) {
      const payload = this.buildUpdatePayload();
      this.tenantService.update(this.tenantId, payload).subscribe({
        next: (res) => {
          this.saving = false;
          this.toastr.success(res?.message || 'Tenant updated successfully');
          this.router.navigate(['/tenants']);
        },
        error: (err) => {
          this.saving = false;
          this.toastr.error(this.extractError(err, 'Failed to update tenant'));
        },
      });
      return;
    }

    const payload = this.buildCreatePayload();
    this.tenantService.create(payload).subscribe({
      next: (res) => {
        this.saving = false;
        this.toastr.success(res?.message || 'Tenant created successfully');
        this.router.navigate(['/tenants']);
      },
      error: (err) => {
        this.saving = false;
        this.toastr.error(this.extractError(err, 'Failed to create tenant'));
      },
    });
  }

  generatePassword(): void {
    const password = this.createRandomPassword();
    this.form.patchValue({
      adminPassword: password,
      adminConfirmPassword: password,
    });
    this.showPassword = true;
    this.showConfirmPassword = true;
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPassword(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  planLabel(plan?: MasterPlan | null): string {
    if (!plan) return '—';
    return `${plan.name} — ${displayMoney(plan.formattedPrice, plan.price)} / ${plan.billingCycle}`;
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
    return {
      name: String(v.name || '').trim(),
      domain: String(v.domain || '').trim().toLowerCase(),
      email: String(v.email || '').trim(),
      phoneNumber: String(v.phoneNumber || '').trim() || undefined,
      industry: v.industry || undefined,
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
        name: String(v.adminName || '').trim(),
        email: String(v.adminEmail || '').trim(),
        password: String(v.adminPassword || ''),
        confirmPassword: String(v.adminConfirmPassword || ''),
      },
    };
  }

  private buildUpdatePayload(): TenantUpdatePayload {
    const v = this.form.getRawValue();
    return {
      name: String(v.name || '').trim(),
      domain: String(v.domain || '').trim().toLowerCase(),
      email: String(v.email || '').trim(),
      phoneNumber: String(v.phoneNumber || '').trim() || undefined,
      industry: v.industry || undefined,
      description: String(v.description || '').trim() || undefined,
      countryId: v.countryId != null ? Number(v.countryId) : null,
      stateId: v.stateId != null ? Number(v.stateId) : null,
      city: v.city ? String(v.city).trim() : undefined,
      address: String(v.address || '').trim() || undefined,
      postalCode: String(v.postalCode || '').trim() || undefined,
    };
  }

  private passwordsMatchValidator(): ValidatorFn {
    return (group: AbstractControl): ValidationErrors | null => {
      const password = group.get('adminPassword')?.value;
      const confirm = group.get('adminConfirmPassword')?.value;
      if (!password && !confirm) return null;
      return password === confirm ? null : { passwordsMismatch: true };
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
    const rows = Array.isArray(res) ? res : res?.data || res?.items || [];
    return (rows || [])
      .map((row: any) => ({
        id: Number(row.id ?? row.value),
        name: String(row.name ?? row.label ?? row.title ?? ''),
      }))
      .filter((row: SelectOption) => row.id && row.name)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }

  private asStringList(res: any): string[] {
    const rows = Array.isArray(res) ? res : res?.data || [];
    return (rows || [])
      .map((row: any) => (typeof row === 'string' ? row : row?.name || row?.label || row?.value))
      .filter(Boolean)
      .map((v: string) => String(v))
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }

  private extractError(err: any, fallback: string): string {
    const msg = err?.error?.message;
    if (Array.isArray(msg)) return msg.join(', ');
    if (typeof msg === 'string') return msg;
    return fallback;
  }
}
