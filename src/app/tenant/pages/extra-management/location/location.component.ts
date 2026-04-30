import { Component } from '@angular/core';
import { TenantLocationService } from '../../../../services/tenant-location.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-location',
  standalone: false,
  templateUrl: './location.component.html',
  styleUrl: './location.component.scss',
})
export class LocationComponent {
  locationForm!: FormGroup;
  isLoading = false;
  locations: any[] = [];
  selectedId: number | null = null;

    constructor(
    private fb: FormBuilder,
    private locationService: TenantLocationService
  ) {}


  ngOnInit(): void {
    this.initForm();
    this.getLocations();
  }

  initForm() {
    this.locationForm = this.fb.group({
      name: ['', Validators.required],
      address: [''],
      city: [''],
      country: [''],
      postalCode: [''],
      latitude: [''],
      longitude: ['']
    });
  }

  // ================= GET =================
  getLocations() {
    this.locationService.getLocations().subscribe({
      next: (res) => {
        this.locations = res.data || [];
      }
    });
  }

  // ================= EDIT =================
  editLocation(location: any) {
    this.selectedId = location.id;

    this.locationForm.patchValue(location);
  }

  // ================= SUBMIT =================
  submit() {
    if (this.locationForm.invalid) {
      this.locationForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;

    const payload = this.locationForm.value;

    if (this.selectedId) {
      // UPDATE
      this.locationService.updateLocation(this.selectedId, payload).subscribe({
        next: () => {
          this.resetForm();
        },
        complete: () => this.isLoading = false
      });
    } else {
      // CREATE
      this.locationService.createLocation(payload).subscribe({
        next: () => {
          this.resetForm();
        },
        complete: () => this.isLoading = false
      });
    }
  }

  // ================= DELETE =================
  deleteLocation(id: number) {
    if (!confirm('Delete this location?')) return;

    this.locationService.deleteLocation(id).subscribe(() => {
      this.getLocations();
    });
  }

  // ================= RESET =================
  resetForm() {
    this.locationForm.reset();
    this.selectedId = null;
    this.getLocations();
  }
}
