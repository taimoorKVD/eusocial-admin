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
  countries: any[] = [];
  states: any[] = [];
  cities: any[] = [];

  constructor(
    private fb: FormBuilder,
    private locationService: TenantLocationService,
    private route: ActivatedRoute,
    private router: Router,
    public session: TenantSessionService,
    private toastr: ToastrService,
  ) {}

  ngOnInit(): void {
    this.locationForm = this.fb.group({
      name: ['', Validators.required],
      address: [''],

      country_id: [null, Validators.required],
      state_id: [null, Validators.required],
      city_id: [null, Validators.required],

      postalCode: ['', [Validators.required, Validators.pattern(/^[0-9]+$/)]],

      latitude: ['', [Validators.pattern(/^-?\d+(\.\d+)?$/)]],
      longitude: ['', [Validators.pattern(/^-?\d+(\.\d+)?$/)]],
    });

    this.loadCountries();

    // this.locationForm.get('country_id')?.valueChanges.subscribe(countryId => {
    //   if (countryId) {
    //     this.loadStates(countryId);
    //     this.locationForm.patchValue({ state_id: null, city_id: null });
    //     this.cities = [];
    //   }
    // });

    // this.locationForm.get('state_id')?.valueChanges.subscribe(stateId => {
    //   if (stateId) {
    //     this.loadCities(stateId);
    //     this.locationForm.patchValue({ city_id: null });
    //   }
    // });

    this.locationForm.get('country_id')?.valueChanges.subscribe((countryId) => {
      this.states = [];
      this.cities = [];

      this.locationForm.patchValue({
        state_id: null,
        city_id: null,
      });

      if (countryId) {
        this.loadStates(countryId);
      }
    });

    this.locationForm.get('state_id')?.valueChanges.subscribe((stateId) => {
      this.cities = [];

      this.locationForm.patchValue({
        city_id: null,
      });

      if (stateId) {
        this.loadCities(stateId);
      }
    });

    // ✅ EDIT MODE
    this.route.params.subscribe((params) => {
      if (params['id']) {
        this.selectedId = +params['id'];
        this.getLocationById(this.selectedId);
      }
    });
  }

  loadCountries() {
    this.locationService.getCountries().subscribe((res) => {
      // this.countries = res.data || res;
      this.countries = res.data.sort((a: any, b: any) => a.name.localeCompare(b.name));
    });
  }

  loadStates(countryId: number) {
    this.locationService.getStates(countryId).subscribe((res) => {
      // this.states = res.data || res;
      this.states = res.data.sort((a: any, b: any) => a.name.localeCompare(b.name));
    });
  }

  loadCities(stateId: number) {
    this.locationService.getCities(stateId).subscribe((res) => {
      // this.cities = res.data || res;
      this.cities = res.data.sort((a: any, b: any) => a.name.localeCompare(b.name));
    });
  }

  getLocationById(id: number) {
    this.locationService.getLocation(id).subscribe((res) => {
      const data = res.data;

      this.locationForm.patchValue({
        name: data.name,
        address: data.address,
        country_id: data.countryId,
        state_id: data.stateId,
        city_id: data.cityId,
        postalCode: data.postalCode,
        latitude: data.latitude,
        longitude: data.longitude,
      });

      this.loadStates(data.country_id);
      this.loadCities(data.state_id);
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
        },
      });
    } else {
      this.locationService.createLocation(payload).subscribe({
        next: () => {
          this.toastr.success('Location created successfully');
          this.router.navigate(['/tenant', this.session.getSlug(), 'location']);
        },
      });
    }
  }

  //   resetForm() {
  //   this.locationForm.reset();
  //   this.selectedId = null;
  // }
}
