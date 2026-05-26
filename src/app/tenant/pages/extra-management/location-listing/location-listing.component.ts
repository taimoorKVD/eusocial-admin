import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { TenantLocationService } from '../../../../services/tenant-location.service';
import { TenantSessionService } from '../../../../services/tenant-session.service';
import { GlobalFilterField } from '../../../../shared/global-filter/global-filter';
import { environment } from '../../../../../environments/environment.prod';

@Component({
  selector: 'app-location-listing',
  standalone: false,
  templateUrl: './location-listing.component.html',
  styleUrl: './location-listing.component.scss',
})
export class LocationListingComponent {
  locations: any[] = [];
  isLoading = false;
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
      placeholder: 'Search by Role name...'
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
  private defaultLimit = environment.limit;

  constructor(
    private locationService: TenantLocationService,
    private router: Router,
    public session: TenantSessionService,
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
      ? this.locationService.searchLocations(activeFilters, this.defaultLimit)
      : this.locationService.getLocations(page, this.defaultLimit);

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
      },
    });
  }

  goToCreate() {
    this.router.navigate(['/tenant', this.session.getSlug(), 'location', 'create']);
  }

  goToEdit(id: number) {
    this.router.navigate(['/tenant', this.session.getSlug(), 'location', 'edit', id]);
  }

  deleteLocation(id: number) {
    if (!confirm('Delete this location?')) return;
    this.locationService.deleteLocation(id).subscribe(() => {
      this.getLocations();
    });
  }

  loadCountries() {
    this.loadFilterOptions(
      'countries',
      'country_id',
      this.locationService.getCountries()
    );
  }

  loadStates() {
    this.loadFilterOptions(
      'states',
      'state_id',
      this.locationService.getStates(0)
    );
  }

  loadCities() {
    this.loadFilterOptions(
      'cities',
      'city_id',
      this.locationService.getCities(0)
    );
  }

  private loadFilterOptions(
    key: string,
    filter_key: string,
    apiCall: any
  ) {
    const field = this.filterFields.find(f => f.key === filter_key);

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
      }
    });
  }

  getName(list: any[], id: number): string {
    return list.find(item => item.id === id)?.name || '-';
  }

  prevPage(): void {
    if (this.page > 1) {
      this.getLocations(this.page - 1);
    }
  }

  nextPage(): void {
    if (this.page < this.lastPage) {
      this.getLocations(this.page + 1);
    }
  }

  onFilterSearch(filters: any): void {
    this.filters = filters;
    this.page = 1;
    this.getLocations(this.page);
  }

  onFilterClear(): void {
    this.filters = {};
    this.page = 1;
    this.getLocations(this.page);
  }
}
