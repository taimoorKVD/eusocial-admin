import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { Auth } from '../../services/auth';
import { MasterDashboardService } from '../../services/master-dashboard.service';
import {
  DashboardKpi,
  HealthStatus,
  MasterDashboardData,
  PlanSegment,
  RecentTenant,
  SystemHealthItem,
} from '../../interfaces/master-dashboard';
import { User } from '../../interfaces/user';
import { displayMoney } from '../../shared/utils/money.util';
import { environment } from '../../../environments/environment';

interface KpiCardView {
  key: string;
  title: string;
  icon: string;
  kpi: DashboardKpi | null;
  format: 'number' | 'currency';
}

interface HealthRowView {
  key: string;
  title: string;
  icon: string;
  item: SystemHealthItem | null;
}

interface ChartPoint {
  x: number;
  y: number;
  label: string;
  value: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: false,
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit, OnDestroy {
  loading = true;
  error = '';
  data: MasterDashboardData | null = null;
  user: User | null = null;

  kpiCards: KpiCardView[] = [];
  healthRows: HealthRowView[] = [];

  lineChart = {
    width: 640,
    height: 220,
    padding: { top: 16, right: 16, bottom: 28, left: 36 },
    newPath: '',
    activePath: '',
    newPoints: [] as ChartPoint[],
    activePoints: [] as ChartPoint[],
    xLabels: [] as { x: number; label: string }[],
    yTicks: [] as { y: number; label: string }[],
  };

  donut = {
    segments: [] as { color: string; dasharray: string; dashoffset: number; segment: PlanSegment }[],
    circumference: 2 * Math.PI * 54,
  };

  private readonly destroy$ = new Subject<void>();
  private readonly planColors: Record<string, string> = {
    enterprise: '#F97316',
    professional: '#FDBA74',
    standard: '#22C55E',
    basic: '#A855F7',
    trial: '#3B82F6',
    unassigned: '#CBD5E1',
  };

  constructor(
    private dashboardService: MasterDashboardService,
    private auth: Auth
  ) {}

  ngOnInit(): void {
    this.auth.currentUser$.pipe(takeUntil(this.destroy$)).subscribe((user) => {
      this.user = user;
    });
    this.loadDashboard();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get welcomeName(): string {
    return this.user?.name || 'Super Admin';
  }

  loadDashboard(): void {
    this.loading = true;
    this.error = '';

    this.dashboardService.getDashboard().subscribe({
      next: (res) => {
        this.data = res?.data ?? null;
        this.buildViews();
        this.loading = false;
      },
      error: (err) => {
        console.error('Dashboard load failed:', err);
        this.error = err?.error?.message || 'Failed to load dashboard data.';
        this.loading = false;
        this.data = null;
        this.buildViews();
      },
    });
  }

  formatKpiValue(card: KpiCardView): string {
    const kpi = card.kpi;
    if (!kpi || kpi.available === false) return '—';
    if (card.format === 'currency') {
      return displayMoney(null, kpi.value ?? 0, '$0');
    }
    return new Intl.NumberFormat('en-US').format(kpi.value ?? 0);
  }

  sparklinePoints(trend: number[] | undefined | null): string {
    const values = trend?.length ? trend : [0, 0];
    const width = 72;
    const height = 28;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    return values
      .map((v, i) => {
        const x = values.length === 1 ? width / 2 : (i / (values.length - 1)) * width;
        const y = height - ((v - min) / range) * (height - 4) - 2;
        return `${x},${y}`;
      })
      .join(' ');
  }

  formatJoinedOn(iso: string | null | undefined): string {
    if (!iso) return '—';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  planLabel(plan: string | null | undefined): string {
    return plan?.trim() ? plan : 'N/A';
  }

  planBadgeClass(plan: string | null | undefined): string {
    if (!plan) return 'plan-badge--na';
    const key = plan.toLowerCase().replace(/\s+/g, '');
    if (key.includes('enterprise')) return 'plan-badge--enterprise';
    if (key.includes('professional')) return 'plan-badge--professional';
    if (key.includes('standard')) return 'plan-badge--standard';
    if (key.includes('basic')) return 'plan-badge--basic';
    if (key.includes('trial')) return 'plan-badge--trial';
    return 'plan-badge--na';
  }

  formatStatus(status?: string | null): string {
    const raw = (status || '—').toString().trim().replace(/[_-]+/g, ' ');
    if (!raw || raw === '—') return '—';
    return raw
      .split(/\s+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  }

  statusDotClass(status: string | null | undefined): string {
    const value = (status || '').toLowerCase();
    if (value === 'active') return 'status-dot--active';
    if (value === 'trial') return 'status-dot--trial';
    if (value === 'inactive' || value === 'suspended') return 'status-dot--inactive';
    return 'status-dot--unknown';
  }

  healthStatusClass(status: HealthStatus | string | undefined): string {
    switch (status) {
      case 'healthy':
        return 'health-badge--healthy';
      case 'degraded':
        return 'health-badge--degraded';
      case 'down':
        return 'health-badge--down';
      default:
        return 'health-badge--unknown';
    }
  }

  healthStatusLabel(item: SystemHealthItem | null): string {
    if (!item || item.available === false || item.status === 'unknown') return 'Coming soon';
    if (item.status === 'healthy') return 'Healthy';
    if (item.status === 'degraded') return 'Degraded';
    if (item.status === 'down') return 'Down';
    return 'Unknown';
  }

  tenantInitials(name: string | null | undefined): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  tenantDomain(tenant: RecentTenant): string {
    const base = environment.baseDomain || 'eusocial.thebetawebsite.com';
    const slug =
      (tenant.subdomain || '').trim() ||
      this.slugFromStoredDomain(tenant.domain || tenant.customDomain || '');

    if (slug) return `${slug}.${base}`;

    const raw = (tenant.domain || tenant.customDomain || '').trim();
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

  changeTone(kpi: DashboardKpi | null): 'up' | 'down' | 'flat' {
    if (!kpi || kpi.available === false) return 'flat';
    if (kpi.change > 0) return 'up';
    if (kpi.change < 0) return 'down';
    return 'flat';
  }

  segmentColor(key: string): string {
    return this.planColors[key?.toLowerCase()] || '#94A3B8';
  }

  trackByTenantId(_: number, tenant: RecentTenant): number {
    return tenant.id;
  }

  private buildViews(): void {
    const kpis = this.data?.kpis;
    this.kpiCards = [
      { key: 'totalTenants', title: 'Total Organizations', icon: 'buildings', format: 'number', kpi: kpis?.totalTenants ?? null },
      { key: 'activeTenants', title: 'Active Organizations', icon: 'users', format: 'number', kpi: kpis?.activeTenants ?? null },
      { key: 'totalUsers', title: 'Total Users', icon: 'user', format: 'number', kpi: kpis?.totalUsers ?? null },
      { key: 'mrr', title: 'MRR', icon: 'currency', format: 'currency', kpi: kpis?.mrr ?? null },
      { key: 'activeSubscriptions', title: 'Active Subscriptions', icon: 'card', format: 'number', kpi: kpis?.activeSubscriptions ?? null },
      { key: 'platformRevenue', title: 'Platform Revenue', icon: 'coins', format: 'currency', kpi: kpis?.platformRevenue ?? null },
    ];

    const health = this.data?.systemHealth;
    this.healthRows = [
      { key: 'database', title: 'Database', icon: 'database', item: health?.database ?? null },
      { key: 'storage', title: 'Storage', icon: 'storage', item: health?.storage ?? null },
      { key: 'email', title: 'Email Service', icon: 'email', item: health?.email ?? null },
      { key: 'api', title: 'API & Services', icon: 'api', item: health?.api ?? null },
    ];

    this.buildLineChart();
    this.buildDonut();
  }

  private buildLineChart(): void {
    const series = this.data?.tenantsOverview?.series;
    const newSeries = series?.newTenants ?? [];
    const activeSeries = series?.activeTenants ?? [];

    const dateMap = new Map<string, { newCount: number; activeCount: number }>();
    for (const point of newSeries) {
      dateMap.set(point.date, { newCount: point.count, activeCount: 0 });
    }
    for (const point of activeSeries) {
      const existing = dateMap.get(point.date) || { newCount: 0, activeCount: 0 };
      existing.activeCount = point.count;
      dateMap.set(point.date, existing);
    }

    const dates = Array.from(dateMap.keys()).sort();
    const width = this.lineChart.width;
    const height = this.lineChart.height;
    const pad = this.lineChart.padding;
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;

    if (!dates.length) {
      this.lineChart.newPath = '';
      this.lineChart.activePath = '';
      this.lineChart.newPoints = [];
      this.lineChart.activePoints = [];
      this.lineChart.xLabels = [];
      this.lineChart.yTicks = [
        { y: pad.top, label: '0' },
        { y: pad.top + plotH, label: '0' },
      ];
      return;
    }

    const allValues = dates.flatMap((d) => {
      const row = dateMap.get(d)!;
      return [row.newCount, row.activeCount];
    });
    const maxY = Math.max(...allValues, 1);
    const niceMax = this.niceCeil(maxY);

    const toPoint = (date: string, value: number, index: number): ChartPoint => {
      const x =
        dates.length === 1
          ? pad.left + plotW / 2
          : pad.left + (index / (dates.length - 1)) * plotW;
      const y = pad.top + plotH - (value / niceMax) * plotH;
      return { x, y, label: date, value };
    };

    this.lineChart.newPoints = dates.map((d, i) => toPoint(d, dateMap.get(d)!.newCount, i));
    this.lineChart.activePoints = dates.map((d, i) => toPoint(d, dateMap.get(d)!.activeCount, i));
    this.lineChart.newPath = this.toSmoothPath(this.lineChart.newPoints);
    this.lineChart.activePath = this.toSmoothPath(this.lineChart.activePoints);

    const labelIndexes = this.pickLabelIndexes(dates.length);
    this.lineChart.xLabels = labelIndexes.map((i) => ({
      x: this.lineChart.newPoints[i].x,
      label: this.shortDate(dates[i]),
    }));

    const tickCount = 4;
    this.lineChart.yTicks = Array.from({ length: tickCount + 1 }, (_, i) => {
      const value = Math.round((niceMax / tickCount) * (tickCount - i));
      const y = pad.top + (plotH / tickCount) * i;
      return { y, label: String(value) };
    });
  }

  private buildDonut(): void {
    const distribution = this.data?.planDistribution;
    const segments = distribution?.segments?.length
      ? distribution.segments
      : [{ key: 'unassigned', name: 'Unassigned', count: 0, percentage: 100 }];

    const circumference = this.donut.circumference;
    let offset = 0;

    this.donut.segments = segments.map((segment) => {
      const pct = Math.max(0, Math.min(100, segment.percentage ?? 0));
      const length = (pct / 100) * circumference;
      const item = {
        color: this.segmentColor(segment.key),
        dasharray: `${length} ${circumference - length}`,
        dashoffset: -offset,
        segment,
      };
      offset += length;
      return item;
    });
  }

  private toSmoothPath(points: ChartPoint[]): string {
    if (!points.length) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? i : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] || p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return d;
  }

  private pickLabelIndexes(count: number): number[] {
    if (count <= 1) return [0];
    if (count <= 5) return Array.from({ length: count }, (_, i) => i);
    return [0, Math.floor((count - 1) / 3), Math.floor(((count - 1) * 2) / 3), count - 1];
  }

  private shortDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  private niceCeil(value: number): number {
    if (value <= 10) return 10;
    const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
    const normalized = Math.ceil(value / magnitude);
    return normalized * magnitude;
  }
}
