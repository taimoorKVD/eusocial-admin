import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class TenantUserService {

  private baseUrl = `${environment.tenantApiUrl}/users`;
  private jobPosition = `${environment.tenantApiUrl}/jobpositions`;
  private locations = `${environment.tenantApiUrl}/locations`;


  constructor(private http: HttpClient) {}

  // Get all users (dropdown)
  getUsers() {
    return this.http.get<any[]>(this.baseUrl);
  }

  // Get single user
  getUserById(id: number) {
    return this.http.get<any>(`${this.baseUrl}/${id}`);
  }

  // Optional (future use)
  // createUser(data: any) {
  //   return this.http.post(this.baseUrl, data);
  // }

  createUser(payload: any) {
  return this.http.post(this.baseUrl, payload);
}

  updateUser(id: number, data: any) {
    return this.http.put(`${this.baseUrl}/${id}`, data);
  }

  deleteUser(id: number) {
    return this.http.delete(`${this.baseUrl}/${id}`);
  }

getJobPositions() {
  return this.http.get(this.jobPosition);
}

getJobPositionById(id: number) {
  return this.http.get(`${this.jobPosition}/${id}`);
}

getLocations() {
  return this.http.get(this.locations);
}

getLocationById(id: number) {
  return this.http.get(`${this.locations}/${id}`);
}

}
