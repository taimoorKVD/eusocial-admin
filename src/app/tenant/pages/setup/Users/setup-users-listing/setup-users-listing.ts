import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { TenantUserService } from '../../../../../services/tenant-user.service';
import { TenantSessionService } from '../../../../../services/tenant-session.service';
import { environment } from '../../../../../../environments/environment.prod';
import { FormStorageService } from '../../../../forms/services/form-storage.service';
import { normalizeFieldOrder } from '../../../../form-builder/utils/form-field.factory';
import { DynamicField, DynamicFieldType } from '../../../../../interfaces/dynamic-field';
import { GlobalFilterField } from '../../../../../shared/global-filter/global-filter';
import {
  getVisibleColumns,
  mapVisibleColumnsToFilterFields,
  pruneFiltersByAllowedKeys,
} from '../../../../../shared/dynamic-listing/dynamic-listing.helpers';
import { loadDynamicDropdownOptions } from '../../../../../shared/dynamic-listing/dynamic-field-options.loader';
import { ToastrService } from 'ngx-toastr';

const USERS_LISTING_FILTER_EXCLUDE_TYPES: DynamicFieldType[] = ['image'];

@Component({
  selector: 'app-setup-users-listing',
  standalone: false,
  templateUrl: './setup-users-listing.html',
  styleUrl: './setup-users-listing.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetupUsersListing {
  private readonly userService = inject(TenantUserService);
  private readonly toastr = inject(ToastrService);
  readonly session = inject(TenantSessionService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly formStorageService = inject(FormStorageService);
  private readonly destroyRef = inject(DestroyRef);

  readonly users = signal<Record<string, unknown>[]>([]);
  readonly formFields = signal<DynamicField[]>([]);
  readonly displayUsers = computed(() => {
    const fields = this.formFields();
    return this.users().map((record) =>
      this.mapRecordToFieldNames(record, fields),
    );
  });
  readonly filterFields = signal<GlobalFilterField[]>([]);
  readonly loading = signal(false);
  readonly page = signal(1);
  readonly lastPage = signal(1);
  readonly total = signal(0);

  readonly columnStorageKey = 'tenant-users-listing-columns';
  readonly defaultVisibleCount = 4;
  readonly usersListingFilterOptions = {
    excludeTypes: USERS_LISTING_FILTER_EXCLUDE_TYPES,
    excludeNamePattern: /password/i,
    excludeLabelPattern: /password/i,
  };

  readonly hasFormFields = computed(() => this.formFields().length > 0);
  readonly hasFilterFields = computed(() => this.filterFields().length > 0);
  readonly showEmptyConfigMessage = computed(() => !this.loading() && !this.hasFormFields());
  readonly showPagination = computed(() => !this.loading() && this.users().length > 0);
  readonly showDeleteConfirmModal = signal(false);

  readonly deleteConfirmTitle = 'Delete User';
  readonly deleteConfirmDescription =
    'Please confirm that you want to delete this user. All related information will be permanently removed.';

  private readonly defaultLimit = environment.limit;
  private pendingDeleteId: number | null = null;
  private filters: Record<string, unknown> = {};
  private lastVisibleColumnIds: string[] = [];

  ngOnInit(): void {
    this.loadFormFields();
    this.loadUsers(this.page());
  }

  onVisibleColumnsChange(columns: DynamicField[]): void {
    this.applyVisibleColumns(columns);
  }

  goToCreate(): void {
    this.router.navigate(['/tenant', this.session.getSlug(), 'users', 'create']);
  }

  goToEdit(record: Record<string, unknown>): void {
    const id = record['id'];
    if (id == null) {
      return;
    }

    this.router.navigate(['edit', id], { relativeTo: this.route });
  }

  deleteUser(record: Record<string, unknown>): void {
    const id = Number(record['id']);
    if (!id) {
      return;
    }

    this.pendingDeleteId = id;
    this.showDeleteConfirmModal.set(true);
  }

  onConfirmDeleteUser(): void {
    const id = this.pendingDeleteId;
    if (!id) {
      return;
    }

    this.userService
      .deleteUser(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toastr.success('User deleted successfully');
          if (this.users().length === 1 && this.page() > 1) {
            this.loadUsers(this.page() - 1);
          } else {
            this.loadUsers(this.page());
          }
        },
        error: (err) => {
          this.toastr.error(err?.error?.message || 'Failed to delete user');
        },
      });

    this.closeDeleteConfirmModal();
  }

  closeDeleteConfirmModal(): void {
    this.showDeleteConfirmModal.set(false);
    this.pendingDeleteId = null;
  }

  prevPage(): void {
    if (this.page() > 1) {
      this.loadUsers(this.page() - 1);
    }
  }

  nextPage(): void {
    if (this.page() < this.lastPage()) {
      this.loadUsers(this.page() + 1);
    }
  }

  onFilterSearch(filters: Record<string, unknown>): void {
    const allowedKeys = this.getAllowedFilterKeys();
    this.filters = pruneFiltersByAllowedKeys(filters, allowedKeys);
    this.page.set(1);
    this.loadUsers(this.page());
  }

  onFilterClear(): void {
    this.filters = {};
    this.page.set(1);
    this.loadUsers(this.page());
  }

  private loadFormFields(): void {
    this.formStorageService
      .loadForm('users')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          if (!res) {
            this.formFields.set([]);
            return;
          }

          const fields = normalizeFieldOrder(
            (res.fields || []).filter((field) => field.label !== 'Role' && field.name !== 'password'),
          ) as DynamicField[];

          this.formFields.set(fields);

          const visibleColumns = getVisibleColumns(
            fields,
            this.columnStorageKey,
            this.defaultVisibleCount,
          );
          this.applyVisibleColumns(visibleColumns);
        },
        error: () => {
          this.formFields.set([]);
          this.filterFields.set([]);
        },
      });
  }

  private applyVisibleColumns(columns: DynamicField[]): void {
    const columnIds = columns.map((column) => column.id);
    const columnsChanged =
      columnIds.length !== this.lastVisibleColumnIds.length ||
      columnIds.some((id, index) => id !== this.lastVisibleColumnIds[index]);

    this.lastVisibleColumnIds = columnIds;
    this.syncFilterFieldsFromVisibleColumns(columns);

    if (!columnsChanged) {
      return;
    }

    loadDynamicDropdownOptions(this.formStorageService, columns)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        // Options are mutated in place on the field objects. Emit a new array
        // reference so the OnPush listing re-renders and shows labels, not IDs.
        this.formFields.update((fields) => [...fields]);
        this.syncFilterFieldsFromVisibleColumns(columns);
      });
  }

  private syncFilterFieldsFromVisibleColumns(columns: DynamicField[]): void {
    const nextFilterFields = mapVisibleColumnsToFilterFields(
      columns,
      this.usersListingFilterOptions,
    );
    const allowedKeys = new Set(nextFilterFields.map((field) => field.key));
    const previousFilterKeys = Object.keys(this.filters);
    const prunedFilters = pruneFiltersByAllowedKeys(this.filters, allowedKeys);
    const filtersChanged = previousFilterKeys.length !== Object.keys(prunedFilters).length;

    this.filterFields.set(nextFilterFields);
    this.filters = prunedFilters;

    if (filtersChanged) {
      this.page.set(1);
      this.loadUsers(this.page());
    }
  }

  private loadUsers(page: number): void {
    this.loading.set(true);

    const allowedKeys = this.getAllowedFilterKeys();
    const activeFilters = pruneFiltersByAllowedKeys(this.filters, allowedKeys);

    const apiCall = Object.keys(activeFilters).length
      ? this.userService.searchUsers(
          this.mapFiltersToFieldIds(activeFilters),
          this.defaultLimit,
        )
      : this.userService.getUsers(page, this.defaultLimit);

    apiCall
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          this.users.set(res.data || []);
          this.total.set(Number(res?.meta?.total || 0));
          this.page.set(Number(res?.meta?.page || 1));
          this.lastPage.set(Number(res?.meta?.lastPage || 1));
        },
        error: () => {
          this.users.set([]);
          this.total.set(0);
        },
      });
  }

  private getAllowedFilterKeys(): Set<string> {
    return new Set(this.filterFields().map((field) => field.key));
  }

  private getFieldKey(field: DynamicField): string {
    return field.id || field.name;
  }

  private mapRecordToFieldNames(
    record: Record<string, unknown>,
    fields: DynamicField[],
  ): Record<string, unknown> {
    const mapped: Record<string, unknown> = { ...record };

    for (const field of fields) {
      const key = this.getFieldKey(field);
      if (key === field.name) {
        continue;
      }

      if (record[key] !== undefined) {
        mapped[field.name] = record[key];
      }
    }

    return mapped;
  }

  private mapFiltersToFieldIds(
    filters: Record<string, unknown>,
  ): Record<string, unknown> {
    const mapped: Record<string, unknown> = {};

    for (const [name, value] of Object.entries(filters)) {
      const field = this.formFields().find((item) => item.name === name);
      const key = field ? this.getFieldKey(field) : name;
      mapped[key] = value;
    }

    return mapped;
  }
}
