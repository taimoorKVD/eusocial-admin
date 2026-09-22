import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { TenantLocationService } from '../../../../services/tenant-location.service';
import { GlobalFilterField } from '../../../../shared/global-filter/global-filter';
import { environment } from '../../../../../environments/environment.prod';
import {
  BulkSelectionState,
  toNumericIds,
} from '../../../../shared/dynamic-listing/bulk-selection.state';
import { TenantPermissionService } from '../../../../services/tenant-permission.service';
import { PERMISSIONS } from '../../../../constants/permissions';

@Component({
  selector: 'app-location-listing',
  standalone: false,
  templateUrl: './location-listing.component.html',
  styleUrl: './location-listing.component.scss',
})
export class LocationListingComponent {
  private readonly permissionService = inject(TenantPermissionService);

  readonly canCreate = this.permissionService.hasPermissionName(PERMISSIONS.LOCATIONS.CREATE);
  readonly canEdit = this.permissionService.hasPermissionName(PERMISSIONS.LOCATIONS.EDIT);
  readonly canDelete = this.permissionService.hasPermissionName(PERMISSIONS.LOCATIONS.DELETE);

  locations: any[] = [];
  isLoading = false;
  deleting = false;
  countries: any[] = [];
  states: any[] = [];
  cities: any[] = [];
  page = 1;
  lastPage = 1;
  total = 0;
  filters: any = {};
  filterFields: GlobalFilterField[] = [
    {
      key: 'name',
      label: 'Name',
      type: 'text',
      placeholder: 'Search by Role name...',
    },
    {
      key: 'country_id',
      label: 'Country',
      type: 'select',
      options: [],
      placeholder: 'Select country',
    },
    {
      key: 'state_id',
      label: 'State',
      type: 'select',
      options: [],
      placeholder: 'Select state',
    },
    {
      key: 'city_id',
      label: 'City',
      type: 'select',
      options: [],
      placeholder: 'Select city',
    },
    {
      key: 'postal_code',
      label: 'Postal Code',
      type: 'text',
      placeholder: 'Search by Postal Code...',
    },
  ];
  pageSize = environment.limit || 15;

  bulkSelection = new BulkSelectionState();
  showBulkDeleteConfirmModal = false;

  get bulkDeleteConfirmDescription(): string {
    const count = this.bulkSelection.count();
    return `Delete ${count} selected location${count === 1 ? '' : 's'}? This action cannot be undone.`;
  }

  constructor(
    private locationService: TenantLocationService,
    private router: Router,
    private toastr: ToastrService,
  ) {}

  ngOnInit(): void {
    this.getLocations();
    this.loadCountries();
    this.loadStates();
    this.loadCities();
  }

  getLocations(page: number = 1) {
    this.isLoading = true;
    const activeFilters = Object.fromEntries(
      Object.entries(this.filters).filter(([_, value]) => value),
    );

    const apiCall = Object.keys(activeFilters).length
      ? this.locationService.searchLocations(activeFilters, this.pageSize)
      : this.locationService.getLocations(page, this.pageSize);

    apiCall.subscribe({
      next: (res) => {
        this.locations = res.data || [];
        this.total = Number(res?.meta?.total || 0);
        this.page = Number(res?.meta?.page || 1);
        this.lastPage = Number(res?.meta?.lastPage || 1);
        this.isLoading = false;
      },
      error: () => {
        this.locations = [];
        this.total = 0;
        this.isLoading = false;
        this.bulkSelection.clear();
      },
    });
  }

  goToCreate() {
    this.router.navigate(['/location', 'create']);
  }

  goToEdit(id: number) {
    this.router.navigate(['/location', 'edit', id]);
  }

  deleteLocation(id: number) {
    if (!confirm('Delete this location?')) return;
    this.locationService.deleteLocation(id).subscribe({
      next: () => {
        this.toastr.success('Location deleted successfully');
        this.bulkSelection.clear();
        this.reloadAfterDelete(this.locations.length === 1);
      },
      error: (err) => {
        this.toastr.error(err?.error?.message || 'Failed to delete location');
      },
    });
  }

  isSelected(loc: any): boolean {
    const id = Number(loc?.id);
    return !Number.isNaN(id) && this.bulkSelection.isSelected(id);
  }

  toggleSelect(loc: any): void {
    const id = Number(loc?.id);
    if (!Number.isNaN(id)) {
      this.bulkSelection.toggle(id);
    }
  }

  selectableLocationIds(): number[] {
    return toNumericIds(this.locations.map((loc) => loc?.id));
  }

  isAllSelected(): boolean {
    return this.bulkSelection.isAllSelected(this.selectableLocationIds());
  }

  isIndeterminate(): boolean {
    return this.bulkSelection.isIndeterminate(this.selectableLocationIds());
  }

  toggleSelectAll(): void {
    this.bulkSelection.toggleAll(this.selectableLocationIds());
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

    const allVisibleSelected =
      this.locations.length > 0 && this.bulkSelection.count() === this.locations.length;

    this.closeBulkDeleteConfirmModal();
    this.deleting = true;

    this.locationService.bulkDeleteLocations(ids).subscribe({
      next: () => {
        this.toastr.success('Locations deleted successfully');
        this.bulkSelection.clear();
        this.deleting = false;
        this.reloadAfterDelete(allVisibleSelected);
      },
      error: (err) => {
        this.deleting = false;
        this.toastr.error(err?.error?.message || 'Failed to delete locations');
      },
    });
  }

  private reloadAfterDelete(pageEmpty: boolean): void {
    if (pageEmpty && this.page > 1) {
      this.getLocations(this.page - 1);
    } else {
      this.getLocations(this.page);
    }
  }

  loadCountries() {
    this.loadFilterOptions('countries', 'country_id', this.locationService.getCountries());
  }

  loadStates() {
    this.loadFilterOptions('states', 'state_id', this.locationService.getStates(0));
  }

  loadCities() {
    this.loadFilterOptions('cities', 'city_id', this.locationService.getCities(0));
  }

  private loadFilterOptions(key: string, filter_key: string, apiCall: any) {
    const field = this.filterFields.find((f) => f.key === filter_key);

    if (field && field.type === 'select') {
      field.loading = true;
    }

    apiCall.subscribe({
      next: (res: any) => {
        const data = res.data || res;
        this[key] = data;

        if (field && field.type === 'select') {
          field.options = data;
          field.loading = false;
        }
      },
      error: () => {
        if (field && field.type === 'select') {
          field.loading = false;
        }
      },
    });
  }

  getName(list: any[], id: number): string {
    return list.find((item) => item.id === id)?.name || '-';
  }

  prevPage(): void {
    if (this.page > 1) {
      this.bulkSelection.clear();
      this.getLocations(this.page - 1);
    }
  }

  nextPage(): void {
    if (this.page < this.lastPage) {
      this.bulkSelection.clear();
      this.getLocations(this.page + 1);
    }
  }

  onPageSizeChange(size: number): void {
    if (!size || size === this.pageSize) {
      return;
    }
    this.pageSize = size;
    this.page = 1;
    this.bulkSelection.clear();
    this.getLocations(1);
  }

  onFilterSearch(filters: any): void {
    this.filters = filters;
    this.bulkSelection.clear();
    this.page = 1;
    this.getLocations(this.page);
  }

  onFilterClear(): void {
    this.filters = {};
    this.bulkSelection.clear();
    this.page = 1;
    this.getLocations(this.page);
  }
}
