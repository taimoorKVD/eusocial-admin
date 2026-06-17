import { Component, ChangeDetectorRef } from '@angular/core';
import { TenantUserService } from '../../../../../services/tenant-user.service';
import { ActivatedRoute, Router } from '@angular/router';
import { TenantSessionService } from '../../../../../services/tenant-session.service';
import { environment } from '../../../../../../environments/environment.prod';
import { FormStorageService } from '../../../../forms/services/form-storage.service';
import { normalizeFieldOrder } from '../../../../form-builder/utils/form-field.factory';
import { DynamicField } from '../../../../../interfaces/dynamic-field';
import { GlobalFilterField } from '../../../../../shared/global-filter/global-filter';
import {
  getVisibleColumns,
  mapVisibleColumnsToFilterFields,
  pruneFiltersByAllowedKeys,
} from '../../../../../shared/dynamic-listing/dynamic-listing.helpers';
import { DynamicFieldType } from '../../../../../interfaces/dynamic-field';
import { catchError, forkJoin, map, of } from 'rxjs';

const USERS_LISTING_FILTER_EXCLUDE_TYPES: DynamicFieldType[] = [
  'image',
  // 'checkbox',
  // 'radio',
];

@Component({
  selector: 'app-setup-users-listing',
  standalone: false,
  templateUrl: './setup-users-listing.html',
  styleUrl: './setup-users-listing.scss',
})
export class SetupUsersListing {
  users: Record<string, unknown>[] = [];
  formFields: DynamicField[] = [];
  filterFields: GlobalFilterField[] = [];
  loading = false;
  slug: string = '';
  page = 1;
  lastPage = 1;
  total = 0;
  readonly columnStorageKey = 'tenant-users-listing-columns';
  readonly defaultVisibleCount = 4;
  readonly usersListingFilterOptions = {
    excludeTypes: USERS_LISTING_FILTER_EXCLUDE_TYPES,
    excludeNamePattern: /password/i,
    excludeLabelPattern: /password/i,
  };
  private defaultLimit = environment.limit;
  private filters: Record<string, unknown> = {};
  private lastVisibleColumnIds: string[] = [];

  constructor(
    private userService: TenantUserService,
    public session: TenantSessionService,
    private route: ActivatedRoute,
    private router: Router,
    private formStorageService: FormStorageService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.slug = this.route.parent?.parent?.snapshot.paramMap.get('slug') || '';
    this.loadFormFields();
    this.allUsers(this.page);
  }

  loadFormFields(): void {
    this.formStorageService.loadForm('users').subscribe({
      next: (res) => {
        if (!res) {
          this.formFields = [];
          return;
        }

        this.formFields = normalizeFieldOrder(
          (res.fields || []).filter((field) => field.label !== 'Role'),
        ) as DynamicField[];

        const visibleColumns = getVisibleColumns(
          this.formFields,
          this.columnStorageKey,
          this.defaultVisibleCount,
        );
        this.applyVisibleColumns(visibleColumns);
      },
      error: () => {
        this.formFields = [];
        this.filterFields = [];
        this.cdr.markForCheck();
      },
    });
  }

  onVisibleColumnsChange(columns: DynamicField[]): void {
    this.applyVisibleColumns(columns);
  }

  private applyVisibleColumns(columns: DynamicField[]): void {
    const columnIds = columns.map((column) => column.id);
    const columnsChanged =
      columnIds.length !== this.lastVisibleColumnIds.length ||
      columnIds.some((id, index) => id !== this.lastVisibleColumnIds[index]);

    this.lastVisibleColumnIds = columnIds;
    this.syncFilterFieldsFromVisibleColumns(columns);

    if (!columnsChanged) {
      this.cdr.markForCheck();
      return;
    }

    this.loadDynamicDropdownOptions(columns, () => {
      this.syncFilterFieldsFromVisibleColumns(columns);
      this.cdr.markForCheck();
    });
  }

  private loadDynamicDropdownOptions(
    fields: DynamicField[],
    onComplete?: () => void,
  ): void {
    console.log('Loading dynamic dropdown options for fields:', fields);
    fields.forEach((field) => {
    if (
      field.type === 'select' &&
      !field.optionSource &&
      Array.isArray(field.options)
    ) {
      field.options = field.options.map((option: any) =>
        typeof option === 'string'
          ? {
              name: option,
              label: option,
              value: option,
              id: option,
            }
          : option
      );
    }
  });
    const dropdownRequests = fields
      .filter(
        (field) =>
          field.type === 'select' &&
          (field.optionSource?.type === 'api' ||  field.optionSource?.type === 'dynamic') &&
          field.optionSource?.endpoint,
      )
      .map((field) =>
        this.formStorageService.getEndpointApi<any>(field.optionSource!.endpoint!).pipe(
          map((response) => ({ field, response })),
          catchError(() => of({ field, response: null })),
        ),
      );

    if (!dropdownRequests.length) {
      onComplete?.();
      return;
    }

    forkJoin(dropdownRequests).subscribe((results) => {
      results.forEach(({ field, response }) => {
        if (!response) {
          return;
        }

        const dataPath = field.optionSource?.response?.dataPath ?? 'data';
        const labelKey = field.optionSource?.response?.labelKey ?? 'label';
        const valueKey = field.optionSource?.response?.valueKey ?? 'value';
        const data = response?.[dataPath] || [];

        field.options = data.map((item: Record<string, unknown>) => ({
          name: item[labelKey] as string,
          label: item[labelKey],
          value: item[valueKey],
          id: item[valueKey],
        }));
      });

      onComplete?.();
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

    this.filterFields = nextFilterFields;
    this.filters = prunedFilters;

    if (filtersChanged) {
      this.page = 1;
      this.allUsers(this.page);
    }

    this.cdr.markForCheck();
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

  allUsers(page: number = 1): void {
    this.loading = true;

    const allowedKeys = new Set(this.filterFields.map((field) => field.key));
    const activeFilters = pruneFiltersByAllowedKeys(this.filters, allowedKeys);

    const apiCall = Object.keys(activeFilters).length
      ? this.userService.searchUsers(activeFilters, this.defaultLimit)
      : this.userService.getUsers(page, this.defaultLimit);

    apiCall.subscribe({
      next: (res) => {
        this.users = res.data || [];
        this.total = Number(res?.meta?.total || 0);
        this.page = Number(res?.meta?.page || 1);
        this.lastPage = Number(res?.meta?.lastPage || 1);
        this.loading = false;
      },
      error: () => {
        this.users = [];
        this.total = 0;
        this.loading = false;
      },
    });
  }

  deleteUser(record: Record<string, unknown>): void {
    const id = Number(record['id']);
    if (!id || !confirm('Are you sure you want to delete this user?')) {
      return;
    }

    this.userService.deleteUser(id).subscribe(() => {
      if (this.users.length === 1 && this.page > 1) {
        this.allUsers(this.page - 1);
      } else {
        this.allUsers(this.page);
      }
    });
  }

  prevPage(): void {
    if (this.page > 1) {
      this.allUsers(this.page - 1);
    }
  }

  nextPage(): void {
    if (this.page < this.lastPage) {
      this.allUsers(this.page + 1);
    }
  }

  onFilterSearch(filters: Record<string, unknown>): void {
    const allowedKeys = new Set(this.filterFields.map((field) => field.key));
    this.filters = pruneFiltersByAllowedKeys(filters, allowedKeys);
    this.page = 1;
    this.allUsers(this.page);
  }

  onFilterClear(): void {
    this.filters = {};
    this.page = 1;
    this.allUsers(this.page);
  }
}
