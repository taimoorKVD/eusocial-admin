import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { Role } from '../interfaces/role';

interface RoleApiResponse {
  success: boolean;
  data: Role[];
  meta?: {
    total: number;
    page: number;
    lastPage: number;
  };
}

@Injectable({
  providedIn: 'root',
})
export class RoleService {
  private baseUrl = `${environment.apiUrl}/roles`;

  constructor(private http: HttpClient) {}

  /** ✅ Get paginated list of roles */
  getRoles(page: number = 1): Observable<Role[]> {
    return this.http
      .get<RoleApiResponse>(`${this.baseUrl}?page=${page}`)
      .pipe(map((res) => res.data)); // unwrap data
  }

  /** ✅ Get all roles (no pagination) */
  getAllRoles(): Observable<Role[]> {
    return this.http.get<RoleApiResponse>(this.baseUrl).pipe(map((res) => res.data)); // unwrap data
  }

  /** ✅ Get single role */
  getRole(id: number): Observable<Role> {
    return this.http
      .get<{ success: boolean; data: Role }>(`${this.baseUrl}/${id}`)
      .pipe(map((res) => res.data));
  }

  /** ✅ Create new role */
  createRole(data: Partial<Role>): Observable<Role> {
    return this.http
      .post<{ success: boolean; data: Role }>(this.baseUrl, data)
      .pipe(map((res) => res.data));
  }

  /** ✅ Update role */
  updateRole(id: number, data: Partial<Role>): Observable<Role> {
    return this.http
      .put<{ success: boolean; data: Role }>(`${this.baseUrl}/${id}`, data)
      .pipe(map((res) => res.data));
  }

  /** ✅ Delete role */
  deleteRole(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
