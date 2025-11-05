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
}
