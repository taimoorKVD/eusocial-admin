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
    current_page?: number;
    currentPage?: number;
    last_page?: number;
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

  getRoles(page: number = 1, limit?: number): Observable<RoleApiResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      ...(limit ? { limit: limit.toString() } : {}),
    });
    return this.http.get<RoleApiResponse>(`${this.baseUrl}?${params.toString()}`);
  }

 searchRoles(filters: any = {}, limit ? : number) {
    const params = new URLSearchParams({
      ...(limit ? { limit: limit.toString() } : {}),
      ...filters
    });
    return this.http.get<any>(
      `${this.baseUrl}/search?${params.toString()}`
    );
  }

  /** ✅ Get all roles (no pagination) */
  getAllRoles(): Observable<Role[]> {
    return this.http.get<RoleApiResponse>(`${this.baseUrl}?limit=0`).pipe(map((res) => res.data));
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
