import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class TenantJobPositionService {

  private jobPosition = `${environment.tenantApiUrl}/jobpositions`;


  constructor(private http: HttpClient) {}


  getJobPositions() {
  return this.http.get(this.jobPosition);
}

getJobPositionById(id: number) {
  return this.http.get(`${this.jobPosition}/${id}`);
}

createJobPosition(data: any) {
  return this.http.post(this.jobPosition, data);
}

updateJobPosition(id: number, data: any) {
  return this.http.put(`${this.jobPosition}/${id}`, data);
}

deleteJobPosition(id: number) {
  return this.http.delete(`${this.jobPosition}/${id}`);
}
}
