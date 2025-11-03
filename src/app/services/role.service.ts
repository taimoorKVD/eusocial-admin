import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Role } from '../interfaces/role';

@Injectable({
  providedIn: 'root',
})
export class RoleService {
  private baseUrl = `${environment.apiUrl}/roles`;

  constructor(private http: HttpClient) { }

  /** Get paginated list of roles */
  getRoles(page: number = 1): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}?page=${page}`, {
      withCredentials: true,
    });
  }

  /** Get all roles (no pagination) */
  getAllRoles(): Observable<Role[]> {
    return this.http.get<Role[]>(this.baseUrl, { withCredentials: true });
  }

  /** Get single role */
  getRole(id: number): Observable<Role> {
    return this.http.get<Role>(`${this.baseUrl}/${id}`, {
      withCredentials: true,
    });
  }

  /** Create new role */
  createRole(data: Partial<Role>): Observable<Role> {
    return this.http.post<Role>(this.baseUrl, data, {
      withCredentials: true,
    });
  }

  /** Update role */
  updateRole(id: number, data: Partial<Role>): Observable<Role> {
    return this.http.put<Role>(`${this.baseUrl}/${id}`, data, {
      withCredentials: true,
    });
  }

  /** Delete role */
  deleteRole(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`, {
      withCredentials: true,
    });
  }

}
