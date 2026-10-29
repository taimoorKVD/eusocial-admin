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
  SavedDynamicForm,
  formatAssignReportModeLabel,
  formatFrequencySummary,
  resolveFrequencyScheduleTimes,
} from '../models/dynamic-form.models';
import { TenantPermissionService } from '../../../../../services/tenant-permission.service';
import { TenantUserService } from '../../../../../services/tenant-user.service';
import { TenantJobPositionService } from '../../../../../services/tenant-job-position.service';
import { FormStorageService } from '../../../../forms/services/form-storage.service';
import { PERMISSIONS } from '../../../../../constants/permissions';

const FORM_FILTER_FIELDS: GlobalFilterField[] = [
  { key: 'name', label: 'Form Name', placeholder: 'Search forms', type: 'text' },
];

type ListingStatus = TenantFormStatusFilter;

interface StatusFilterOption {
  label: string;
  value: ListingStatus;
}

type SortOptionValue = 'lastEdited' | 'name';

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
    if (!target.closest('.forms-listing__actions-menu')) {
      this.closeActionsMenu();
    }
    if (!target.closest('[data-forms-filter-dropdown]')) {
      this.assignedDropdownOpen.set(false);
      this.sortDropdownOpen.set(false);
    }
  }

  @HostListener('window:resize')
  @HostListener('window:scroll')
  onViewportChange(): void {
    if (this.openActionsId()) {
      this.closeActionsMenu();
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
    { label: 'Drafts', value: 'draft' },
    { label: 'Archived', value: 'archived' },
  ];

  readonly sortOptions: ReadonlyArray<{ label: string; value: SortOptionValue }> = [
    { label: 'Last edited', value: 'lastEdited' },
    { label: 'Name', value: 'name' },
  ];

  readonly forms = signal<SavedDynamicForm[]>([]);
  /** Users and Job Positions used to resolve assign/report ids to names (same source as Create/Edit). */
  readonly userOptions = signal<{ id: string; name: string }[]>([]);
  readonly jobPositionOptions = signal<{ id: string; name: string }[]>([]);
  readonly loading = signal(false);
  readonly hasForms = computed(() => this.forms().length > 0);
  readonly page = signal(1);
  readonly lastPage = signal(1);
  readonly total = signal(0);
  readonly pageSize = signal(environment.limit || 15);
  readonly pageSizeValue = computed(() => this.pageSize());
  readonly filterFields = signal<GlobalFilterField[]>([]);
  /** API status for active/draft/archived listing requests. */
  readonly statusFilter = signal<TenantFormStatusFilter>('active');
  /** UI tab status (mirrors API status filter). */
  readonly listingStatus = signal<ListingStatus>('active');
  readonly statusCounts = signal<Record<ListingStatus, number>>({
    active: 0,
    draft: 0,
    archived: 0,
  });
  readonly searchQuery = signal('');
  readonly assignedTo = signal('anyone');
  readonly sortBy = signal<SortOptionValue>('lastEdited');
  readonly assignedDropdownOpen = signal(false);
  readonly sortDropdownOpen = signal(false);
  readonly openActionsId = signal<string | null>(null);
  /** Fixed coords so the actions menu is not clipped by listing overflow. */
  readonly actionsMenuStyle = signal<Record<string, string>>({});
  readonly isArchivedView = computed(() => this.listingStatus() === 'archived');
  readonly isDraftView = computed(() => this.listingStatus() === 'draft');
  readonly assignedToOptions = computed(() => {
    const positions = this.jobPositionOptions().map((item) => ({
      value: `position:${item.id}`,
      label: item.name,
    }));
    const users = this.userOptions()
      .filter((item) => !!item.name.trim())
      .map((item) => ({
        value: `user:${item.id}`,
        label: item.name,
      }));
    return [...positions, ...users];
  });
  readonly assignedToLabel = computed(() => {
    const value = this.assignedTo();
    if (value === 'anyone') {
      return 'Anyone';
    }
    return (
      this.assignedToOptions().find((option) => option.value === value)?.label ?? 'Anyone'
    );
  });
  readonly sortLabel = computed(
    () =>
      this.sortOptions.find((option) => option.value === this.sortBy())?.label ??
      'Last edited',
  );
  readonly displayedForms = computed(() => {
    let list = [...this.forms()];
    const assigned = this.assignedTo();
    if (assigned !== 'anyone') {
      const selected = this.assignedToOptions().find((option) => option.value === assigned);
      const selectedName = selected?.label?.trim().toLowerCase() ?? '';
      if (selectedName) {
        list = list.filter((form) =>
          this.assigneeSummary(form).names.some(
            (name) => name.trim().toLowerCase() === selectedName,
          ),
        );
      }
    }
    if (this.sortBy() === 'name') {
      list.sort((a, b) =>
        (a.formName || '').localeCompare(b.formName || '', undefined, {
          sensitivity: 'base',
        }),
      );
    } else {
      list.sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
      );
    }
    return list;
  });
  readonly emptyListMessage = computed(() => {
    if (this.isDraftView()) {
      return 'No draft forms found';
    }
    return this.isArchivedView() ? 'No archived forms found' : 'No forms created yet';
  });
  readonly listSummaryLabel = computed(() => {
    const count = this.total();
    const noun = count === 1 ? 'form' : 'forms';
    if (this.isDraftView()) {
      return `${count} draft ${noun}`;
    }
    return this.isArchivedView()
      ? `${count} archived ${noun}`
      : `${count} active ${noun}`;
  });

  readonly showPagination = computed(
    () => !this.loading() && this.forms().length > 0 && this.lastPage() > 1,
  );

  readonly showCreateButton = computed(() => this.canCreate && !this.isArchivedView());
  readonly showDeleteActions = computed(() => this.canDelete && !this.isArchivedView());
  readonly showRowActions = computed(() => {
    if (this.isArchivedView()) {
      return this.canView || this.canRestore;
    }
    return this.canView || this.canEdit || this.canDelete;
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

  private pendingDeleteId: number | null = null;
  private pendingRestoreId: number | null = null;
  private filters: Record<string, unknown> = {};
  private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.filterFields.set(FORM_FILTER_FIELDS);
    this.loadJobPositions();
    this.loadUsers();
    this.loadForms(this.page());
    this.destroyRef.onDestroy(() => {
      if (this.searchDebounceTimer) {
        clearTimeout(this.searchDebounceTimer);
      }
    });
  }

  private loadJobPositions(): void {
    // Omit limit so the full job-position set is available for Assign/Report id → name mapping.
    this.jobPositionService
      .getJobPositions(1)
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
    // Omit limit so the full user set is available for Assign/Report id → name mapping.
    this.userService
      .getUsers(1)
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
      .filter((name): name is string => !!name && !!name.trim());
  }

  private partySummary(
    users: string[],
    positions: string[],
    mode?: string,
  ): { names: string[]; modeLabel: string } {
    const names = [...users, ...positions].map((name) => name.trim()).filter(Boolean);
    const modeLabel =
      formatAssignReportModeLabel(mode, 'One response');
    return { names, modeLabel };
  }

  assigneeSummary(form: SavedDynamicForm): { names: string[]; modeLabel: string } {
    const payload = form.payload;
    const users = this.resolveIdNames(payload?.assign?.users, this.userOptions());
    const positions = this.resolveIdNames(payload?.assign?.jobPosition, this.jobPositionOptions());
    const summary = this.partySummary(users, positions, payload?.assign?.mode);
    return {
      ...summary,
      modeLabel: this.assignModeDisplay(payload?.assign?.mode, summary.modeLabel),
    };
  }

  reportingSummary(form: SavedDynamicForm): { names: string[]; modeLabel: string } {
    const payload = form.payload;
    const users = this.resolveIdNames(payload?.report?.users, this.userOptions());
    const positions = this.resolveIdNames(payload?.report?.jobPosition, this.jobPositionOptions());
    return this.partySummary(users, positions, payload?.report?.mode);
  }

  frequencyLabel(form: SavedDynamicForm): string {
    const label = formatFrequencySummary(form.payload?.frequency);
    return label === 'Daily' ? 'Every day' : label;
  }

  scheduleTimesLabel(form: SavedDynamicForm): string {
    const frequency = form.payload?.frequency;
    if (!frequency) {
      return '';
    }
    if (frequency.type === 'atOnce' && frequency.time?.trim()) {
      return frequency.time.trim();
    }
    // Times live on the recurring config (`times` / legacy `time`), which is
    // what resolveFrequencyScheduleTimes reads from its first argument.
    const times = resolveFrequencyScheduleTimes(frequency.recurring).filter(
      (slot) => !!slot?.trim(),
    );
    return times.length ? times.join(' · ') : '';
  }

  formStructureLabel(form: SavedDynamicForm): string {
    const sections = Array.isArray(form.payload?.sections) ? form.payload.sections : [];
    const sectionCount = form.sectionCount || sections.length;
    const fieldCount = sections.reduce((total, section) => {
      const rows = Array.isArray(section?.rows) ? section.rows : [];
      return (
        total +
        rows.reduce(
          (rowTotal, row) =>
            rowTotal + (Array.isArray(row?.fields) ? row.fields.length : 0),
          0,
        )
      );
    }, 0);
    const sectionLabel = `${sectionCount} section${sectionCount === 1 ? '' : 's'}`;
    const fieldLabel = `${fieldCount} field${fieldCount === 1 ? '' : 's'}`;
    return `${sectionLabel} · ${fieldLabel}`;
  }

  primaryPartyName(names: string[]): string {
    return names[0] ?? '';
  }

  extraPartyCount(names: string[]): number {
    return Math.max(0, names.length - 1);
  }

  editedDateParts(value: string | null | undefined): { dayMonth: string; year: string } {
    if (!value) {
      return { dayMonth: '—', year: '' };
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return { dayMonth: value, year: '' };
    }
    return {
      dayMonth: new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
      }).format(parsed),
      year: String(parsed.getFullYear()),
    };
  }

  statusCount(status: ListingStatus): number {
    return this.statusCounts()[status] ?? 0;
  }

  isActionsOpen(form: SavedDynamicForm): boolean {
    return !!form.id && this.openActionsId() === String(form.id);
  }

  toggleActionsMenu(form: SavedDynamicForm, event: Event): void {
    event.stopPropagation();
    const id = form.id != null ? String(form.id) : null;
    if (!id) {
      return;
    }

    const closing = this.openActionsId() === id;
    if (closing) {
      this.closeActionsMenu();
      return;
    }

    const trigger = event.currentTarget as HTMLElement | null;
    this.positionActionsMenu(trigger);
    this.openActionsId.set(id);
  }

  closeActionsMenu(): void {
    this.openActionsId.set(null);
    this.actionsMenuStyle.set({});
  }

  private positionActionsMenu(trigger: HTMLElement | null): void {
    if (!trigger) {
      this.actionsMenuStyle.set({});
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const menuWidth = 184; // ~11.5rem
    const menuMaxHeight = 220;
    const gap = 4;
    const viewportPadding = 8;

    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
    const spaceAbove = rect.top - viewportPadding;
    const openUpward = spaceBelow < 120 && spaceAbove > spaceBelow;

    let left = rect.right - menuWidth;
    left = Math.min(
      Math.max(viewportPadding, left),
      Math.max(viewportPadding, window.innerWidth - menuWidth - viewportPadding),
    );

    if (openUpward) {
      const bottom = Math.max(viewportPadding, window.innerHeight - rect.top + gap);
      this.actionsMenuStyle.set({
        position: 'fixed',
        top: 'auto',
        bottom: `${Math.round(bottom)}px`,
        left: `${Math.round(left)}px`,
        right: 'auto',
        zIndex: '80',
        maxHeight: `${Math.min(menuMaxHeight, spaceAbove)}px`,
        overflowY: 'auto',
      });
      return;
    }

    this.actionsMenuStyle.set({
      position: 'fixed',
      top: `${Math.round(rect.bottom + gap)}px`,
      bottom: 'auto',
      left: `${Math.round(left)}px`,
      right: 'auto',
      zIndex: '80',
      maxHeight: `${Math.min(menuMaxHeight, Math.max(80, spaceBelow))}px`,
      overflowY: 'auto',
    });
  }

  onSearchInput(event: Event): void {
    const value = String((event.target as HTMLInputElement | null)?.value ?? '');
    this.searchQuery.set(value);
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
    this.searchDebounceTimer = setTimeout(() => this.applySearch(), 300);
  }

  applySearch(): void {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = null;
    }
    const trimmed = this.searchQuery().trim();
    if (trimmed) {
      this.onFilterSearch({ name: trimmed });
      return;
    }
    if (Object.keys(this.filters).length > 0 || this.searchQuery() !== '') {
      this.onFilterClear();
    }
  }

  toggleAssignedDropdown(event: Event): void {
    event.stopPropagation();
    this.sortDropdownOpen.set(false);
    this.assignedDropdownOpen.update((open) => !open);
  }

  toggleSortDropdown(event: Event): void {
    event.stopPropagation();
    this.assignedDropdownOpen.set(false);
    this.sortDropdownOpen.update((open) => !open);
  }

  selectAssignedTo(value: string): void {
    this.assignedTo.set(value);
    this.assignedDropdownOpen.set(false);
  }

  selectSort(value: SortOptionValue): void {
    this.sortBy.set(value);
    this.sortDropdownOpen.set(false);
  }

  onListingStatusChange(value: ListingStatus): void {
    if (this.listingStatus() === value) {
      return;
    }
    this.listingStatus.set(value);
    this.selectedIds.set([]);
    this.openActionsId.set(null);
    this.assignedDropdownOpen.set(false);
    this.sortDropdownOpen.set(false);
    this.page.set(1);
    this.statusFilter.set(value);
    this.loadForms(1);
  }

  private assignModeDisplay(
    mode: unknown,
    fallback: string,
  ): string {
    const raw = String(mode ?? '')
      .trim()
      .toLowerCase();
    if (raw === 'individual') {
      return 'One form per person';
    }
    if (raw === 'shared') {
      return 'One shared form';
    }
    return fallback;
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
      ? this.formsService.searchForms(requestFilters, this.pageSize(), page)
      : this.formsService.getForms(page, this.pageSize(), requestFilters);

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
          this.total.set(res.total);
          if (res.counts) {
            this.statusCounts.set({
              active: res.counts.active,
              draft: res.counts.draft,
              archived: res.counts.archived,
            });
          } else {
            const status = this.statusFilter();
            this.statusCounts.update((counts) => ({
              ...counts,
              [status]: res.total,
            }));
          }
        },
        error: () => {
          this.forms.set([]);
          this.total.set(0);
          this.selectedIds.set([]);
        },
      });
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

  onPageSizeChange(size: number): void {
    if (!size || size === this.pageSize()) {
      return;
    }
    this.pageSize.set(size);
    this.page.set(1);
    this.selectedIds.set([]);
    this.loadForms(1);
  }

  onFilterSearch(filters: Record<string, unknown>): void {
    const allowedKeys = this.getAllowedFilterKeys();
    this.filters = pruneFiltersByAllowedKeys(filters, allowedKeys);
    const name = this.filters['name'];
    this.searchQuery.set(typeof name === 'string' ? name : this.searchQuery());
    this.selectedIds.set([]);
    this.openActionsId.set(null);
    this.page.set(1);
    this.loadForms(this.page());
  }

  onFilterClear(): void {
    this.filters = {};
    this.searchQuery.set('');
    this.selectedIds.set([]);
    this.openActionsId.set(null);
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

  previewForm(form: SavedDynamicForm): void {
    if (!form.id) {
      return;
    }
    this.router.navigate(['preview', form.id], {
      relativeTo: this.route,
      queryParams: { returnTo: '/dynamic-forms' },
    });
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
