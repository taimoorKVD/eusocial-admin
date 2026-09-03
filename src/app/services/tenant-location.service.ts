import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class TenantLocationService {
     private apiUrl = `${environment.tenantApiUrl}/locations`;
     private statesUrl  = `${environment.tenantApiUrl}/states`;
     private citiesUrl  = `${environment.tenantApiUrl}/cities`;
     private countriesUrl  = `${environment.tenantApiUrl}/countries`;

      constructor(private http: HttpClient) {}


    // CREATE
  createLocation(data: any): Observable<any> {
    return this.http.post(this.apiUrl, data);
  }

  // // GET ALL
  // getLocations(): Observable<any> {
  //   return this.http.get(this.apiUrl);
  // }

  getLocations(page: number = 1, limit?: number): Observable<any> {
    return this.http.get(`${this.apiUrl}?page=${page}${limit ? `&limit=${limit}` : ''}`);
  }

  searchLocations(filters: any, limit: number = 15): Observable<any> {
      const params = new URLSearchParams({
      limit: limit.toString(),
      ...filters
    });

    return this.http.get(`${this.apiUrl}/search?${params.toString()}`);
  }

  // GET BY ID
  getLocation(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/${id}`);
  }

  // UPDATE
  updateLocation(id: number, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, data);
  }

  // DELETE
  deleteLocation(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  bulkDeleteLocations(ids: number[]): Observable<any> {
    return this.http.delete(`${this.apiUrl}/bulk`, { body: { ids } });
  }

  // COUNTRIES
getCountries(): Observable<any> {
  return this.http.get(this.countriesUrl);
}

// STATES (by country)
getStates(countryId: number): Observable<any> {
  console.log('getStates called with countryId:', countryId);
  return this.http.get(`${this.statesUrl}?country_id=${countryId}`);
}

// CITIES (by state)
getCities(stateId: number): Observable<any> {
  return this.http.get(`${this.citiesUrl}?state_id=${stateId}`);
}

// ALL STATES (cached once after login)
getAllStates(): Observable<any> {
  return this.http.get(this.statesUrl);
}

// ALL CITIES (cached once after login)
getAllCities(): Observable<any> {
  return this.http.get(this.citiesUrl);
}

// CITIES (by country) — used when a form has Country + City but no State
getCitiesByCountry(countryId: number): Observable<any> {
  return this.http.get(`${this.citiesUrl}?country_id=${countryId}`);
}

getCitiesChunk(page: number, limit: number): Observable<any> {
  return this.http.get(
    `${this.citiesUrl}?page=${page}&limit=${limit}`
  );
}

}
