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

  constructor(
    private locationService: TenantLocationService,
    private router: Router,
    public session: TenantSessionService
  ) {}

  ngOnInit(): void {
    this.getLocations();
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
}
