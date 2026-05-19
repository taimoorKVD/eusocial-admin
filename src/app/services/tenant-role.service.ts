import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class TenantRoleService {
  private apiUrl = `${environment.tenantApiUrl}/roles`;

  constructor(private http: HttpClient) {}

  getRoles() {
    return this.http.get(this.apiUrl);
  }

  getRoleById(id: number) {
    return this.http.get(`${this.apiUrl}/${id}`);
  }

  createRole(payload: any) {
    return this.http.post(this.apiUrl, payload);
  }

  updateRole(id: number, payload: any) {
    return this.http.put(`${this.apiUrl}/${id}`, payload);
  }

  deleteRole(id: number) {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  getPermissions() {
  return this.http.get(`${environment.tenantApiUrl}/permissions`);
}
}
