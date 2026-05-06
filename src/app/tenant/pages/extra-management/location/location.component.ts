import { Component } from '@angular/core';
import { TenantLocationService } from '../../../../services/tenant-location.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TenantSessionService } from '../../../../services/tenant-session.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-location',
  standalone: false,
  templateUrl: './location.component.html',
  styleUrl: './location.component.scss',
})
export class LocationComponent {
  locationForm!: FormGroup;
  selectedId: number | null = null;

  constructor(
    private fb: FormBuilder,
    private locationService: TenantLocationService,
    private route: ActivatedRoute,
    private router: Router,
    public session: TenantSessionService,
    private toastr: ToastrService
  ) {}



  ngOnInit(): void {

    this.locationForm = this.fb.group({
      name: ['', [Validators.required, Validators.pattern(/^[a-zA-Z\s]+$/)]],
      address: [''],

      city: ['', [Validators.required, Validators.pattern(/^[a-zA-Z\s]+$/)]],
      country: ['', [Validators.required, Validators.pattern(/^[a-zA-Z\s]+$/)]],

      postalCode: ['', [Validators.required, Validators.pattern(/^[0-9]+$/)]],

      latitude: ['', [Validators.pattern(/^-?\d+(\.\d+)?$/)]],
      longitude: ['', [Validators.pattern(/^-?\d+(\.\d+)?$/)]]
    });

    // ✅ EDIT MODE
    this.route.params.subscribe(params => {
      if (params['id']) {
        this.selectedId = +params['id'];
        this.getLocationById(this.selectedId);
      }
    });
  }

  getLocationById(id: number) {
    this.locationService.getLocation(id).subscribe(res => {
      const data = res.data;

      this.locationForm.patchValue({
        name: data.name || '',
        address: data.address || '',
        city: data.city || '',
        country: data.country || '',
        postalCode: data.postalCode || '',
        latitude: data.latitude || '',
        longitude: data.longitude || ''
      });
    });
  }

  submit() {
    if (this.locationForm.invalid) {
      this.locationForm.markAllAsTouched();
      return;
    }

    const payload = { ...this.locationForm.value };

    if (this.selectedId) {
      this.locationService.updateLocation(this.selectedId, payload).subscribe({
        next: () => {
          this.toastr.success('Location updated successfully');
          this.router.navigate(['/tenant', this.session.getSlug(), 'location']);
        }
      });
    } else {
      this.locationService.createLocation(payload).subscribe({
        next: () => {
          this.toastr.success('Location created successfully');
          this.router.navigate(['/tenant', this.session.getSlug(), 'location']);
        }
      });
    }
  }

  resetForm() {
  this.locationForm.reset();
  this.selectedId = null;
}
}
