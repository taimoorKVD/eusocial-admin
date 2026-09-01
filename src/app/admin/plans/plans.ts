import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { BillingCycle, MasterPlan } from '../../interfaces/master-billing';
import { MasterPlanService } from '../../services/master-plan.service';
import { displayMoney } from '../../shared/utils/money.util';
import { BulkSelectionState } from '../../shared/dynamic-listing/bulk-selection.state';

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
  showBulkDeleteConfirmModal = false;
  bulkDeleting = false;
  openMenuId: number | null = null;
  priceCycle: BillingCycle = 'monthly';

  bulkSelection = new BulkSelectionState();

  constructor(
    private planService: MasterPlanService,
    private router: Router,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.loadPlans();
  }

  get bulkDeleteConfirmDescription(): string {
    const count = this.bulkSelection.count();
    return `Delete ${count} selected plan${count === 1 ? '' : 's'}? Plans with active subscriptions cannot be deleted.`;
  }

  selectablePlanIds(): number[] {
    return this.plans.map((p) => p.id).filter((id) => id != null);
  }

  isSelected(plan: MasterPlan): boolean {
    return this.bulkSelection.isSelected(plan.id);
  }

  toggleSelect(plan: MasterPlan, event?: Event): void {
    event?.stopPropagation();
    if (plan?.id == null) return;
    this.bulkSelection.toggle(plan.id);
  }

  isAllSelected(): boolean {
    return this.bulkSelection.isAllSelected(this.selectablePlanIds());
  }

  isIndeterminate(): boolean {
    return this.bulkSelection.isIndeterminate(this.selectablePlanIds());
  }

  toggleSelectAll(): void {
    this.bulkSelection.toggleAll(this.selectablePlanIds());
  }

  openBulkDeleteConfirm(): void {
    if (!this.bulkSelection.hasSelection()) return;
    this.showBulkDeleteConfirmModal = true;
  }

  closeBulkDeleteConfirmModal(): void {
    this.showBulkDeleteConfirmModal = false;
  }

  onConfirmBulkDelete(): void {
    const ids = [...this.bulkSelection.selectedIds()];
    if (!ids.length) return;

    this.closeBulkDeleteConfirmModal();
    this.bulkDeleting = true;

    this.planService.bulkDeletePlans(ids).subscribe({
      next: (res) => {
        this.toastr.success(res?.message || 'Plans deleted successfully');
        this.bulkSelection.clear();
        this.bulkDeleting = false;
        this.loadPlans();
      },
      error: (err) => {
        this.bulkDeleting = false;
        const msg =
          err?.error?.message ||
          'Failed to delete plans. Deactivate them if they have active subscriptions.';
        this.toastr.error(Array.isArray(msg) ? msg.join(', ') : msg);
      },
    });
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
        this.bulkSelection.clear();
        this.toastr.error(err?.error?.message || 'Failed to load plans');
      },
    });
  }

  setPriceCycle(cycle: BillingCycle, event?: Event): void {
    event?.stopPropagation();
    this.priceCycle = cycle;
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
        this.bulkSelection.clear();
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

  featureList(plan: MasterPlan): string[] {
    if (plan.features?.length) return plan.features.slice(0, 6);
    const items: string[] = [];
    items.push(plan.usersLimit == null ? 'Unlimited Users' : `Up to ${plan.usersLimit} Users`);
    if (plan.storage) items.push(plan.storage);
    else if (plan.storageGb != null) items.push(`${plan.storageGb} GB Storage`);
    if (plan.supportLevel) items.push(plan.supportLevel);
    return items;
  }

  displayPrice(plan: MasterPlan): string {
    return this.priceCycle === 'yearly' ? this.yearlyMoney(plan) : this.monthlyMoney(plan);
  }

  monthlyMoney(plan: MasterPlan): string {
    const formatted = plan.prices?.monthly?.formatted || plan.formattedPrice;
    const amount = plan.prices?.monthly?.amount ?? plan.price;
    return displayMoney(formatted, amount);
  }

  yearlyMoney(plan: MasterPlan): string {
    const formatted = plan.prices?.yearly?.formatted || plan.formattedYearlyPrice;
    const amount = plan.prices?.yearly?.amount ?? plan.yearlyPrice;
    return displayMoney(formatted, amount);
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
