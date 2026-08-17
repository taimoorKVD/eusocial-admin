import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { PlanModuleCatalogItem, PlanWritePayload } from '../../../interfaces/master-billing';
import { MasterPlanService } from '../../../services/master-plan.service';

@Component({
  selector: 'app-plan-form',
  standalone: false,
  templateUrl: './plan-form.html',
  styleUrl: './plan-form.scss',
})
export class PlanForm implements OnInit {
  form!: FormGroup;
  modules: PlanModuleCatalogItem[] = [];
  selectedModules = new Set<string>(['dashboard']);
  isEditMode = false;
  planId!: number;
  loading = true;
  saving = false;
  featuresText = '';

  constructor(
    private fb: FormBuilder,
    private planService: MasterPlanService,
    private route: ActivatedRoute,
    private router: Router,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      name: ['', Validators.required],
      slug: [''],
      description: [''],
      price: [0, [Validators.required, Validators.min(0)]],
      currency: ['USD'],
      billingCycle: ['monthly', Validators.required],
      usersLimit: [null as number | null],
      unlimitedUsers: [false],
      storageGb: [20, [Validators.min(0)]],
      supportLevel: ['Email support'],
      trialDays: [14, [Validators.min(0)]],
      sortOrder: [1, [Validators.min(0)]],
      status: ['active'],
    });

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode = true;
      this.planId = +id;
    }

    this.syncUsersLimitControl(false);

    this.loadModules(() => {
      if (this.isEditMode) this.loadPlan(this.planId);
      else this.loading = false;
    });
  }

  get f() {
    return this.form.controls;
  }

  loadModules(done?: () => void): void {
    this.planService.getModules().subscribe({
      next: (res) => {
        this.modules = res?.data || [];
        if (!this.selectedModules.size) this.selectedModules.add('dashboard');
        done?.();
      },
      error: (err) => {
        this.toastr.error(this.extractError(err, 'Failed to load modules'));
        done?.();
      },
    });
  }

  loadPlan(id: number): void {
    this.planService.getPlan(id).subscribe({
      next: (res) => {
        const plan = res.data;
        const unlimited = plan.usersLimit == null;
        this.form.patchValue({
          name: plan.name,
          slug: plan.slug,
          description: plan.description || '',
          price: plan.price,
          currency: plan.currency === 'EUR' ? 'USD' : plan.currency || 'USD',
          billingCycle: plan.billingCycle || 'monthly',
          usersLimit: unlimited ? null : plan.usersLimit,
          unlimitedUsers: unlimited,
          storageGb: plan.storageGb ?? null,
          supportLevel: plan.supportLevel || '',
          trialDays: plan.trialDays ?? 0,
          sortOrder: plan.sortOrder ?? 1,
          status: plan.status || 'active',
        });
        this.featuresText = (plan.features || []).join('\n');
        const enabled = plan.allowedModules?.length
          ? plan.allowedModules
          : (plan.modules || []).filter((m) => m.enabled).map((m) => m.key);
        this.selectedModules = new Set(enabled.length ? enabled : ['dashboard']);
        this.selectedModules.add('dashboard');
        this.syncUsersLimitControl(unlimited);
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.toastr.error(this.extractError(err, 'Failed to load plan'));
      },
    });
  }

  toggleModule(key: string, checked: boolean): void {
    if (key === 'dashboard') return;
    if (checked) this.selectedModules.add(key);
    else this.selectedModules.delete(key);
  }

  isModuleChecked(key: string): boolean {
    return this.selectedModules.has(key);
  }

  onUnlimitedChange(): void {
    const unlimited = !!this.form.value.unlimitedUsers;
    if (unlimited) this.form.patchValue({ usersLimit: null });
    this.syncUsersLimitControl(unlimited);
  }

  save(): void {
    if (this.form.invalid || this.saving) {
      this.form.markAllAsTouched();
      this.toastr.error('Please fill in all required fields correctly');
      return;
    }

    const payload = this.buildPayload();
    if (!payload.name) {
      this.toastr.error('Plan name is required');
      return;
    }
    if (Number.isNaN(payload.price)) {
      this.toastr.error('Enter a valid price');
      return;
    }

    this.saving = true;
    const req$ = this.isEditMode
      ? this.planService.updatePlan(this.planId, payload)
      : this.planService.createPlan(payload);

    req$.subscribe({
      next: (res) => {
        this.saving = false;
        this.toastr.success(
          res?.message || (this.isEditMode ? 'Plan updated successfully' : 'Plan created successfully')
        );
        this.router.navigate(['/plans']);
      },
      error: (err) => {
        this.saving = false;
        this.toastr.error(this.extractError(err, 'Failed to save plan'));
      },
    });
  }

  back(): void {
    this.router.navigate(['/plans']);
  }

  private buildPayload(): PlanWritePayload {
    const raw = this.form.getRawValue();
    const features = this.featuresText
      .split(/\r?\n|,/)
      .map((f) => f.trim())
      .filter(Boolean);

    const modules = Array.from(this.selectedModules);
    if (!modules.includes('dashboard')) modules.unshift('dashboard');

    const name = String(raw.name || '').trim();
    const slug = String(raw.slug || '').trim() || this.slugify(name);
    const description = String(raw.description || '').trim();
    const supportLevel = String(raw.supportLevel || '').trim();

    const payload: PlanWritePayload = {
      name,
      slug,
      price: Number(raw.price),
      currency: 'USD',
      billingCycle: raw.billingCycle,
      features,
      modules,
      status: raw.status || 'active',
    };

    if (description) payload.description = description;
    if (supportLevel) payload.supportLevel = supportLevel;

    if (raw.unlimitedUsers) {
      payload.usersLimit = null;
    } else if (raw.usersLimit != null && raw.usersLimit !== '') {
      payload.usersLimit = Number(raw.usersLimit);
    }

    if (raw.storageGb != null && raw.storageGb !== '') {
      payload.storageGb = Number(raw.storageGb);
    }

    if (raw.trialDays != null && raw.trialDays !== '') {
      payload.trialDays = Number(raw.trialDays);
    }

    if (raw.sortOrder != null && raw.sortOrder !== '') {
      payload.sortOrder = Number(raw.sortOrder);
    }

    return payload;
  }

  private syncUsersLimitControl(unlimited: boolean): void {
    const ctrl = this.form.get('usersLimit');
    if (unlimited) ctrl?.disable({ emitEvent: false });
    else ctrl?.enable({ emitEvent: false });
  }

  private slugify(value: string): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
  }

  private extractError(err: any, fallback: string): string {
    const body = err?.error;
    const msg = body?.message ?? body?.error ?? err?.message;
    if (Array.isArray(msg)) return msg.join(', ');
    if (typeof msg === 'string' && msg.trim()) return msg;
    if (body?.statusCode) return `${fallback} (${body.statusCode})`;
    return fallback;
  }
}
