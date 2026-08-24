import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { environment } from '../../../../environments/environment';
import { Tenant } from '../../../interfaces/tenant';
import { TenantService } from '../../../services/tenant.service';

@Component({
  selector: 'app-tenant-view',
  standalone: false,
  templateUrl: './tenant-view.html',
  styleUrl: './tenant-view.scss',
})
export class TenantView implements OnInit {
  loading = true;
  tenant: Tenant | null = null;
  private tenantId!: number;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private tenantService: TenantService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.tenantId = Number(this.route.snapshot.paramMap.get('id'));
    if (!this.tenantId) {
      this.toastr.error('Invalid organization');
      this.back();
      return;
    }
    this.load();
  }

  load(): void {
    this.loading = true;
    this.tenantService.getOne(this.tenantId).subscribe({
      next: (res) => {
        this.tenant = res.data;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.toastr.error(err?.error?.message || 'Failed to load organization');
        this.back();
      },
    });
  }

  back(): void {
    this.router.navigate(['/tenants']);
  }

  edit(): void {
    this.router.navigate(['/tenants', this.tenantId, 'edit']);
  }

  domainOf(t: Tenant): string {
    const base = environment.baseDomain || 'eusocial.thebetawebsite.com';
    const slug =
      (t.subdomain || '').trim() ||
      this.slugFromStoredDomain(t.domain || t.customDomain || t.custom_domain || '');
    if (slug) return `${slug}.${base}`;
    const raw = (t.domain || t.customDomain || t.custom_domain || '').trim();
    return raw || '—';
  }

  planName(t: Tenant): string {
    if (!t.plan) return '—';
    if (typeof t.plan === 'string') return t.plan;
    return t.plan.name || '—';
  }

  locationName(value: Tenant['country'] | Tenant['state']): string {
    if (!value) return '—';
    if (typeof value === 'string') return value;
    return value.name || '—';
  }

  phoneOf(t: Tenant): string {
    const code = t.phoneCountryCode || t.phone_country_code || '';
    const number = t.phoneNumber || t.phone_number || '';
    const combined = `${code} ${number}`.trim();
    return combined || '—';
  }

  statusOf(t: Tenant): string {
    const raw = (t.status || 'Active').toString().trim().replace(/[_-]+/g, ' ');
    return raw
      .split(/\s+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  }

  statusClass(t: Tenant): string {
    const value = this.statusOf(t).toLowerCase();
    if (value === 'active') return 'is-active';
    if (value === 'trial') return 'is-trial';
    if (value === 'suspended' || value === 'inactive') return 'is-cancelled';
    return 'is-draft';
  }

  joinedOn(t: Tenant): string {
    const raw = t.joinedOn || t.joined_on || t.createdAt || t.created_at;
    if (!raw) return '—';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  private slugFromStoredDomain(domain: string): string {
    const d = (domain || '').trim().toLowerCase();
    if (!d) return '';
    const host = d.replace(/^https?:\/\//, '').split('/')[0];
    const first = host.split('.')[0];
    return first && first !== 'www' ? first : '';
  }
}
