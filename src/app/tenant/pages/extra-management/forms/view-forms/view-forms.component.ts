import { Component, DestroyRef, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { environment } from '../../../../../../environments/environment';
import { SharedModule } from '../../../../../shared/shared.module';
import { GlobalFilterField } from '../../../../../shared/global-filter/global-filter';
import { pruneFiltersByAllowedKeys } from '../../../../../shared/dynamic-listing/dynamic-listing.helpers';
import {
  TenantFormStatusFilter,
  TenantFormsService,
} from '../services/tenant-forms.service';
import {
  ASSIGN_REPORT_MODE_OPTIONS,
  SavedDynamicForm,
  formatFrequencySummary,
  normalizeAssignReportMode,
} from '../models/dynamic-form.models';
import { TenantPermissionService } from '../../../../../services/tenant-permission.service';
import { TenantUserService } from '../../../../../services/tenant-user.service';
import { TenantJobPositionService } from '../../../../../services/tenant-job-position.service';
import { FormStorageService } from '../../../../forms/services/form-storage.service';
import { PERMISSIONS } from '../../../../../constants/permissions';

const FORM_FILTER_FIELDS: GlobalFilterField[] = [
  { key: 'name', label: 'Form Name', placeholder: 'Search by form name', type: 'text' },
];

interface StatusFilterOption {
  label: string;
  value: TenantFormStatusFilter;
}

@Component({
  selector: 'app-view-forms',
  standalone: true,
  imports: [CommonModule, SharedModule],
  templateUrl: './view-forms.component.html',
  styleUrl: './view-forms.component.scss',
})
export class ViewFormsComponent implements OnInit {
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.status-filter-dropdown')) {
      this.statusDropdownOpen.set(false);
    }
  }

  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly formsService = inject(TenantFormsService);
  private readonly toastr = inject(ToastrService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly permissionService = inject(TenantPermissionService);
  private readonly userService = inject(TenantUserService);
  private readonly jobPositionService = inject(TenantJobPositionService);
  private readonly formStorageService = inject(FormStorageService);

  readonly canCreate = this.permissionService.hasPermissionName(
    PERMISSIONS.DATA_COLLECTION.CREATE_TEMPLATE,
  );
  readonly canView = this.permissionService.hasPermissionName(
    PERMISSIONS.DATA_COLLECTION.VIEW_TEMPLATE,
  );
  readonly canEdit = this.permissionService.hasPermissionName(
    PERMISSIONS.DATA_COLLECTION.EDIT_TEMPLATE,
  );
  readonly canDelete = this.permissionService.hasPermissionName(
    PERMISSIONS.DATA_COLLECTION.DELETE_TEMPLATE,
  );
  /** Permission id 37 — Restore (legacy Activate slug still accepted). */
  readonly canRestore = this.permissionService.hasAnyPermission(
    PERMISSIONS.DATA_COLLECTION.RESTORE_TEMPLATE,
    PERMISSIONS.DATA_COLLECTION.ACTIVATE_TEMPLATE,
  );

  readonly statusFilters: StatusFilterOption[] = [
    { label: 'Active', value: 'active' },
    { label: 'Archived', value: 'archived' },
  ];

  readonly forms = signal<SavedDynamicForm[]>([]);
  /** Users and Job Positions used to resolve assign/report ids to names (same source as Create/Edit). */
  readonly userOptions = signal<{ id: string; name: string }[]>([]);
  readonly jobPositionOptions = signal<{ id: string; name: string }[]>([]);
  readonly loading = signal(false);
  readonly hasForms = computed(() => this.forms().length > 0);
  readonly page = signal(1);
  readonly lastPage = signal(1);
  readonly filterFields = signal<GlobalFilterField[]>([]);
  readonly hasFilterFields = computed(() => this.filterFields().length > 0);
  /** Always sent to the listing API as `status`. */
  readonly statusFilter = signal<TenantFormStatusFilter>('active');
  readonly statusDropdownOpen = signal(false);
  readonly isArchivedView = computed(() => this.statusFilter() === 'archived');
  readonly statusFilterLabel = computed(
    () =>
      this.statusFilters.find((option) => option.value === this.statusFilter())?.label ??
      'Active',
  );

  readonly showPagination = computed(() => !this.loading() && this.forms().length > 0);

  readonly showCreateButton = computed(() => this.canCreate && !this.isArchivedView());
  readonly showDeleteActions = computed(() => this.canDelete && !this.isArchivedView());
  readonly showRowActions = computed(() => {
    if (this.isArchivedView()) {
      return this.canView || this.canRestore;
    }
    return this.canEdit || this.canDelete;
  });

  readonly deleting = signal(false);
  readonly showDeleteConfirmModal = signal(false);
  readonly deleteConfirmTitle = 'Delete Form';
  readonly deleteConfirmDescription =
    'Please confirm that you want to delete this form. All related information will be permanently removed.';

  readonly restoring = signal(false);
  readonly showRestoreConfirmModal = signal(false);
  readonly restoreConfirmTitle = 'Restore Form';
  readonly restoreConfirmDescription =
    'Please confirm that you want to restore this form to the active list.';

  readonly selectedIds = signal<number[]>([]);
  readonly selectedCount = computed(() => this.selectedIds().length);
  readonly hasSelection = computed(() => this.selectedIds().length > 0);
  readonly showBulkDeleteConfirmModal = signal(false);
  readonly bulkDeleteConfirmDescription = computed(() => {
    const count = this.selectedIds().length;
    return `Delete ${count} selected form${count === 1 ? '' : 's'}? This action cannot be undone.`;
  });

  readonly visibleDeletableForms = computed(() =>
    this.forms().filter((form) => this.isFormDeletable(form)),
  );
  readonly isAllSelected = computed(() => {
    const visible = this.visibleDeletableForms();
    return visible.length > 0 && visible.every((form) => this.isSelected(form));
  });
  readonly isIndeterminate = computed(() => {
    const visible = this.visibleDeletableForms();
    const count = visible.filter((form) => this.isSelected(form)).length;
    return count > 0 && count < visible.length;
  });

  private readonly defaultLimit = environment.limit;
  private pendingDeleteId: number | null = null;
  private pendingRestoreId: number | null = null;
  private filters: Record<string, unknown> = {};

  ngOnInit(): void {
    this.filterFields.set(FORM_FILTER_FIELDS);
    this.loadJobPositions();
    this.loadUsers();
    this.loadForms(this.page());
  }

  private loadJobPositions(): void {
    this.jobPositionService
      .getJobPositions(1, 9999)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res: any) => {
          const data = res?.data || res;
          if (Array.isArray(data)) {
            this.jobPositionOptions.set(
              data.map((jp: any) => ({ id: String(jp.id), name: jp.name })),
            );
          }
        },
      });
  }

  private loadUsers(): void {
    this.formStorageService
      .loadForm('users')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (schema) => {
          const fields = schema?.fields || [];
          const nameField =
            fields.find((f: any) => f.name === 'name') ||
            fields.find((f: any) => (f.label || '').toLowerCase() === 'name');
          this.fetchUsers(nameField?.id || null);
        },
        error: () => this.fetchUsers(null),
      });
  }

  private fetchUsers(nameFieldId: string | null): void {
    this.userService
      .getUsers(1, 9999)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res: any) => {
          const data = res?.data || res;
          if (Array.isArray(data)) {
            this.userOptions.set(
              data.map((u: any) => ({
                id: String(u.id),
                name: nameFieldId ? String(u[nameFieldId] ?? '') : '',
              })),
            );
          }
        },
      });
  }

  /** Resolve ids to names using the same user/job-position options as Create/Edit. */
  private resolveIdNames(
    ids: number[] | null | undefined,
    options: { id: string; name: string }[],
  ): string[] {
    if (!ids || !ids.length) return [];
    return ids
      .map((id) => options.find((option) => Number(option.id) === id)?.name)
      .filter((name): name is string => !!name);
  }

  private formatAssigneeText(
    users: string[],
    positions: string[],
    mode?: string,
  ): string {
    const names = [...users, ...positions];
    if (!names.length) return '—';
    const normalized = normalizeAssignReportMode(mode);
    const modeLabel =
      ASSIGN_REPORT_MODE_OPTIONS.find((option) => option.value === normalized)?.label ??
      'Individual';
    return `${names.join(', ')} (${modeLabel})`;
  }

  assigneeLabel(form: SavedDynamicForm): string {
    const payload = form.payload;
    const users = this.resolveIdNames(payload?.assign?.users, this.userOptions());
    const positions = this.resolveIdNames(payload?.assign?.jobPosition, this.jobPositionOptions());
    return this.formatAssigneeText(users, positions, payload?.assign?.mode);
  }

  reportingLabel(form: SavedDynamicForm): string {
    const payload = form.payload;
    const users = this.resolveIdNames(payload?.report?.users, this.userOptions());
    const positions = this.resolveIdNames(payload?.report?.jobPosition, this.jobPositionOptions());
    return this.formatAssigneeText(users, positions, payload?.report?.mode);
  }

  frequencyLabel(form: SavedDynamicForm): string {
    return formatFrequencySummary(form.payload?.frequency);
  }

  private loadForms(page: number): void {
    this.loading.set(true);

    const allowedKeys = this.getAllowedFilterKeys();
    const fieldFilters = pruneFiltersByAllowedKeys(this.filters, allowedKeys);
    const requestFilters: Record<string, unknown> = {
      ...fieldFilters,
      status: this.statusFilter(),
    };

    const hasFieldFilters = Object.keys(fieldFilters).length > 0;
    const apiCall = hasFieldFilters
      ? this.formsService.searchForms(requestFilters, this.defaultLimit, page)
      : this.formsService.getForms(page, this.defaultLimit, requestFilters);

    apiCall
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          this.forms.set(res.forms);
          this.page.set(res.page);
          this.lastPage.set(res.lastPage);
        },
        error: () => {
          this.forms.set([]);
          this.selectedIds.set([]);
        },
      });
  }

  onStatusFilterChange(value: TenantFormStatusFilter): void {
    if (this.statusFilter() === value) {
      this.statusDropdownOpen.set(false);
      return;
    }
    this.statusFilter.set(value);
    this.statusDropdownOpen.set(false);
    this.selectedIds.set([]);
    this.page.set(1);
    this.loadForms(1);
  }

  toggleStatusDropdown(): void {
    this.statusDropdownOpen.update((open) => !open);
  }

  prevPage(): void {
    if (this.page() > 1) {
      this.selectedIds.set([]);
      this.loadForms(this.page() - 1);
    }
  }

  nextPage(): void {
    if (this.page() < this.lastPage()) {
      this.selectedIds.set([]);
      this.loadForms(this.page() + 1);
    }
  }

  onFilterSearch(filters: Record<string, unknown>): void {
    const allowedKeys = this.getAllowedFilterKeys();
    this.filters = pruneFiltersByAllowedKeys(filters, allowedKeys);
    this.selectedIds.set([]);
    this.page.set(1);
    this.loadForms(this.page());
  }

  onFilterClear(): void {
    this.filters = {};
    this.selectedIds.set([]);
    this.page.set(1);
    this.loadForms(this.page());
  }

  private getAllowedFilterKeys(): Set<string> {
    return new Set(this.filterFields().map((field) => field.key));
  }

  goToCreate(): void {
    this.router.navigate(['/dynamic-forms', 'create']);
  }

  goToView(form: SavedDynamicForm): void {
    if (!form.id) {
      return;
    }
    this.router.navigate(['edit', form.id], { relativeTo: this.route });
  }

  goToEdit(form: SavedDynamicForm): void {
    if (!form.id) {
      return;
    }
    this.router.navigate(['edit', form.id], { relativeTo: this.route });
  }

  deleteForm(form: SavedDynamicForm): void {
    if (!form.id || this.isArchivedView()) {
      return;
    }

    this.pendingDeleteId = Number(form.id);
    this.showDeleteConfirmModal.set(true);
  }

  onConfirmDeleteForm(): void {
    const id = this.pendingDeleteId;
    if (!id) {
      return;
    }

    this.closeDeleteConfirmModal();
    this.deleting.set(true);

    this.formsService
      .deleteTemplate(id)
      .pipe(
        finalize(() => this.deleting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.toastr.success('Form deleted successfully');
          this.selectedIds.set([]);
          this.reloadAfterMutation(this.forms().length === 1);
        },
        error: (err) => {
          this.toastr.error(err?.error?.message || 'Failed to delete form');
        },
      });
  }

  closeDeleteConfirmModal(): void {
    this.showDeleteConfirmModal.set(false);
    this.pendingDeleteId = null;
  }

  restoreForm(form: SavedDynamicForm): void {
    if (!form.id || !this.canRestore) {
      return;
    }

    this.pendingRestoreId = Number(form.id);
    this.showRestoreConfirmModal.set(true);
  }

  onConfirmRestoreForm(): void {
    const id = this.pendingRestoreId;
    if (!id) {
      return;
    }

    this.closeRestoreConfirmModal();
    this.restoring.set(true);

    this.formsService
      .restoreTemplate(id)
      .pipe(
        finalize(() => this.restoring.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.toastr.success('Form restored successfully');
          this.selectedIds.set([]);
          this.reloadAfterMutation(this.forms().length === 1);
        },
        error: (err) => {
          this.toastr.error(err?.error?.message || 'Failed to restore form');
        },
      });
  }

  closeRestoreConfirmModal(): void {
    this.showRestoreConfirmModal.set(false);
    this.pendingRestoreId = null;
  }

  toggleSelect(form: SavedDynamicForm): void {
    const id = this.toNumericId(form);
    if (id == null) {
      return;
    }

    this.selectedIds.update((current) =>
      current.includes(id)
        ? current.filter((selected) => selected !== id)
        : [...current, id],
    );
  }

  toggleSelectAll(): void {
    if (this.isAllSelected()) {
      this.selectedIds.set([]);
      return;
    }

    this.selectedIds.set(
      this.visibleDeletableForms()
        .map((form) => this.toNumericId(form))
        .filter((id): id is number => id != null),
    );
  }

  isSelected(form: SavedDynamicForm): boolean {
    const id = this.toNumericId(form);
    return id != null && this.selectedIds().includes(id);
  }

  isFormDeletable(form: SavedDynamicForm): boolean {
    return this.toNumericId(form) != null;
  }

  openBulkDeleteConfirm(): void {
    if (!this.hasSelection() || this.isArchivedView()) {
      return;
    }

    this.showBulkDeleteConfirmModal.set(true);
  }

  closeBulkDeleteConfirmModal(): void {
    this.showBulkDeleteConfirmModal.set(false);
  }

  onConfirmBulkDelete(): void {
    const ids = [...this.selectedIds()];
    if (!ids.length) {
      return;
    }

    const allVisibleSelected =
      this.forms().length > 0 && this.selectedIds().length === this.forms().length;

    this.closeBulkDeleteConfirmModal();
    this.deleting.set(true);

    this.formsService
      .bulkDeleteForms(ids)
      .pipe(
        finalize(() => this.deleting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.toastr.success('Forms deleted successfully');
          this.selectedIds.set([]);
          this.reloadAfterMutation(allVisibleSelected);
        },
        error: (err) => {
          this.toastr.error(err?.error?.message || 'Failed to delete forms');
        },
      });
  }

  private reloadAfterMutation(pageEmpty: boolean): void {
    if (pageEmpty && this.page() > 1) {
      this.loadForms(this.page() - 1);
    } else {
      this.loadForms(this.page());
    }
  }

  private toNumericId(form: SavedDynamicForm): number | null {
    return form.id != null && form.id !== '' ? Number(form.id) : null;
  }
}
