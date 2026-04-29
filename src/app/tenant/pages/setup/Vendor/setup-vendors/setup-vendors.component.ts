import { Component } from '@angular/core';
import { TenantVendorService } from '../../../../../services/tenant-vendor.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-setup-vendors',
  standalone: false,

  templateUrl: './setup-vendors.component.html',
  styleUrl: './setup-vendors.component.scss'
})
export class SetupVendorsComponent {
vendors: any[] = [];
chooseVendor: number | null = null;

mode: 'create' | 'edit' = 'create';
selectedVendorId: number | null = null;
paymentType: 'COD' | 'EFT' = 'COD';

formData: any = this.getEmptyForm();

constructor(private vendorService: TenantVendorService, private toastr: ToastrService) {}

getEmptyForm() {
  return {
    name: '',
    address: '',
    city: '',
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

ngOnInit() {
  this.loadVendors();
}

loadVendors() {
  this.vendorService.getVendors().subscribe((res: any) => {
    this.vendors = res.data.map((v: any) => ({
      label: v.name,
      value: v.id
    }));
  });
}

onVendorChange() {

  if (!this.chooseVendor) {
    this.mode = 'create';
    this.formData = this.getEmptyForm();
    return;
  }

  this.mode = 'edit';
  this.selectedVendorId = this.chooseVendor;

  this.vendorService.getVendorById(this.chooseVendor).subscribe((res: any) => {

    const v = res.data;

    this.formData = {
      name: v.name,
      address: v.address,
      city: v.city,
      email: v.email,
      website: v.website,
      username: v.username,
      instructions: v.instructions,
      phone_number: v.phone_number,
      country_id: v.country_id,
      state_id: v.state_id,
      payment_methods: v.payment_methods || [],
      min_order: v.min_order,
      contacts: v.contacts?.length ? v.contacts : this.getEmptyForm().contacts,
      order_deadlines: v.order_deadlines?.map((d: any) => d.day) || []
    };

    // payment toggle sync
    this.paymentType = this.formData.payment_methods[0] === 'eft' ? 'EFT' : 'COD';
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

}
