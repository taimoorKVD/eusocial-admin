import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Tenant } from '../interfaces/tenant';

interface TenantResponse {
  success: boolean;
  message: string;
  data: Tenant[];
  meta: {
    total?: number;
    current_page?: number;
    currentPage?: number;
    page?: number;
    last_page?: number;
    lastPage?: number;
  };
}

@Injectable({
  providedIn: 'root',
})
export class TenantService {
  private baseUrl = `${environment.apiUrl}/tenants`;

  constructor(private http: HttpClient) {}

  getTenants(page: number = 1): Observable<TenantResponse> {
    return this.http.get<TenantResponse>(`${this.baseUrl}?page=${page}&sort_by=created_at&sort_order=desc`);
  }

  getOne(id: number): Observable<{ data: Tenant }> {
    return this.http.get<{ data: Tenant }>(`${this.baseUrl}/${id}`);
  }

  create(data: { name: string; customDomain?: string | null }): Observable<any> {
    return this.http.post<any>(this.baseUrl, data);
  }

  update(id: number, data: { name?: string; customDomain?: string | null }): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/${id}`, data);
  }

  delete(id: number): Observable<any> {
    return this.http.delete<any>(`${this.baseUrl}/${id}`);
  }

    // ✅ ADD THIS
sendCredentials(tenantId: number, email: string) {
  return this.http.post<any>(
    `${this.baseUrl}/${tenantId}/send-credentials`,
    { email }
  );
}
}
