import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { MasterPlan } from '../../../interfaces/master-billing';
import { MasterPlanService } from '../../../services/master-plan.service';
import { displayMoney } from '../../../shared/utils/money.util';

@Component({
  selector: 'app-plan-view',
  standalone: false,
  templateUrl: './plan-view.html',
  styleUrl: './plan-view.scss',
})
export class PlanView implements OnInit {
  loading = true;
  plan: MasterPlan | null = null;
  private planId!: number;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private planService: MasterPlanService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.planId = Number(this.route.snapshot.paramMap.get('id'));
    if (!this.planId) {
      this.toastr.error('Invalid plan');
      this.back();
      return;
    }
    this.load();
  }

  load(): void {
    this.loading = true;
    this.planService.getPlan(this.planId).subscribe({
      next: (res) => {
        this.plan = res.data;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.toastr.error(err?.error?.message || 'Failed to load plan');
        this.back();
      },
    });
  }

  back(): void {
    this.router.navigate(['/plans']);
  }

  edit(): void {
    this.router.navigate(['/plans', this.planId, 'edit']);
  }

  money(plan: MasterPlan): string {
    return displayMoney(plan.formattedPrice, plan.price);
  }

  usersLimitLabel(plan: MasterPlan): string {
    return plan.usersLimit == null ? 'Unlimited' : String(plan.usersLimit);
  }

  cycleLabel(cycle?: string | null): string {
    if (!cycle) return '—';
    return cycle.charAt(0).toUpperCase() + cycle.slice(1);
  }

  storageLabel(plan: MasterPlan): string {
    if (plan.storage) return plan.storage;
    if (plan.storageGb != null) return `${plan.storageGb} GB`;
    return '—';
  }

  statusLabel(plan: MasterPlan): string {
    return plan.status === 'active' ? 'Active' : 'Inactive';
  }

  accessibleModules(plan: MasterPlan): string[] {
    if (plan.allowedModules?.length) return plan.allowedModules;
    return (plan.modules || []).filter((m) => m.enabled).map((m) => m.name || m.key);
  }

  moduleLabel(keyOrName: string, plan: MasterPlan): string {
    const fromModules = (plan.modules || []).find((m) => m.key === keyOrName || m.name === keyOrName);
    return fromModules?.name || keyOrName;
  }
}
