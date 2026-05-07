import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { TenantLocationService } from '../../../../services/tenant-location.service';
import { TenantSessionService } from '../../../../services/tenant-session.service';

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

  constructor(
    private locationService: TenantLocationService,
    private router: Router,
    public session: TenantSessionService
  ) {}

  ngOnInit(): void {
    this.getLocations();
  this.loadCountries();
  this.loadStates();
  this.loadCities();
  }

  getLocations() {
    this.isLoading = true;

    this.locationService.getLocations().subscribe({
      next: (res) => {
        this.locations = res.data || [];
      },
      complete: () => this.isLoading = false
    });
  }

  goToCreate() {
    // this.router.navigate(['/location/create']);
     this.router.navigate([
    '/tenant',
    this.session.getSlug(),
    'location',
    'create'
  ]);
  }



  goToEdit(id: number) {
    // this.router.navigate(['/location/edit', id]);
     this.router.navigate([
    '/tenant',
    this.session.getSlug(),
    'location',
    'edit',
    id
  ]);
  }

  deleteLocation(id: number) {
    if (!confirm('Delete this location?')) return;

    this.locationService.deleteLocation(id).subscribe(() => {
      this.getLocations();
    });
  }

  loadCountries() {
  this.locationService.getCountries().subscribe(res => {
    this.countries = res.data || res;
  });
}

// ⚠️ IMPORTANT: these should return ALL data
loadStates() {
  this.locationService.getStates(0).subscribe(res => {
    this.states = res.data || res;
    console.log('States:', this.states);
console.log('Looking for stateId:', 45);
  });
}

loadCities() {
  this.locationService.getCities(0).subscribe(res => {
    this.cities = res.data || res;
  });
}

  getCountryName(id: number): string {
  return this.countries.find(c => c.id === id)?.name || '-';
}

getStateName(id: number): string {
  return this.states.find(s => s.id === id)?.name || '-';
}

getCityName(id: number): string {
  return this.cities.find(c => c.id === id)?.name || '-';
}
}
