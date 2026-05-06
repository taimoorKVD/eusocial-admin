import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TenantService } from '../../../services/tenant.service';
import { ActivatedRoute, Router } from '@angular/router';
import { Tenant } from '../../../interfaces/tenant';
import { ToastrService } from 'ngx-toastr';

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

  showCredentialModal = false;

generatedEmail = '';
generatedPassword = '';

sendToEmail = '';
sending = false;

  private readonly customDomainPattern = /^(?=.{1,253}$)(?!-)(?:[a-zA-Z0-9-]{1,63}\.)+[a-zA-Z]{2,63}$/;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private tenantService: TenantService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      name: ['', Validators.required],
      customDomain: ['', Validators.pattern(this.customDomainPattern)],
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

  // saveTenant(): void {
  //   if (this.form.invalid) return;
  //   const payload = this.form.value;

  //   const request$ = this.isEditMode
  //     ? this.tenantService.update(this.tenantId, payload)
  //     : this.tenantService.create(payload);

  //   request$.subscribe({
  //     next: (res) => {
  //       this.message = res.message || 'Saved successfully ✅';
  //       setTimeout(() => this.router.navigate(['/tenants']), 800);
  //     },
  //     error: () => (this.message = 'Failed to save tenant ❌'),
  //   });
  // }

  saveTenant(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload = this.form.value;

    const request$ = this.isEditMode
      ? this.tenantService.update(this.tenantId, payload)
      : this.tenantService.create(payload);

    request$.subscribe({
      next: (res: any) => {
        this.message = res.message || 'Saved successfully ✅';

        if (!this.isEditMode) {
          this.toastr.success('Tenant created successfully');
           this.tenantId = res.data?.id; // ✅ REQUIRED
          // ✅ FIXED PATH
          this.generatedEmail = res.data?.admin?.email || '';
          this.generatedPassword = res.data?.admin?.password || '';

          this.showCredentialModal = true;
        } else {
          this.toastr.success('Tenant updated successfully');
          setTimeout(() => this.router.navigate(['/tenants']), 800);
        }
      },
      error: () => (this.message = 'Failed to save tenant ❌'),
    });
  }

copy(value: string) {
  navigator.clipboard.writeText(value);
}

sendCredentials() {
  if (!this.sendToEmail) return;

  this.sending = true;

  this.tenantService
    .sendCredentials(this.tenantId, this.sendToEmail)
    .subscribe({
      next: () => {
        this.sending = false;
        alert('Credentials sent ✅');
      },
      error: () => {
        this.sending = false;
        alert('Failed ❌');
      }
    });
}

closeModal() {
  this.showCredentialModal = false;
  this.router.navigate(['/tenants']);
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
