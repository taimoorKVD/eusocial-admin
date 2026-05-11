import { Component } from '@angular/core';
import { TenantVendorService } from '../../../../../services/tenant-vendor.service';
import { ToastrService } from 'ngx-toastr';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-setup-vendors',
  standalone: false,

  templateUrl: './setup-vendors.component.html',
  styleUrl: './setup-vendors.component.scss'
})
export class SetupVendorsComponent {
vendors: any[] = [];
chooseVendor: number | string | null = null;
statesList: any[] = [];
countriesList: any[] = [];

mode: 'create' | 'edit' = 'create';
selectedVendorId: number | null = null;
paymentType: 'COD' | 'EFT' = 'COD';
countries: any[] = [];
states: any[] = [];
cities: any[] = [];

formData: any = this.getEmptyForm();

constructor(private route: ActivatedRoute,  private vendorService: TenantVendorService, private toastr: ToastrService) {}

// getEmptyForm() {
//   return {
//     name: '',
//     address: '',
//     city: '',
//     email: '',
//     website: '',
//     username: '',
//     instructions: '',
//     phone_number: '',
//     country_id: null,
//     state_id: null,
//     payment_methods: [],
//     min_order: '',
//     contacts: [
//       {
//         name: '',
//         phone_number: '',
//         email: '',
//         is_primary: true
//       }
//     ],
//     order_deadlines: []
//   };
// }

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
        is_primary: true
      }
    ],
    order_deadlines: []
  };
}

ngOnInit(): void {

  this.loadVendors();
  // this.loadStates();
  this.loadCountries();

  this.route.paramMap.subscribe(params => {

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
  this.chooseVendor = 'create' ;
  this.formData = this.getEmptyForm();
  this.paymentType = 'COD';
}

// loadStates() {
//   this.vendorService.getStates().subscribe((res: any) => {
//     this.statesList = res.data || res;
//   });
// }

// loadCountries() {
//   this.vendorService.getCountries().subscribe((res: any) => {
//     this.countriesList = res.data || res;
//   });
// }

loadCountries() {
  this.vendorService.getCountries().subscribe((res: any) => {
    this.countries = res.data || res;
  });
}

loadStates(countryId: number) {

  if (!countryId) {
    this.states = [];
    this.cities = [];
    return;
  }

  this.vendorService.getStates(countryId).subscribe((res: any) => {
    this.states = res.data || res;
  });
}

loadCities(stateId: number) {

  if (!stateId) {
    this.cities = [];
    return;
  }

  this.vendorService.getCities(stateId).subscribe((res: any) => {
    this.cities = res.data || res;
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


// loadVendors() {
//   this.vendorService.getVendors().subscribe((res: any) => {
//     this.vendors = res.data.map((v: any) => ({
//       label: v.name,
//       value: v.id
//     }));
//   });
// }

loadVendors() {

  this.vendorService.getVendors().subscribe((res: any) => {

    const vendorOptions = res.data.map((v: any) => ({
      label: v.name,
      value: v.id
    }));

    this.vendors = [
      { label: 'Create Vendor +', value: 'create' },
      ...vendorOptions
    ];
  });
}


// onVendorChange() {

//   // 🔹 CREATE MODE
//   if (!this.chooseVendor) {
//     this.handleCreateVendor();
//     return;
//   }

//   // 🔹 EDIT MODE
//   this.mode = 'edit';
//   this.selectedVendorId = this.chooseVendor;

//   this.loadVendorData(this.chooseVendor);
// }

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

//   this.vendorService.getVendorById(id).subscribe((res: any) => {

//     const v = res.data;

//     this.formData = {
//       name: v.name,
//       address: v.address,
//       city: v.city,
//       email: v.email,
//       website: v.website,
//       username: v.username,
//       instructions: v.instructions,
//       phone_number: v.phone_number,
//       country_id: v.country_id,
//       state_id: v.state_id,
//       payment_methods: v.payment_methods || [],
//       min_order: v.min_order,
//       contacts: v.contacts?.length ? v.contacts : this.getEmptyForm().contacts,
//       order_deadlines: v.order_deadlines?.map((d: any) => d.day) || []
//     };

//     this.paymentType =
//       this.formData.payment_methods[0] === 'eft' ? 'EFT' : 'COD';
//   });
// }

loadVendorData(id: number) {

  this.vendorService.getVendorById(id).subscribe((res: any) => {

    const data = res.data;

    this.formData = {
      name: data.name,
      address: data.address,
      // city: data.city,
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
      contacts: data.contacts?.length
        ? data.contacts
        : this.getEmptyForm().contacts,
      order_deadlines:
        data.order_deadlines?.map((d: any) => d.day) || []
    };

    // ✅ load dependent dropdowns
    this.loadStates(data.country_id);

    setTimeout(() => {
      this.loadCities(data.state_id);
    }, 300);

  });
}

setPayment(type: 'COD' | 'EFT') {
  this.paymentType = type;

  this.formData.payment_methods = [
    type.toLowerCase()
  ];
}

toggleDay(day: string) {

  const index = this.formData.order_deadlines.indexOf(day);

  if (index > -1) {
    this.formData.order_deadlines.splice(index, 1);
  } else {
    this.formData.order_deadlines.push(day);
  }
}

saveVendor() {

  const payload = {
    ...this.formData,
    order_deadlines: this.formData.order_deadlines.map((d: string) => ({ day: d }))
  };

  if (this.mode === 'create') {

    this.vendorService.createVendor(payload).subscribe({
      next: (res: any) => {

        this.toastr.success('Vendor Created');

        this.loadVendors();

        // auto select new vendor
        this.chooseVendor = res.data.id;
        this.onVendorChange();
      }
    });

  } else {

    this.vendorService.updateVendor(this.selectedVendorId!, payload).subscribe({
      next: () => {
        this.toastr.success('Vendor Updated');
        this.loadVendors();
      }
    });

  }
}

deleteVendor() {

  if (!this.selectedVendorId) return;

  if (!confirm('Delete this vendor?')) return;

  this.vendorService.deleteVendor(this.selectedVendorId).subscribe({
    next: () => {

      this.toastr.success('Vendor Deleted');

      this.loadVendors();

      this.chooseVendor = null;
      this.mode = 'create';
      this.formData = this.getEmptyForm();
    }
  });
}

cancelForm() {
  this.chooseVendor = null;
  this.selectedVendorId = null;
  this.mode = 'create';
  this.formData = this.getEmptyForm();
  this.paymentType = 'COD';
}

}
