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
      name: [''],
      address: [''],
      city: [''],
      country: [''],
      postalCode: [''],
      latitude: [''],
      longitude: ['']
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
      this.locationForm.patchValue(res.data);
    });
  }

  submit() {

    const formValue = this.locationForm.value;

    const payload: any = {
      ...formValue
    };

    // remove lat/lng (as you already fixed)
    delete payload.latitude;
    delete payload.longitude;

    const redirectToList = () => {
      this.router.navigate([
        '/tenant',
        this.session.getSlug(),
        'location'
      ]);
    };

    // ================= UPDATE =================
    if (this.selectedId) {
      this.locationService.updateLocation(this.selectedId, payload).subscribe({
        next: () => {
          this.toastr.success('Location updated successfully'); // 👈 HERE
          redirectToList();
        }
      });
    }

    // ================= CREATE =================
    else {
      this.locationService.createLocation(payload).subscribe({
        next: () => {
          this.toastr.success('Location created successfully'); // 👈 HERE
          redirectToList();
        }
      });
    }
  }

  resetForm() {
  this.locationForm.reset();
  this.selectedId = null;
}
}
