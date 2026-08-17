import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Dashboard } from './dashboard';
import { MasterDashboardService } from '../../services/master-dashboard.service';
import { Auth } from '../../services/auth';

describe('Dashboard', () => {
  let component: Dashboard;
  let fixture: ComponentFixture<Dashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [Dashboard],
      providers: [
        {
          provide: MasterDashboardService,
          useValue: {
            getDashboard: () =>
              of({
                success: true,
                data: {
                  kpis: {
                    totalTenants: {
                      value: 1,
                      change: 0,
                      changeType: 'count',
                      changeLabel: '+0 this month',
                      trend: [1],
                      available: true,
                    },
                    activeTenants: {
                      value: 1,
                      change: 0,
                      changeType: 'count',
                      changeLabel: '+0 this month',
                      trend: [1],
                      available: true,
                    },
                    totalUsers: {
                      value: 1,
                      change: 0,
                      changeType: 'count',
                      changeLabel: '+0 this month',
                      trend: [1],
                      available: true,
                    },
                    mrr: {
                      value: 0,
                      change: 0,
                      changeType: 'percent',
                      changeLabel: '+0.0% this month',
                      trend: [0],
                      available: false,
                      currency: 'USD',
                    },
                    activeSubscriptions: {
                      value: 0,
                      change: 0,
                      changeType: 'count',
                      changeLabel: '+0 this month',
                      trend: [0],
                      available: false,
                    },
                    platformRevenue: {
                      value: 0,
                      change: 0,
                      changeType: 'percent',
                      changeLabel: '+0.0% this month',
                      trend: [0],
                      available: false,
                      currency: 'USD',
                    },
                  },
                  tenantsOverview: {
                    period: 'this_month',
                    series: { newTenants: [], activeTenants: [] },
                    summary: { newTenants: 0, upgraded: 0, downgraded: 0, cancelled: 0 },
                  },
                  planDistribution: {
                    available: false,
                    total: 1,
                    segments: [{ key: 'unassigned', name: 'Unassigned', count: 1, percentage: 100 }],
                  },
                  recentTenants: [],
                  systemHealth: {
                    database: { status: 'healthy', label: 'OK', available: true },
                    storage: { status: 'unknown', label: 'N/A', available: false },
                    email: { status: 'healthy', label: 'OK', available: true },
                    api: { status: 'healthy', label: 'OK', available: true },
                  },
                },
              }),
          },
        },
        {
          provide: Auth,
          useValue: {
            currentUser$: of({ id: 1, name: 'Super Admin', email: 'superadmin@system.com' }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Dashboard);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
