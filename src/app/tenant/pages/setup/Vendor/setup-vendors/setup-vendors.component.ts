import { Component } from '@angular/core';
import { TenantVendorService } from '../../../../../services/tenant-vendor.service';
import { ToastrService } from 'ngx-toastr';
import { ActivatedRoute, Router } from '@angular/router';
import { TenantSessionService } from '../../../../../services/tenant-session.service';

@Component({
  selector: 'app-setup-vendors',
  standalone: false,

  templateUrl: './setup-vendors.component.html',
  styleUrl: './setup-vendors.component.scss',
})
export class SetupVendorsComponent {
  vendors: any[] = [];
  chooseVendor: number | string | null = null;
  statesList: any[] = [];
  countriesList: any[] = [];
  loading = false;

  mode: 'create' | 'edit' = 'create';
  selectedVendorId: number | null = null;
  paymentType: 'COD' | 'EFT' = 'COD';
  countries: any[] = [];
  states: any[] = [];
  cities: any[] = [];
  isSubmitted = false;
  // validation flags (used in HTML)
  phonePatternValid = true;
  emailPatternValid = true;
  contactPhonePatternValid = true;
  contactEmailPatternValid = true;
  minOrderPatternValid = true;

  formData: any = this.getEmptyForm();

  constructor(
    private route: ActivatedRoute,
    private vendorService: TenantVendorService,
    private toastr: ToastrService,
    private router: Router,
    private tenantSession: TenantSessionService,
  ) {}

  getEmptyForm() {
    return {
      name: '',
      address: '',
      // city: '',
      city_id: null,
      email: '',
      website: '',
      username: '',
      instructions: '',
      phone_number: '',
      country_id: null,
      state_id: null,
      payment_methods: [],
      min_order: '',
      contacts: [
        {
          name: '',
          phone_number: '',
          email: '',
          is_primary: true,
        },
      ],
      order_deadlines: [],
    };
  }

  ngOnInit(): void {
    this.loadVendors();
    // this.loadStates();
    this.loadCountries();

    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');

      if (id) {
        this.mode = 'edit';
        this.selectedVendorId = Number(id);
        this.chooseVendor = Number(id); // optional (sync dropdown)

        this.loadVendorData(Number(id)); // ✅ SAME AS USERS
      } else {
        this.handleCreateVendor();
      }
    });
  }

  handleCreateVendor() {
    this.mode = 'create';
    this.selectedVendorId = null;
    this.chooseVendor = 'create';
    this.formData = this.getEmptyForm();
    this.paymentType = 'COD';
  }

  loadCountries() {
    this.vendorService.getCountries().subscribe((res: any) => {
      this.countries = res.data.sort((a: any, b: any) => a.name.localeCompare(b.name));
    });
  }

  loadStates(countryId: number) {
    if (!countryId) {
      this.states = [];
      this.cities = [];
      return;
    }

    this.vendorService.getStates(countryId).subscribe((res: any) => {
      this.states = res.data.sort((a: any, b: any) => a.name.localeCompare(b.name));
    });
  }

  loadCities(stateId: number) {
    if (!stateId) {
      this.cities = [];
      return;
    }

    this.vendorService.getCities(stateId).subscribe((res: any) => {
      this.cities = res.data.sort((a: any, b: any) => a.name.localeCompare(b.name));
    });
  }

  onCountryChange() {
    this.formData.state_id = null;
    this.formData.city_id = null;

    this.states = [];
    this.cities = [];

    this.loadStates(this.formData.country_id);
  }

  onStateChange() {
    this.formData.city_id = null;

    this.cities = [];

    this.loadCities(this.formData.state_id);
  }

  loadVendors() {
    this.vendorService.getVendors().subscribe((res: any) => {
      const vendorOptions = res.data.map((v: any) => ({
        label: v.name,
        value: v.id,
      }));

      this.vendors = [{ label: 'Create Vendor +', value: 'create' }, ...vendorOptions];
    });
  }

  onVendorChange() {
    // ✅ CREATE VENDOR
    if (this.chooseVendor === 'create') {
      this.handleCreateVendor();

      // keep dropdown selected
      this.chooseVendor = 'create';

      // focus first field
      setTimeout(() => {
        const el = document.getElementById('vendorName');

        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          (el as HTMLInputElement).focus();
        }
      }, 100);

      return;
    }

    // ✅ EMPTY
    if (!this.chooseVendor) {
      this.handleCreateVendor();
      return;
    }

    // ✅ EDIT
    this.mode = 'edit';
    this.selectedVendorId = Number(this.chooseVendor);

    this.loadVendorData(Number(this.chooseVendor));
  }

  // loadVendorData(id: number) {
  //    this.loading = true;

  //   this.vendorService.getVendorById(id).subscribe((res: any) => {
  //     const data = res.data;

  //     this.formData = {
  //       name: data.name,
  //       address: data.address,
  //       // city: data.city,
  //       city_id: data.city_id,
  //       country_id: data.country_id,
  //       state_id: data.state_id,
  //       phone_number: data.phone_number,
  //       email: data.email,
  //       website: data.website,
  //       username: data.username,
  //       instructions: data.instructions,
  //       payment_methods: data.payment_methods || [],
  //       min_order: data.min_order,
  //       contacts: data.contacts?.length ? data.contacts : this.getEmptyForm().contacts,
  //       order_deadlines: data.order_deadlines?.map((d: any) => d.day) || [],
  //     };

  //     // ✅ load dependent dropdowns
  //     this.loadStates(data.country_id);

  //     setTimeout(() => {
  //       this.loadCities(data.state_id);
  //     }, 300);

  //      this.loading = false;
  //   },

  // );
  // }

  loadVendorData(id: number) {
    this.loading = true;

    this.vendorService.getVendorById(id).subscribe({
      next: (res: any) => {
        const data = res.data;

        this.formData = {
          name: data.name,
          address: data.address,
          city_id: data.city_id,
          country_id: data.country_id,
          state_id: data.state_id,
          phone_number: data.phone_number,
          email: data.email,
          website: data.website,
          username: data.username,
          instructions: data.instructions,
          payment_methods: data.payment_methods || [],
          min_order: data.min_order,
          contacts: data.contacts?.length ? data.contacts : this.getEmptyForm().contacts,
          order_deadlines: data.order_deadlines?.map((d: any) => d.day) || [],
        };

        // dependent dropdowns
        this.loadStates(data.country_id);

        setTimeout(() => {
          this.loadCities(data.state_id);
        }, 300);

        this.loading = false;
      },

      error: () => {
        this.loading = false;
        this.toastr.error('Failed to load vendor');
      },
    });
  }

  setPayment(type: 'COD' | 'EFT') {
    this.paymentType = type;

    this.formData.payment_methods = [type.toLowerCase()];
  }

  toggleDay(day: string) {
    const index = this.formData.order_deadlines.indexOf(day);

    if (index > -1) {
      this.formData.order_deadlines.splice(index, 1);
    } else {
      this.formData.order_deadlines.push(day);
    }
  }

  redirectToUserListing() {
    const slug = this.tenantSession.getSlug();
    this.router.navigate(['/tenant', slug, 'vendors']);
  }

  saveVendor() {
    this.isSubmitted = true;

    // ================= PATTERNS =================

    // const phonePattern = /^[0-9]{10,15}$/;
    const cleanedPhone = this.formData.phone_number.replace(/[\s\-\(\)]/g, '');
    const phonePattern = /^\+?[0-9]{10,15}$/;
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const numberPattern = /^[0-9]+(\.[0-9]{1,2})?$/;

    // ================= FIELD VALIDATION =================

    if (
      !this.formData.name ||
      !this.formData.address ||
      !this.formData.country_id ||
      !this.formData.state_id ||
      !this.formData.city_id ||
      !this.formData.phone_number ||
      !this.formData.email ||
      !this.formData.min_order ||
      !this.formData.website ||
      !this.formData.username ||
      !this.formData.contacts?.length ||
      !this.formData.order_deadlines?.length
    ) {
      this.toastr.error('Please fix validation errors');

      return;
    }

    // ================= PHONE =================

    this.phonePatternValid = phonePattern.test(cleanedPhone);

    if (!this.phonePatternValid) {
      this.toastr.error('Invalid phone number');
      return;
    }

    // ================= EMAIL =================

    this.emailPatternValid = emailPattern.test(this.formData.email);

    if (!this.emailPatternValid) {
      this.toastr.error('Invalid email');

      return;
    }

    // ================= MIN ORDER =================

    this.minOrderPatternValid = numberPattern.test(this.formData.min_order);

    if (!this.minOrderPatternValid) {
      this.toastr.error('Min order must be a valid number (e.g. 12 or 12.00)');
      return;
    }

    // ================= CONTACT VALIDATION =================

    const contact = this.formData.contacts[0];

    const contactCleanedPhone = this.formData.contacts[0].phone_number?.replace(/[\s\-\(\)]/g, '');

    this.contactPhonePatternValid = phonePattern.test(contactCleanedPhone);

    if (!this.contactPhonePatternValid) {
      this.toastr.error('Invalid contact phone number');
      return;
    }

    this.contactEmailPatternValid = emailPattern.test(contact.email);
    if (!this.contactEmailPatternValid) {
      this.toastr.error('Invalid contact email');

      return;
    }

    // ================= PAYLOAD =================

    const payload = {
      ...this.formData,
      order_deadlines: this.formData.order_deadlines.map((d: string) => ({
        day: d,
      })),
    };

    // ================= START LOADER =================

    this.loading = true;

    // ================= CREATE =================

    if (this.mode === 'create') {
      this.vendorService.createVendor(payload).subscribe({
        next: (res: any) => {
          this.loading = false;

          this.toastr.success('Vendor Created');

          // redirect to listing
          this.redirectToUserListing();
        },

        error: (err: any) => {
          this.loading = false;

          const msg = err?.error?.message;

          if (msg) {
            if (msg.includes('already exists')) {
              this.toastr.error('Vendor with this name already exists');

              return;
            }

            this.toastr.error(msg);

            return;
          }

          this.toastr.error('Failed to create vendor');
        },
      });
    }

    // ================= UPDATE =================
    else {
      this.vendorService.updateVendor(this.selectedVendorId!, payload).subscribe({
        next: () => {
          this.loading = false;

          this.toastr.success('Vendor Updated');

          // redirect to listing
          this.redirectToUserListing();
        },

        error: (err: any) => {
          this.loading = false;

          const msg = err?.error?.message;

          if (msg) {
            this.toastr.error(msg);

            return;
          }

          this.toastr.error('Failed to update vendor');
        },
      });
    }
  }

  deleteVendor() {
    // if (!this.selectedVendorId) return;
    // if (!confirm('Delete this vendor?')) return;

    this.vendorService.deleteVendor(this.selectedVendorId).subscribe({
      next: () => {
        this.toastr.success('Vendor Deleted');
        this.router.navigate(['/tenant', this.tenantSession.getSlug(), 'vendors']);

        this.loadVendors();

        this.chooseVendor = null;
        this.mode = 'create';
        this.formData = this.getEmptyForm();
      },
    });
  }

  cancelForm() {
    // this.chooseVendor = null;
    // this.selectedVendorId = null;
    // this.mode = 'create';
    // this.formData = this.getEmptyForm();
    // this.paymentType = 'COD';
    this.router.navigate(['/tenant', this.tenantSession.getSlug(), 'vendors']);
  }

  showConfirmModal = false;
  modalTitle = '';
  modalMessage = '';

  confirmAction!: () => void;

  openModal(title: string, message: string, action: () => void): void {
    this.modalTitle = title;
    this.modalMessage = message;
    this.confirmAction = action;
    this.showConfirmModal = true;
  }

  closeModal(): void {
    this.showConfirmModal = false;
  }

  onConfirm(): void {
    this.confirmAction();
    // if ( this.modalTitle === 'Delete Vendor') {
    //   this.deleteVendor();
    // } else{
    //   this.router.navigate(['/tenant', this.tenantSession.getSlug(), 'vendors']);
    // }
    this.closeModal();
  }
}
