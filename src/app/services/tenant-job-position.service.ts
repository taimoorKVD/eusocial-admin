import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class TenantJobPositionService {
  private jobPosition = `${environment.tenantApiUrl}/jobpositions`;
  private permissions = `${environment.tenantApiUrl}/permissions`;

  constructor(private http: HttpClient) {}

  getPermissions() {
    return this.http.get<any>(this.permissions);
  }

  getJobPositions(page: number = 1, limit?: number) {
    return this.http.get(`${this.jobPosition}?page=${page}${limit ? `&limit=${limit}` : ''}`);
  }

  searchJobPositions(filters: any = {}, limit: number = 15) {
    const params = new URLSearchParams({
      limit: limit.toString(),
      ...filters,
    });
    return this.http.get<any>(`${this.jobPosition}/search?${params.toString()}`);
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
