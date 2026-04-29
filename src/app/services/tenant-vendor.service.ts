import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class TenantVendorService {
    private vendor = `${environment.tenantApiUrl}/vendors`;
    private states = `${environment.tenantApiUrl}/states`;
    private countries = `${environment.tenantApiUrl}/countries`;

  constructor(private http: HttpClient) {}

    // CREATE
  createVendor(payload: any) {
    return this.http.post(this.vendor, payload);
  }

  // GET ALL (for dropdown)
  getVendors() {
    return this.http.get<any>(this.vendor);
  }

  // GET SINGLE
  getVendorById(id: number) {
    return this.http.get<any>(`${this.vendor}/${id}`);
  }

  // UPDATE
  updateVendor(id: number, payload: any) {
    return this.http.put(`${this.vendor}/${id}`, payload);
  }

  // DELETE
  deleteVendor(id: number) {
    return this.http.delete(`${this.vendor}/${id}`);
  }

  getStates() {
  return this.http.get<any>(this.states);
}

getCountries() {
  return this.http.get<any>(this.countries);
}
}
