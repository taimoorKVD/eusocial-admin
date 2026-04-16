import { Component } from '@angular/core';

@Component({
  selector: 'app-setup-vendors',
  standalone: false,

  templateUrl: './setup-vendors.component.html',
  styleUrl: './setup-vendors.component.scss'
})
export class SetupVendorsComponent {
paymentType: 'COD' | 'EFT' = 'COD';
chooseVendor = null; // selected value


vendors = [
  { label: 'John Doe', value: 1 },
  { label: 'Ali Khan', value: 2 },
  { label: 'Umar', value: 3 }
];

setPayment(type: 'COD' | 'EFT') {
  this.paymentType = type;
}
}
