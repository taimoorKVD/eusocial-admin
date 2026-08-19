import { Component, HostListener, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { Tenant } from '../../interfaces/tenant';
import { TenantService } from '../../services/tenant.service';
import { MasterDashboardService } from '../../services/master-dashboard.service';
import { environment } from '../../../environments/environment';

interface TenantStats {
  total: number;
  active: number;
  trial: number;
  suspended: number;
}

@Component({
  selector: 'app-tenants',
  standalone: false,
  templateUrl: './tenants.html',
  styleUrl: './tenants.scss',
})
export class Tenants implements OnInit {
  tenants: Tenant[] = [];
  loading = true;
  page = 1;
  lastPage = 1;
  total = 0;
  limit = environment.limit || 15;

  search = '';
  status: string = '';
  stats: TenantStats = { total: 0, active: 0, trial: 0, suspended: 0 };

  showDeleteModal = false;
  deleteTargetId: number | null = null;
  openMenuId: number | null = null;

  readonly statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'active', label: 'Active' },
    { value: 'trial', label: 'Trial' },
    { value: 'suspended', label: 'Suspended' },
  ];

  constructor(
    private router: Router,
    private tenantService: TenantService,
    private dashboardService: MasterDashboardService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.bootstrap();
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.openMenuId = null;
  }

  bootstrap(): void {
    this.loading = true;
    forkJoin({
      list: this.fetchList$(1),
      dash: this.dashboardService.getDashboard().pipe(catchError(() => of(null))),
    }).subscribe({
      next: ({ list, dash }) => {
        this.applyList(list);
        this.applyStats(dash?.data?.kpis, list);
        this.loading = false;
      },
      error: () => {
        this.tenants = [];
        this.total = 0;
        this.loading = false;
        this.toastr.error('Failed to load tenants');
      },
    });
  }

  allTenants(page: number = 1): void {
    this.page = page;
    this.loading = true;
    this.fetchList$(page).subscribe({
      next: (res) => {
        this.applyList(res);
        this.refreshLocalStatusCounts();
        this.loading = false;
      },
      error: () => {
        this.tenants = [];
        this.total = 0;
        this.loading = false;
        this.toastr.error('Failed to load tenants');
      },
    });
  }

  applyFilters(): void {
    this.allTenants(1);
  }

  clearFilters(): void {
    this.search = '';
    this.status = '';
    this.allTenants(1);
  }

  addTenant(): void {
    this.router.navigate(['/tenants/create']);
  }

  editTenant(id: number): void {
    this.openMenuId = null;
    this.router.navigate(['/tenants', id, 'edit']);
  }

  toggleMenu(id: number, event: Event): void {
    event.stopPropagation();
    this.openMenuId = this.openMenuId === id ? null : id;
  }

  openDeleteModal(id: number): void {
    this.deleteTargetId = id;
    this.showDeleteModal = true;
    this.openMenuId = null;
  }

  cancelDelete(): void {
    this.showDeleteModal = false;
    this.deleteTargetId = null;
  }

  confirmDelete(): void {
    if (this.deleteTargetId === null) return;
    const id = this.deleteTargetId;
    this.showDeleteModal = false;
    this.deleteTargetId = null;

    this.tenantService.delete(id).subscribe({
      next: () => {
        this.toastr.success('Tenant deleted successfully');
        this.allTenants(this.page);
      },
      error: (err) => {
        this.toastr.error(err?.error?.message || 'Failed to delete tenant');
      },
    });
  }

  domainOf(t: Tenant): string {
    return (
      t.domain ||
      t.customDomain ||
      t.custom_domain ||
      (t.subdomain ? `${t.subdomain}.eusocial.com` : '—')
    );
  }

  planName(t: Tenant): string {
    if (!t.plan) return 'N/A';
    if (typeof t.plan === 'string') return t.plan;
    return t.plan.name || 'N/A';
  }

  planBadgeClass(t: Tenant): string {
    const key = this.planName(t).toLowerCase();
    if (key.includes('enterprise')) return 'plan-badge--enterprise';
    if (key.includes('professional')) return 'plan-badge--professional';
    if (key.includes('standard')) return 'plan-badge--standard';
    if (key.includes('basic')) return 'plan-badge--basic';
    return 'plan-badge--default';
  }

  statusOf(t: Tenant): string {
    return this.formatStatus(t.status);
  }

  formatStatus(status?: string | null): string {
    const raw = (status || 'Active').toString().trim().replace(/[_-]+/g, ' ');
    if (!raw) return 'Active';
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

  initials(name?: string): string {
    const parts = (name || '?').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  pages(): number[] {
    const max = Math.min(this.lastPage, 5);
    return Array.from({ length: max }, (_, i) => i + 1);
  }

  private fetchList$(page: number) {
    const search = this.search.trim();
    const status = this.status;

    return this.tenantService
      .getTenants(page, this.limit, {
        search: search || undefined,
        status: status || undefined,
      })
      .pipe(map((res) => this.ensureFiltered(res, search, status)));
  }

  /** Keep UI correct even if API ignores status/search on the list endpoint. */
  private ensureFiltered(res: any, search: string, status: string): any {
    const rows = Array.isArray(res?.data) ? res.data : [];
    let filtered = rows;

    if (status) {
      const wanted = status.toLowerCase();
      filtered = filtered.filter(
        (t: any) => String(t?.status || '').trim().toLowerCase() === wanted
      );
    }

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter((t: any) => {
        const hay = [
          t?.name,
          t?.domain,
          t?.email,
          t?.subdomain,
          t?.customDomain,
          t?.custom_domain,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      });
    }

    if (filtered.length === rows.length) return res;

    return {
      ...res,
      data: filtered,
      meta: {
        ...(res?.meta || {}),
        total: filtered.length,
        page: 1,
        lastPage: 1,
        last_page: 1,
      },
    };
  }

  private applyList(res: any): void {
    this.tenants = (res?.data || []).map((t: any) => this.normalize(t));
    this.total = Number(res?.meta?.total ?? res?.meta?.totalItems ?? this.tenants.length) || 0;
    this.page = Number(res?.meta?.page ?? res?.meta?.current_page ?? res?.meta?.currentPage ?? 1) || 1;
    this.lastPage =
      Number(res?.meta?.lastPage ?? res?.meta?.last_page ?? Math.max(1, Math.ceil(this.total / this.limit))) || 1;
  }

  private applyStats(kpis: any, listRes: any): void {
    const totalFromMeta = Number(listRes?.meta?.total) || this.total || this.tenants.length;
    this.stats.total = Number(kpis?.totalTenants?.value) || totalFromMeta;
    this.stats.active = Number(kpis?.activeTenants?.value) || this.countStatus('active');
    this.refreshLocalStatusCounts(true);
  }

  private refreshLocalStatusCounts(keepActiveFromDash = false): void {
    const trial = this.countStatus('trial');
    const suspended = this.countStatus('suspended') + this.countStatus('inactive');
    this.stats = {
      ...this.stats,
      trial,
      suspended,
      active: keepActiveFromDash && this.stats.active
        ? this.stats.active
        : this.countStatus('active') || this.stats.active,
      total: this.total || this.stats.total,
    };
  }

  private countStatus(status: string): number {
    return this.tenants.filter((t) => this.statusOf(t).toLowerCase() === status).length;
  }

  private normalize(raw: any): Tenant {
    return {
      id: raw.id,
      name: raw.name,
      dbName: raw.dbName ?? raw.db_name,
      subdomain: raw.subdomain,
      domain: raw.domain,
      customDomain: raw.customDomain ?? raw.custom_domain ?? null,
      plan: raw.plan ?? null,
      status: this.formatStatus(raw.status ?? 'Active'),
      users: raw.users ?? null,
      joinedOn: raw.joinedOn ?? raw.joined_on ?? raw.createdAt ?? raw.created_at,
      createdAt: raw.createdAt ?? raw.created_at,
    };
  }
}
