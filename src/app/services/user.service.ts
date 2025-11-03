import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { User } from '../interfaces/user';

@Injectable({
  providedIn: 'root',
})
export class UserService {

  private baseUrl = `${environment.apiUrl}/users`;


  constructor(private http: HttpClient) { }

  /** Fetch paginated list of users */
  getUsers(
    page: number = 1
  ): Observable<{ data: User[]; meta: { total: number; page: number; lastPage: number } }> {
    return this.http.get<{ data: User[]; meta: { total: number; page: number; lastPage: number } }>(
      `${this.baseUrl}?page=${page}`,
      { withCredentials: true }
    );
  }
  /** Delete user by ID */
  deleteUser(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`, { withCredentials: true });
  }

  /** Get single user (for edit page) */
  getUser(id: number): Observable<User> {
    return this.http.get<User>(`${this.baseUrl}/${id}`, { withCredentials: true });
  }


  /** Update existing user */
  updateUser(id: number, data: Partial<User>): Observable<User> {
    return this.http.put<User>(`${this.baseUrl}/${id}`, data, { withCredentials: true });
  }


  /** Create new user */
  createUser(data: Partial<User>): Observable<User> {
    return this.http.post<User>(this.baseUrl, data, { withCredentials: true });
  }

}
