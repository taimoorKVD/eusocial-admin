import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TenantVendorService } from '../../../../../services/tenant-vendor.service';
import { ToastrService } from 'ngx-toastr';
import { TenantSessionService } from '../../../../../services/tenant-session.service';

@Component({
  selector: 'app-setup-vendors-listing',
  standalone: false,
  templateUrl: './setup-vendors-listing.component.html',
  styleUrl: './setup-vendors-listing.component.scss',
})
export class SetupVendorsListingComponent {
vendors: any[] = [];
slug = '';

constructor(private route: ActivatedRoute, private tenantSession: TenantSessionService,  private router: Router, private vendorService: TenantVendorService, private toastr: ToastrService ) {}

ngOnInit() {
  this.slug = this.route.snapshot.paramMap.get('slug') || '';
  this.getVendors();
}

getVendors() {
  this.vendorService.getVendors().subscribe((res: any) => {
    this.vendors = res.data || res;
  });
}

deleteVendor(id: number) {

  if (!confirm('Delete this vendor?')) return;

  this.vendorService.deleteVendor(id).subscribe({
    next: () => {
      this.toastr.success('Vendor deleted');
      this.getVendors();
    }
  });
}
}
