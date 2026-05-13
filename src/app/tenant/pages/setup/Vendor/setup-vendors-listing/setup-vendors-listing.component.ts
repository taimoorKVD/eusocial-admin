import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TenantVendorService } from '../../../../../services/tenant-vendor.service';
import { ToastrService } from 'ngx-toastr';
import { TenantSessionService } from '../../../../../services/tenant-session.service';

@Component({
  selector: 'app-setup-vendors-listing',
  standalone: false,
  templateUrl: './setup-vendors-listing.component.html',
  styleUrl: './setup-vendors-listing.component.scss',
})
export class SetupVendorsListingComponent {
  vendors: any[] = [];
  slug = '';
  loading = false;
  page = 1;
  lastPage = 1;
  total = 0;
  filters: any = {};
  filterFields = [
    {
      key: 'name',
      label: 'Name',
      type: 'text',
      placeholder: 'Search by name...',
    },
    {
      key: 'email',
      label: 'Email',
      type: 'text',
      placeholder: 'Search by email...',
    },
    {
      key: 'phone',
      label: 'Phone',
      type: 'number',
      placeholder: 'Search by phone...',
    },
  ];
  countries: any[] = [];
  states: any[] = [];
  cities: any[] = [];

  constructor(
    private route: ActivatedRoute,
    private tenantSession: TenantSessionService,
    private router: Router,
    private vendorService: TenantVendorService,
    private toastr: ToastrService,
  ) {}

  ngOnInit() {
    this.slug = this.route.snapshot.paramMap.get('slug') || '';
    this.getVendors();
    this.loadCountries();
    this.loadStates();
    this.loadCities();
  }

  getVendors(page: number = 1) {
    this.loading = true;
    const activeFilters = Object.fromEntries(
      Object.entries(this.filters).filter(([_, value]) => value),
    );

    const apiCall = Object.keys(activeFilters).length
      ? this.vendorService.searchVendors(activeFilters, 15)
      : this.vendorService.getVendors(page);

    apiCall.subscribe({
      next: (res: any) => {
        this.vendors = res?.data || [];
        this.total = Number(res?.count || 0);
        this.page = Number(res?.page || 1);
        this.lastPage = Number(res?.lastPage || 1);
        this.loading = false;
      },
      error: (err: any) => {
        this.vendors = [];
        this.loading = false;
      },
    });
  }

  deleteVendor(id: number) {
    if (!confirm('Delete this vendor?')) return;

    this.vendorService.deleteVendor(id).subscribe({
      next: () => {
        this.toastr.success('Vendor deleted');
        this.getVendors();
      },
    });
  }

  prevPage(): void {
    if (this.page > 1) {
      this.getVendors(this.page - 1);
    }
  }

  loadCountries() {
    this.vendorService.getCountries().subscribe((res) => {
      this.countries = res.data || res;
    });
  }

  loadStates() {
    this.vendorService.getStates(0).subscribe((res) => {
      this.states = res.data || res;
    });
  }

  loadCities() {
    this.vendorService.getCities(0).subscribe((res) => {
      this.cities = res.data || res;
    });
  }

  getCountryName(id: number): string {
    return this.countries.find((c) => c.id === id)?.name || '-';
  }

  getStateName(id: number): string {
    return this.states.find((s) => s.id === id)?.name || '-';
  }

  getCityName(id: number): string {
    return this.cities.find((c) => c.id === id)?.name || '-';
  }

  nextPage(): void {
    if (this.page < this.lastPage) {
      this.getVendors(this.page + 1);
    }
  }

  onFilterSearch(filters: any): void {
    this.filters = filters;
    this.getVendors(1);
  }

  onFilterClear(): void {
    this.filters = {};
    this.getVendors(1);
  }
}
