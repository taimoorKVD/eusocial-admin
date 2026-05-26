import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class TenantVendorService {
  private vendor = `${environment.tenantApiUrl}/vendors`;
  // private states = `${environment.tenantApiUrl}/states`;
  // private countries = `${environment.tenantApiUrl}/countries`;
  private statesUrl  = `${environment.tenantApiUrl}/states`;
  private citiesUrl  = `${environment.tenantApiUrl}/cities`;
  private countriesUrl  = `${environment.tenantApiUrl}/countries`;

  constructor(private http: HttpClient) {}

    // CREATE
  createVendor(payload: any) {
    return this.http.post(this.vendor, payload);
  }

  // GET ALL (for dropdown)
  // getVendors() {
  //   return this.http.get<any>(this.vendor);
  // }

  getVendors(page: number = 1, limit?: number) {
    return this.http.get<any>(
      `${this.vendor}?page=${page}${limit ? `&limit=${limit}` : ''}`
    );
  }

  searchVendors(filters: any, limit?: number) {
    const params = new URLSearchParams({
      ...(limit ? { limit: limit.toString() } : {}),
      ...filters
    });
    return this.http.get<any>(
      `${this.vendor}/search?${params.toString()}`
    );
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

//   getStates() {
//   return this.http.get<any>(this.states);
// }

// getCountries() {
//   return this.http.get<any>(this.countries);
// }

  // COUNTRIES
getCountries(): Observable<any> {
  return this.http.get(this.countriesUrl);
}

// STATES (by country)
getStates(countryId: number): Observable<any> {
  return this.http.get(`${this.statesUrl}?country_id=${countryId}`);
}

// CITIES (by state)
getCities(stateId: number): Observable<any> {
  return this.http.get(`${this.citiesUrl}?state_id=${stateId}`);
}
}
