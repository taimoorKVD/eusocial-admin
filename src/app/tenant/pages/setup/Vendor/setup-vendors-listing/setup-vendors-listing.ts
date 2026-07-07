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
import { TenantVendorService } from '../../../../../services/tenant-vendor.service';
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

const VENDORS_LISTING_FILTER_EXCLUDE_TYPES: DynamicFieldType[] = ['image'];

@Component({
  selector: 'app-setup-vendors-listing',
  standalone: false,
  templateUrl: './setup-vendors-listing.html',
  styleUrl: './setup-vendors-listing.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetupVendorsListing {
  private readonly vendorService = inject(TenantVendorService);
  private readonly toastr = inject(ToastrService);
  readonly session = inject(TenantSessionService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly formStorageService = inject(FormStorageService);
  private readonly destroyRef = inject(DestroyRef);

  readonly vendors = signal<Record<string, unknown>[]>([]);
  readonly formFields = signal<DynamicField[]>([]);
  readonly displayVendors = computed(() => {
    const fields = this.formFields();
    return this.vendors().map((record) =>
      this.mapRecordToFieldNames(record, fields),
    );
  });
  readonly filterFields = signal<GlobalFilterField[]>([]);
  readonly loading = signal(false);
  readonly page = signal(1);
  readonly lastPage = signal(1);
  readonly total = signal(0);

  readonly columnStorageKey = 'tenant-vendors-listing-columns';
  readonly defaultVisibleCount = 4;
  readonly vendorsListingFilterOptions = {
    excludeTypes: VENDORS_LISTING_FILTER_EXCLUDE_TYPES,
  };

  readonly hasFormFields = computed(() => this.formFields().length > 0);
  readonly hasFilterFields = computed(() => this.filterFields().length > 0);
  readonly showEmptyConfigMessage = computed(() => !this.loading() && !this.hasFormFields());
  readonly showPagination = computed(() => !this.loading() && this.vendors().length > 0);
  readonly showDeleteConfirmModal = signal(false);

  readonly deleteConfirmTitle = 'Delete Vendor';
  readonly deleteConfirmDescription =
    'Please confirm that you want to delete this vendor. All related information will be permanently removed.';

  private readonly defaultLimit = environment.limit;
  private pendingDeleteId: number | null = null;
  private filters: Record<string, unknown> = {};
  private lastVisibleColumnIds: string[] = [];

  ngOnInit(): void {
    this.loadFormFields();
    this.loadVendors(this.page());
  }

  onVisibleColumnsChange(columns: DynamicField[]): void {
    this.applyVisibleColumns(columns);
  }

  goToCreate(): void {
    this.router.navigate(['/tenant', this.session.getSlug(), 'vendors', 'create']);
  }

  goToEdit(record: Record<string, unknown>): void {
    const id = record['id'];
    if (id == null) {
      return;
    }

    this.router.navigate(['edit', id], { relativeTo: this.route });
  }

  deleteVendor(record: Record<string, unknown>): void {
    const id = Number(record['id']);
    if (!id) {
      return;
    }

    this.pendingDeleteId = id;
    this.showDeleteConfirmModal.set(true);
  }

  onConfirmDeleteVendor(): void {
    const id = this.pendingDeleteId;
    if (!id) {
      return;
    }

    this.vendorService
      .deleteVendor(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toastr.success('Vendor deleted successfully');
          if (this.vendors().length === 1 && this.page() > 1) {
            this.loadVendors(this.page() - 1);
          } else {
            this.loadVendors(this.page());
          }
        },
        error: (err) => {
          this.toastr.error(err?.error?.message || 'Failed to delete vendor');
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
      this.loadVendors(this.page() - 1);
    }
  }

  nextPage(): void {
    if (this.page() < this.lastPage()) {
      this.loadVendors(this.page() + 1);
    }
  }

  onFilterSearch(filters: Record<string, unknown>): void {
    const allowedKeys = this.getAllowedFilterKeys();
    this.filters = pruneFiltersByAllowedKeys(filters, allowedKeys);
    this.page.set(1);
    this.loadVendors(this.page());
  }

  onFilterClear(): void {
    this.filters = {};
    this.page.set(1);
    this.loadVendors(this.page());
  }

  private loadFormFields(): void {
    this.formStorageService
      .loadForm('vendors')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          if (!res) {
            this.formFields.set([]);
            return;
          }

          const fields = normalizeFieldOrder(res.fields || []) as DynamicField[];

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
        this.formFields.update((fields) => [...fields]);
        this.syncFilterFieldsFromVisibleColumns(columns);
      });
  }

  private syncFilterFieldsFromVisibleColumns(columns: DynamicField[]): void {
    const nextFilterFields = mapVisibleColumnsToFilterFields(
      columns,
      this.vendorsListingFilterOptions,
    );
    const allowedKeys = new Set(nextFilterFields.map((field) => field.key));
    const previousFilterKeys = Object.keys(this.filters);
    const prunedFilters = pruneFiltersByAllowedKeys(this.filters, allowedKeys);
    const filtersChanged = previousFilterKeys.length !== Object.keys(prunedFilters).length;

    this.filterFields.set(nextFilterFields);
    this.filters = prunedFilters;

    if (filtersChanged) {
      this.page.set(1);
      this.loadVendors(this.page());
    }
  }

  private loadVendors(page: number): void {
    this.loading.set(true);

    const allowedKeys = this.getAllowedFilterKeys();
    const activeFilters = pruneFiltersByAllowedKeys(this.filters, allowedKeys);

    const apiCall = Object.keys(activeFilters).length
      ? this.vendorService.searchVendors(
          this.mapFiltersToFieldIds(activeFilters),
          this.defaultLimit,
        )
      : this.vendorService.getVendors(page, this.defaultLimit);

    apiCall
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          this.vendors.set(res.data || []);
          this.total.set(Number(res?.meta?.total || 0));
          this.page.set(Number(res?.meta?.page || 1));
          this.lastPage.set(Number(res?.meta?.lastPage || 1));
        },
        error: () => {
          this.vendors.set([]);
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
