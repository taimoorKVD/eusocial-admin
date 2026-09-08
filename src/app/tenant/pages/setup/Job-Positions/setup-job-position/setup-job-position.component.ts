import { Component, signal } from '@angular/core';
import { TenantJobPositionService } from '../../../../../services/tenant-job-position.service';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';

export interface JobPermissionItem {
  id: number;
  name: string;
}

export interface JobPermissionModule {
  name: string;
  permissions: JobPermissionItem[];
}

@Component({
  selector: 'app-setup-job-position',
  standalone: false,
  templateUrl: './setup-job-position.component.html',
  styleUrl: './setup-job-position.component.scss',
})
export class SetupJobPositionComponent {
  constructor(
    private tenantJobPosition: TenantJobPositionService,
    private router: Router,
    private route: ActivatedRoute,
    private toastr: ToastrService,
  ) {}

  /** 1 = Job details, 2 = Permission configuration */
  currentStep: 1 | 2 = 1;

  selectedJobId: number | null = null;
  /** True when this session started from /edit/:id (not after create → permissions). */
  openedAsEdit = false;
  jobTitle = '';
  selectedPermissionIds: number[] = [];
  permissionsTouched = false;

  permissionModules: JobPermissionModule[] = [];
  activeModuleIndex = 0;
  moduleSearch = '';

  isLoading = false;
  isLoadingPermissions = false;
  isSavingPermissions = false;
  permissionsLoadError = false;

  showConfirmModal = signal(false);
  confirmModalTitle = '';
  confirmModalDescription = '';
  private pendingAction: 'delete' | 'cancel' | null = null;

  get isEditMode(): boolean {
    return this.openedAsEdit;
  }

  get pageTitle(): string {
    if (this.currentStep === 2) {
      return 'Configure Permissions';
    }
    return this.isEditMode ? 'Edit Job Position' : 'Create Job Position';
  }

  get filteredModules(): JobPermissionModule[] {
    const query = this.moduleSearch.trim().toLowerCase();
    if (!query) {
      return this.permissionModules;
    }
    return this.permissionModules.filter((module) =>
      module.name.toLowerCase().includes(query),
    );
  }

  get activeModule(): JobPermissionModule | null {
    const modules = this.filteredModules;
    if (!modules.length) {
      return null;
    }
    const index = Math.min(this.activeModuleIndex, modules.length - 1);
    return modules[index] ?? null;
  }

  get selectedCount(): number {
    return this.selectedPermissionIds.length;
  }

  get activeModuleSelectedCount(): number {
    const module = this.activeModule;
    if (!module) {
      return 0;
    }
    return module.permissions.filter((p) =>
      this.selectedPermissionIds.includes(p.id),
    ).length;
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');

    if (id) {
      this.selectedJobId = +id;
      this.openedAsEdit = true;
      this.loadJobDetails();
    }
  }

  // ─── Step 1: Job details ───────────────────────────────────────────

  continueToPermissions(): void {
    if (!this.jobTitle.trim()) {
      this.toastr.error('Job title is required');
      return;
    }

    // Edit flow, or create flow after the Job Position was already created.
    if (this.selectedJobId) {
      this.openPermissionStep();
      return;
    }

    this.createJobThenOpenPermissions();
  }

  private createJobThenOpenPermissions(): void {
    this.isLoading = true;

    // Create first so we retain the real Job Position ID for the permission step.
    // Permissions are assigned in step 2 via update.
    const payload = {
      name: this.jobTitle.trim(),
      permissionIds: [] as number[],
    };

    this.tenantJobPosition.createJobPosition(payload).subscribe({
      next: (res: any) => {
        const createdId = this.extractCreatedId(res);
        this.isLoading = false;

        if (!createdId) {
          this.toastr.error('Job created but ID was not returned. Please edit it from the list.');
          this.redirectToListing();
          return;
        }

        this.selectedJobId = createdId;
        this.toastr.success('Job Position created. Configure permissions next.');
        this.openPermissionStep();
      },
      error: (err) => {
        this.isLoading = false;
        this.toastr.error(err?.error?.message || 'Failed to create Job Position');
      },
    });
  }

  private extractCreatedId(res: any): number | null {
    const candidate =
      res?.data?.id ??
      res?.data?.jobPositionId ??
      res?.id ??
      res?.jobPositionId;

    const id = Number(candidate);
    return Number.isFinite(id) && id > 0 ? id : null;
  }

  private openPermissionStep(): void {
    this.currentStep = 2;
    this.activeModuleIndex = 0;
    this.moduleSearch = '';

    if (!this.permissionModules.length && !this.isLoadingPermissions) {
      this.loadPermissions();
      return;
    }

    // Master list already loaded (e.g. user went back then forward) — re-bind by ID.
    this.syncSelectedPermissionsWithCatalog();
  }

  backToDetails(): void {
    this.currentStep = 1;
  }

  // ─── Permissions load / normalize ──────────────────────────────────

  loadPermissions(): void {
    this.isLoadingPermissions = true;
    this.permissionsLoadError = false;

    this.tenantJobPosition.getPermissions().subscribe({
      next: (res: any) => {
        this.permissionModules = this.normalizePermissionModules(res?.data);
        this.isLoadingPermissions = false;
        this.syncSelectedPermissionsWithCatalog();

        if (this.filteredModules.length) {
          this.activeModuleIndex = 0;
        }
      },
      error: () => {
        this.isLoadingPermissions = false;
        this.permissionsLoadError = true;
        this.permissionModules = [];
        this.toastr.error('Failed to load permissions');
      },
    });
  }

  /**
   * Supports both API shapes:
   * 1) Grouped: [{ module: { name }, permissions: [{ id, name }] }]
   * 2) Flat legacy: [{ id, name: "create-user" }]
   */
  private normalizePermissionModules(data: any): JobPermissionModule[] {
    if (!Array.isArray(data) || data.length === 0) {
      return [];
    }

    const first = data[0];

    // New grouped structure
    if (first?.module && Array.isArray(first?.permissions)) {
      return data
        .map((item: any) => ({
          name: String(item?.module?.name || item?.module || 'Module').trim(),
          permissions: (item.permissions || [])
            .map((p: any) => ({
              id: Number(p.id),
              name: String(p.name || '').trim(),
            }))
            .filter((p: JobPermissionItem) => Number.isFinite(p.id) && p.id > 0),
        }))
        .filter((m: JobPermissionModule) => m.name && m.permissions.length > 0);
    }

    // Legacy flat list: create-user → module "user", action "create"
    const grouped: Record<string, JobPermissionItem[]> = {};

    data.forEach((perm: any) => {
      const id = Number(perm?.id);
      if (!Number.isFinite(id) || id <= 0) {
        return;
      }

      const rawName = String(perm?.name || '');
      const parts = rawName.split('-');
      const action = parts[0] || rawName;
      const moduleKey = parts.slice(1).join('-') || 'general';
      const moduleName = moduleKey
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');

      if (!grouped[moduleName]) {
        grouped[moduleName] = [];
      }

      grouped[moduleName].push({
        id,
        name: action.charAt(0).toUpperCase() + action.slice(1),
      });
    });

    return Object.entries(grouped).map(([name, permissions]) => ({
      name,
      permissions,
    }));
  }

  // ─── Edit: load existing job + selected permissions ────────────────

  loadJobDetails(): void {
    if (!this.selectedJobId) {
      return;
    }

    this.isLoading = true;

    this.tenantJobPosition.getJobPositionById(this.selectedJobId).subscribe({
      next: (res: any) => {
        const job = res?.data ?? res;
        this.jobTitle = job?.name || '';
        this.selectedPermissionIds = this.extractPermissionIdsFromJob(job);
        this.permissionsTouched = false;
        this.isLoading = false;

        // If the user already opened step 2 (or master list is cached), bind now.
        if (this.permissionModules.length) {
          this.syncSelectedPermissionsWithCatalog();
        }
      },
      error: () => {
        this.isLoading = false;
        this.toastr.error('Failed to load job details');
      },
    });
  }

  /**
   * Pull selected permission IDs from the job edit payload.
   * Prefer IDs over names. Supports:
   * - permissionIds: number[]
   * - nested: [{ module, permissions: [{ id }] }]
   * - flat: [{ id, name }]
   */
  private extractPermissionIdsFromJob(job: any): number[] {
    if (!job || typeof job !== 'object') {
      return [];
    }

    const fromIds = this.normalizeIdList(
      job.permissionIds ?? job.permission_ids ?? job.selectedPermissionIds,
    );
    if (fromIds.length) {
      return fromIds;
    }

    const raw = job.permissions;
    if (!Array.isArray(raw) || raw.length === 0) {
      return [];
    }

    const first = raw[0];

    // Nested module groups (same shape as listing /permissions catalog)
    if (
      first &&
      typeof first === 'object' &&
      (first as { module?: unknown }).module != null &&
      Array.isArray((first as { permissions?: unknown }).permissions)
    ) {
      const nestedIds: number[] = [];
      for (const group of raw) {
        const perms = Array.isArray(group?.permissions) ? group.permissions : [];
        for (const perm of perms) {
          const id = Number(perm?.id ?? perm?.permissionId ?? perm?.permission_id);
          if (Number.isFinite(id) && id > 0) {
            nestedIds.push(id);
          }
        }
      }
      return Array.from(new Set(nestedIds));
    }

    // Flat permission objects or bare ids
    return this.normalizeIdList(raw);
  }

  private normalizeIdList(raw: unknown): number[] {
    if (!Array.isArray(raw) || raw.length === 0) {
      return [];
    }

    const ids: number[] = [];
    for (const item of raw) {
      if (typeof item === 'number' || typeof item === 'string') {
        const id = Number(item);
        if (Number.isFinite(id) && id > 0) {
          ids.push(id);
        }
        continue;
      }
      if (item && typeof item === 'object') {
        const id = Number(
          (item as { id?: unknown; permissionId?: unknown; permission_id?: unknown }).id ??
            (item as { permissionId?: unknown }).permissionId ??
            (item as { permission_id?: unknown }).permission_id,
        );
        if (Number.isFinite(id) && id > 0) {
          ids.push(id);
        }
      }
    }

    return Array.from(new Set(ids));
  }

  /**
   * Once the master permission catalog is available, keep selections that exist
   * in that catalog (matched by permission ID only).
   */
  private syncSelectedPermissionsWithCatalog(): void {
    if (!this.permissionModules.length || !this.selectedPermissionIds.length) {
      return;
    }

    const catalogIds = new Set<number>();
    for (const module of this.permissionModules) {
      for (const perm of module.permissions) {
        if (Number.isFinite(perm.id) && perm.id > 0) {
          catalogIds.add(perm.id);
        }
      }
    }

    if (!catalogIds.size) {
      return;
    }

    this.selectedPermissionIds = this.selectedPermissionIds.filter((id) =>
      catalogIds.has(id),
    );
  }

  // ─── Permission selection ──────────────────────────────────────────

  selectModule(index: number): void {
    this.activeModuleIndex = index;
  }

  onModuleSearchChange(): void {
    this.activeModuleIndex = 0;
  }

  isPermissionSelected(id: number): boolean {
    return this.selectedPermissionIds.includes(id);
  }

  togglePermission(id: number, checked: boolean): void {
    this.permissionsTouched = true;

    if (checked) {
      if (!this.selectedPermissionIds.includes(id)) {
        this.selectedPermissionIds = [...this.selectedPermissionIds, id];
      }
      return;
    }

    this.selectedPermissionIds = this.selectedPermissionIds.filter((p) => p !== id);
  }

  onPermissionCheckboxChange(event: Event, id: number): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.togglePermission(id, checked);
  }

  isModuleFullySelected(module: JobPermissionModule | null): boolean {
    if (!module?.permissions?.length) {
      return false;
    }
    return module.permissions.every((p) => this.selectedPermissionIds.includes(p.id));
  }

  isModulePartiallySelected(module: JobPermissionModule | null): boolean {
    if (!module?.permissions?.length) {
      return false;
    }
    const selected = module.permissions.filter((p) =>
      this.selectedPermissionIds.includes(p.id),
    ).length;
    return selected > 0 && selected < module.permissions.length;
  }

  toggleSelectAllForActiveModule(checked: boolean): void {
    const module = this.activeModule;
    if (!module) {
      return;
    }

    this.permissionsTouched = true;
    const ids = module.permissions.map((p) => p.id);

    if (checked) {
      const merged = new Set([...this.selectedPermissionIds, ...ids]);
      this.selectedPermissionIds = Array.from(merged);
      return;
    }

    this.selectedPermissionIds = this.selectedPermissionIds.filter(
      (id) => !ids.includes(id),
    );
  }

  onSelectAllChange(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.toggleSelectAllForActiveModule(checked);
  }

  moduleSelectedCount(module: JobPermissionModule): number {
    return module.permissions.filter((p) =>
      this.selectedPermissionIds.includes(p.id),
    ).length;
  }

  // ─── Step 2: Save permissions ──────────────────────────────────────

  savePermissions(): void {
    if (!this.selectedJobId) {
      this.toastr.error('Job Position ID is missing. Please go back and try again.');
      return;
    }

    if (!this.jobTitle.trim()) {
      this.toastr.error('Job title is required');
      this.currentStep = 1;
      return;
    }

    if (this.selectedPermissionIds.length === 0) {
      this.permissionsTouched = true;
      this.toastr.error('Please select at least one permission');
      return;
    }

    if (this.isSavingPermissions) {
      return;
    }

    const payload = {
      name: this.jobTitle.trim(),
      permissionIds: [...this.selectedPermissionIds],
    };

    this.isSavingPermissions = true;
    this.isLoading = true;

    this.tenantJobPosition.updateJobPosition(this.selectedJobId, payload).subscribe({
      next: () => {
        this.isSavingPermissions = false;
        this.isLoading = false;
        this.toastr.success(
          this.isEditMode
            ? 'Job Position permissions updated successfully'
            : 'Permissions saved successfully',
        );
        this.redirectToListing();
      },
      error: (err) => {
        // Keep selections intact so the user can retry.
        this.isSavingPermissions = false;
        this.isLoading = false;
        this.toastr.error(err?.error?.message || 'Failed to save permissions');
      },
    });
  }

  // ─── Shared actions ────────────────────────────────────────────────

  redirectToListing(): void {
    this.router.navigate(['/job-position']);
  }

  goToJobListing(): void {
    this.router.navigate(['/job-position']);
  }

  resetForm(): void {
    this.pendingAction = 'cancel';
    this.confirmModalTitle = 'Discard Changes';
    this.confirmModalDescription =
      'Are you sure you want to leave this page? Any unsaved changes will be lost.';
    this.showConfirmModal.set(true);
  }

  deleteJob(): void {
    this.pendingAction = 'delete';
    this.confirmModalTitle = 'Delete Job';
    this.confirmModalDescription =
      'Are you sure you want to delete this job? This action cannot be undone.';
    this.showConfirmModal.set(true);
  }

  onConfirmed(): void {
    this.showConfirmModal.set(false);

    switch (this.pendingAction) {
      case 'delete':
        this.confirmDeleteJob();
        break;
      case 'cancel':
        this.goToJobListing();
        break;
    }

    this.pendingAction = null;
  }

  confirmDeleteJob(): void {
    if (!this.selectedJobId) {
      return;
    }

    this.isLoading = true;

    this.tenantJobPosition.deleteJobPosition(this.selectedJobId).subscribe({
      next: () => {
        this.isLoading = false;
        this.toastr.success('Job Deleted Successfully');
        this.redirectToListing();
      },
      error: (err) => {
        this.isLoading = false;
        this.toastr.error(err?.error?.message || 'Failed to Delete Job');
      },
    });
  }

  onClosed(): void {
    this.showConfirmModal.set(false);
  }
}
