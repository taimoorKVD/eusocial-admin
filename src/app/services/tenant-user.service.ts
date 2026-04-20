import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class TenantUserService {

  private baseUrl = 'http://localhost:3001/api/users';

  constructor(private http: HttpClient) {}

  // Get all users (dropdown)
  getUsers() {
    return this.http.get<any[]>(this.baseUrl);
  }

  // Get single user
  getUserById(id: number) {
    return this.http.get<any>(`${this.baseUrl}/${id}`);
  }

  // Optional (future use)
  createUser(data: any) {
    return this.http.post(this.baseUrl, data);
  }

  updateUser(id: number, data: any) {
    return this.http.put(`${this.baseUrl}/${id}`, data);
  }

  deleteUser(id: number) {
    return this.http.delete(`${this.baseUrl}/${id}`);
  }
}
