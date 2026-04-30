import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class TenantLocationService {
     private apiUrl = `${environment.tenantApiUrl}/locations`;

      constructor(private http: HttpClient) {}


    // CREATE
  createLocation(data: any): Observable<any> {
    return this.http.post(this.apiUrl, data);
  }

  // GET ALL
  getLocations(): Observable<any> {
    return this.http.get(this.apiUrl);
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
}
