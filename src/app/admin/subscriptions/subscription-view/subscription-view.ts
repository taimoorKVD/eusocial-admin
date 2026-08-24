import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { environment } from '../../../../environments/environment';
import { MasterSubscription } from '../../../interfaces/master-billing';
import { MasterSubscriptionService } from '../../../services/master-subscription.service';
import { displayMoney } from '../../../shared/utils/money.util';

@Component({
  selector: 'app-subscription-view',
  standalone: false,
  templateUrl: './subscription-view.html',
  styleUrl: './subscription-view.scss',
})
export class SubscriptionView implements OnInit {
  loading = true;
  subscription: MasterSubscription | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private subscriptionService: MasterSubscriptionService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      this.toastr.error('Invalid subscription');
      this.back();
      return;
    }
    this.load(id);
  }

  load(id: number): void {
    this.loading = true;
    this.subscriptionService.getSubscription(id).subscribe({
      next: (res) => {
        this.subscription = res.data;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.toastr.error(err?.error?.message || 'Failed to load subscription');
        this.back();
      },
    });
  }

  back(): void {
    this.router.navigate(['/subscriptions']);
  }

  money(formatted?: string | null, amount?: number | null): string {
    return displayMoney(formatted, amount);
  }

  formatStatus(status?: string | null): string {
    const raw = (status || '—').toString().trim().replace(/[_-]+/g, ' ');
    if (!raw || raw === '—') return '—';
    return raw
      .split(/\s+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  }

  statusClass(status?: string | null): string {
    return `is-${(status || 'draft').toLowerCase()}`;
  }

  cycleLabel(cycle?: string | null): string {
    if (!cycle) return '—';
    return cycle.charAt(0).toUpperCase() + cycle.slice(1);
  }

  formatDate(value?: string | null): string {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  tenantDomain(sub: MasterSubscription): string {
    const base = environment.baseDomain || 'eusocial.thebetawebsite.com';
    const t = sub.tenant;
    if (!t) return '—';
    const slug =
      (t.subdomain || '').trim() ||
      this.slugFromStoredDomain(t.domain || '');
    if (slug) return `${slug}.${base}`;
    return (t.domain || '').trim() || '—';
  }

  private slugFromStoredDomain(domain: string): string {
    const d = (domain || '').trim().toLowerCase();
    if (!d) return '';
    const host = d.replace(/^https?:\/\//, '').split('/')[0];
    const first = host.split('.')[0];
    return first && first !== 'www' ? first : '';
  }
}
