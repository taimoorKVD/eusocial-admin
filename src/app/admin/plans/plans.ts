import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { MasterPlan } from '../../interfaces/master-billing';
import { MasterPlanService } from '../../services/master-plan.service';
import { displayMoney } from '../../shared/utils/money.util';

@Component({
  selector: 'app-plans',
  standalone: false,
  templateUrl: './plans.html',
  styleUrl: './plans.scss',
})
export class Plans implements OnInit {
  plans: MasterPlan[] = [];
  loading = true;
  showDeleteModal = false;
  deleteTargetId: number | null = null;
  openMenuId: number | null = null;

  constructor(
    private planService: MasterPlanService,
    private router: Router,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.loadPlans();
  }

  loadPlans(): void {
    this.loading = true;
    this.planService.getPlans().subscribe({
      next: (res) => {
        this.plans = [...(res?.data || [])].sort(
          (a, b) => (a.sortOrder ?? a.id) - (b.sortOrder ?? b.id)
        );
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.toastr.error(err?.error?.message || 'Failed to load plans');
      },
    });
  }

  createPlan(): void {
    this.router.navigate(['/plans/create']);
  }

  editPlan(id: number): void {
    this.openMenuId = null;
    this.router.navigate(['/plans', id, 'edit']);
  }

  viewPlan(id: number): void {
    this.openMenuId = null;
    this.router.navigate(['/plans', id, 'view']);
  }

  toggleMenu(id: number, event: Event): void {
    event.stopPropagation();
    this.openMenuId = this.openMenuId === id ? null : id;
  }

  closeMenus(): void {
    this.openMenuId = null;
  }

  openDeleteModal(id: number): void {
    this.deleteTargetId = id;
    this.showDeleteModal = true;
    this.openMenuId = null;
  }

  closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.deleteTargetId = null;
  }

  confirmDelete(): void {
    if (!this.deleteTargetId) return;
    this.planService.deletePlan(this.deleteTargetId).subscribe({
      next: (res) => {
        this.toastr.success(res?.message || 'Plan deleted successfully');
        this.closeDeleteModal();
        this.loadPlans();
      },
      error: (err) => {
        const msg =
          err?.error?.message ||
          'Failed to delete plan. Deactivate it if it has active subscriptions.';
        this.toastr.error(Array.isArray(msg) ? msg.join(', ') : msg);
        this.closeDeleteModal();
      },
    });
  }

  deactivatePlan(id: number): void {
    this.openMenuId = null;
    this.planService.updatePlan(id, { status: 'inactive' }).subscribe({
      next: (res) => {
        this.toastr.success(res?.message || 'Plan deactivated');
        this.loadPlans();
      },
      error: (err) => this.toastr.error(err?.error?.message || 'Failed to deactivate plan'),
    });
  }

  usersLimitLabel(plan: MasterPlan): string {
    return plan.usersLimit == null ? 'Unlimited' : String(plan.usersLimit);
  }

  cycleLabel(cycle: string | undefined): string {
    if (!cycle) return '—';
    return cycle.charAt(0).toUpperCase() + cycle.slice(1);
  }

  featureList(plan: MasterPlan): string[] {
    if (plan.features?.length) return plan.features.slice(0, 6);
    const items: string[] = [];
    items.push(plan.usersLimit == null ? 'Unlimited Users' : `Up to ${plan.usersLimit} Users`);
    if (plan.storage) items.push(plan.storage);
    else if (plan.storageGb != null) items.push(`${plan.storageGb} GB Storage`);
    if (plan.supportLevel) items.push(plan.supportLevel);
    return items;
  }

  money(plan: MasterPlan): string {
    return displayMoney(plan.formattedPrice, plan.price);
  }

  planBadgeClass(name: string | undefined): string {
    const key = (name || '').toLowerCase();
    if (key.includes('enterprise')) return 'plan-badge--enterprise';
    if (key.includes('professional')) return 'plan-badge--professional';
    if (key.includes('standard')) return 'plan-badge--standard';
    if (key.includes('basic')) return 'plan-badge--basic';
    return 'plan-badge--default';
  }
}
