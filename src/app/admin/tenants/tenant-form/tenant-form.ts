import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TenantService } from '../../../services/tenant.service';
import { ActivatedRoute, Router } from '@angular/router';
import { Tenant } from '../../../interfaces/tenant';

@Component({
  selector: 'app-tenant-form',
  standalone: false,
  templateUrl: './tenant-form.html',
  styleUrl: './tenant-form.scss',
})
export class TenantForm {
  form!: FormGroup;
  message = '';
  isEditMode = false;
  tenantId!: number;
  tenant: Tenant | null = null;
  loading = false;
  saving = false;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private tenantService: TenantService
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      name: ['', Validators.required],
      customDomain: [''],
    });

    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.isEditMode = true;
        this.tenantId = +id;
        this.loadTenant();
      }
    });
  }

  loadTenant(): void {
    this.tenantService.getOne(this.tenantId).subscribe({
      next: (res) => {
        const t = res.data;
        this.form.patchValue({
          name: t.name,
          customDomain: t.customDomain,
        });
      },
      error: () => (this.message = 'Failed to load tenant ❌'),
    });
  }

  saveTenant(): void {
    if (this.form.invalid) return;
    const payload = this.form.value;

    const request$ = this.isEditMode
      ? this.tenantService.update(this.tenantId, payload)
      : this.tenantService.create(payload);

    request$.subscribe({
      next: (res) => {
        this.message = res.message || 'Saved successfully ✅';
        setTimeout(() => this.router.navigate(['/tenants']), 800);
      },
      error: () => (this.message = 'Failed to save tenant ❌'),
    });
  }

  deleteTenant(): void {
    if (!confirm('Are you sure you want to delete this tenant?')) return;
    this.tenantService.delete(this.tenantId).subscribe({
      next: () => {
        this.message = 'Tenant deleted ✅';
        setTimeout(() => this.router.navigate(['/tenants']), 800);
      },
      error: () => (this.message = 'Failed to delete tenant ❌'),
    });
  }

  backToList(): void {
    this.router.navigate(['/tenants']);
  }

  get f() {
    return this.form.controls;
  }
}
