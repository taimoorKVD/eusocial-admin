import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { User } from '../interfaces/user';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private baseUrl = `${environment.apiUrl}/users`;

  constructor(private http: HttpClient) {}

  /** Fetch paginated list of users with optional filters */
  getUsers(
    page: number = 1,
    limit?: number
  ): Observable<{
    data: User[];
    meta: {
      total?: number;
      current_page?: number;
      currentPage?: number;
      page?: number;
      last_page?: number;
      lastPage?: number;
    };
  }> {
    return this.http.get<{
      data: User[];
      meta: {
        total?: number;
        current_page?: number;
        currentPage?: number;
        page?: number;
        last_page?: number;
        lastPage?: number;
      };
    }>(
      `${this.baseUrl}?page=${page}&limit=${limit}&sort_by=created_at&sort_order=desc`
    );
  }

  searchUsers(
    filters: any = {}, limit: number = 15
  ) {
    const params = new URLSearchParams({
      limit: limit.toString(),
      ...filters
    });
    return this.http.get<any>(
      `${this.baseUrl}/search?${params.toString()}`
    );
  }

  /** Delete user by ID */
  deleteUser(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  bulkDeleteUsers(ids: number[]): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/bulk`, { body: { ids } });
  }

  /** Get single user (for edit page) */
  getUser(id: number): Observable<User> {
    return this.http
      .get<{ success: boolean; message: string; data: User }>(`${this.baseUrl}/${id}`)
      .pipe(map((res) => res.data)); // ✅ unwrap data
  }

  /** Update existing user */
  updateUser(id: number, data: Partial<User>): Observable<User> {
    return this.http.put<User>(`${this.baseUrl}/${id}`, data);
  }

  /** Create new user */
  createUser(data: Partial<User>): Observable<User> {
    return this.http.post<User>(this.baseUrl, data);
  }
}
