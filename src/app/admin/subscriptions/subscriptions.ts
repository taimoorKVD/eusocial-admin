import { Component, OnInit } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { forkJoin } from 'rxjs';
import {
  MasterPlan,
  MasterSubscription,
  SubscriptionStats,
  SubscriptionStatus,
} from '../../interfaces/master-billing';
import { MasterPlanService } from '../../services/master-plan.service';
import { MasterSubscriptionService } from '../../services/master-subscription.service';
import { environment } from '../../../environments/environment';
import { displayMoney } from '../../shared/utils/money.util';

@Component({
  selector: 'app-subscriptions',
  standalone: false,
  templateUrl: './subscriptions.html',
  styleUrl: './subscriptions.scss',
})
export class Subscriptions implements OnInit {
  loading = true;
  stats: SubscriptionStats | null = null;
  subscriptions: MasterSubscription[] = [];
  plans: MasterPlan[] = [];
  page = 1;
  lastPage = 1;
  total = 0;
  limit = environment.limit || 15;

  search = '';
  planId: number | '' = '';
  status: SubscriptionStatus | '' = '';

  openMenuId: number | null = null;
  showCancelModal = false;
  showChangePlanModal = false;
  selected: MasterSubscription | null = null;
  changePlanId: number | null = null;
  cancelAtPeriodEnd = true;
  actionLoading = false;

  readonly statusOptions: { value: SubscriptionStatus | ''; label: string }[] = [
    { value: '', label: 'All Status' },
    { value: 'active', label: 'Active' },
    { value: 'trial', label: 'Trial' },
    { value: 'past_due', label: 'Past Due' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'incomplete', label: 'Incomplete' },
    { value: 'unpaid', label: 'Unpaid' },
  ];

  constructor(
    private subscriptionService: MasterSubscriptionService,
    private planService: MasterPlanService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.bootstrap();
  }

  bootstrap(): void {
    this.loading = true;
    forkJoin({
      stats: this.subscriptionService.getStats(),
      plans: this.planService.getPlans(),
      list: this.subscriptionService.getSubscriptions({
        page: this.page,
        limit: this.limit,
      }),
    }).subscribe({
      next: ({ stats, plans, list }) => {
        this.stats = stats.data;
        this.plans = plans.data || [];
        this.applyList(list);
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.toastr.error(err?.error?.message || 'Failed to load subscriptions');
      },
    });
  }

  loadList(page = 1): void {
    this.page = page;
    this.loading = true;
    this.subscriptionService
      .getSubscriptions({
        page: this.page,
        limit: this.limit,
        tenant: this.search.trim() || undefined,
        planId: this.planId || undefined,
        status: this.status || undefined,
      })
      .subscribe({
        next: (res) => {
          this.applyList(res);
          this.loading = false;
        },
        error: (err) => {
          this.loading = false;
          this.toastr.error(err?.error?.message || 'Failed to load subscriptions');
        },
      });
  }

  applyFilters(): void {
    this.loadList(1);
  }

  clearFilters(): void {
    this.search = '';
    this.planId = '';
    this.status = '';
    this.loadList(1);
  }

  toggleMenu(id: number, event: Event): void {
    event.stopPropagation();
    this.openMenuId = this.openMenuId === id ? null : id;
  }

  closeMenus(): void {
    this.openMenuId = null;
  }

  openCancel(sub: MasterSubscription): void {
    this.selected = sub;
    this.cancelAtPeriodEnd = true;
    this.showCancelModal = true;
    this.openMenuId = null;
  }

  openChangePlan(sub: MasterSubscription): void {
    this.selected = sub;
    this.changePlanId = sub.planId;
    this.showChangePlanModal = true;
    this.openMenuId = null;
  }

  confirmCancel(): void {
    if (!this.selected) return;
    this.actionLoading = true;
    this.subscriptionService
      .cancelSubscription(this.selected.id, { atPeriodEnd: this.cancelAtPeriodEnd })
      .subscribe({
        next: (res) => {
          this.actionLoading = false;
          this.showCancelModal = false;
          this.toastr.success(res?.message || 'Subscription cancelled');
          this.refreshAll();
        },
        error: (err) => {
          this.actionLoading = false;
          this.toastr.error(err?.error?.message || 'Failed to cancel subscription');
        },
      });
  }

  confirmChangePlan(): void {
    if (!this.selected || !this.changePlanId) return;
    this.actionLoading = true;
    this.subscriptionService
      .changePlan(this.selected.id, { planId: this.changePlanId, prorate: true })
      .subscribe({
        next: (res) => {
          this.actionLoading = false;
          this.showChangePlanModal = false;
          this.toastr.success(res?.message || 'Plan changed successfully');
          this.refreshAll();
        },
        error: (err) => {
          this.actionLoading = false;
          this.toastr.error(err?.error?.message || 'Failed to change plan');
        },
      });
  }

  refreshAll(): void {
    this.subscriptionService.getStats().subscribe({
      next: (res) => (this.stats = res.data),
    });
    this.loadList(this.page);
  }

  formatDate(value?: string | null): string {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  cycleLabel(cycle?: string): string {
    if (!cycle) return '—';
    return cycle.charAt(0).toUpperCase() + cycle.slice(1);
  }

  formatStatus(status?: string | null): string {
    const raw = (status || '—').toString().trim().replace(/[_-]+/g, ' ');
    if (!raw || raw === '—') return '—';
    return raw
      .split(/\s+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  }

  tenantDomain(sub: MasterSubscription): string {
    const base = environment.baseDomain || 'eusocial.thebetawebsite.com';
    const t = sub.tenant;
    if (!t) return '—';

    const slug =
      (t.subdomain || '').trim() ||
      this.slugFromStoredDomain(t.domain || '');

    if (slug) return `${slug}.${base}`;

    const raw = (t.domain || '').trim();
    if (!raw) return '—';
    return raw.replace(/\.eusocial\.com$/i, `.${base}`);
  }

  private slugFromStoredDomain(domain: string): string {
    const d = (domain || '').trim().toLowerCase();
    if (!d) return '';
    const host = d.replace(/^https?:\/\//, '').split('/')[0];
    const first = host.split('.')[0];
    return first && first !== 'www' ? first : '';
  }

  statusClass(status: string): string {
    return `is-${(status || 'draft').toLowerCase()}`;
  }

  money(formatted?: string | null, amount?: number | null): string {
    return displayMoney(formatted, amount);
  }

  planBadgeClass(name?: string): string {
    const key = (name || '').toLowerCase();
    if (key.includes('enterprise')) return 'plan-badge--enterprise';
    if (key.includes('professional')) return 'plan-badge--professional';
    if (key.includes('standard')) return 'plan-badge--standard';
    if (key.includes('basic')) return 'plan-badge--basic';
    return 'plan-badge--default';
  }

  pages(): number[] {
    const max = Math.min(this.lastPage, 5);
    return Array.from({ length: max }, (_, i) => i + 1);
  }

  private applyList(res: { data: MasterSubscription[]; meta?: any }): void {
    this.subscriptions = res?.data || [];
    this.total = res?.meta?.total ?? this.subscriptions.length;
    this.page = res?.meta?.page ?? this.page;
    this.lastPage = res?.meta?.lastPage ?? 1;
  }
}
