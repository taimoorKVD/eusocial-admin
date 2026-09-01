import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Permission } from '../interfaces/permission';

@Injectable({
  providedIn: 'root',
})
export class PermissionService {
  private baseUrl = `${environment.apiUrl}/permissions`;

  constructor(private http: HttpClient) {}

  /** Get all permissions (for dropdowns / checkboxes) */
  getAll(): Observable<{ success: boolean; count: number; data: Permission[] }> {
    return this.http.get<{ success: boolean; count: number; data: Permission[] }>(
      `${this.baseUrl}`
    );
  }

  getPermissions() {
    return this.http.get(`${this.baseUrl}`);
  }

  searchPermissions(filters: any) {
    const queryParams = new URLSearchParams(filters).toString();
    return this.http.get(`${this.baseUrl}/search?${queryParams}`);
  }


  getPermissionById(id: number) {
    return this.http.get(`${this.baseUrl}/${id}`);
  }

  createPermission(payload: any) {
    return this.http.post(`${this.baseUrl}`, payload);
  }

  updatePermission(id: number, payload: any) {
    return this.http.put(`${this.baseUrl}/${id}`, payload);
  }

  deletePermission(id: number) {
    return this.http.delete(`${this.baseUrl}/${id}`);
  }

  bulkDeletePermissions(ids: number[]) {
    return this.http.delete(`${this.baseUrl}/bulk`, { body: { ids } });
  }
}
