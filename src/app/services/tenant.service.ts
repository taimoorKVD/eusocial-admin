import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Tenant } from '../interfaces/tenant';

export interface TenantCreatePayload {
  name: string;
  domain: string;
  email: string;
  phoneNumber?: string;
  description?: string;
  countryId?: number | null;
  stateId?: number | null;
  city?: string;
  address?: string;
  postalCode?: string;
  planId: number;
  billingCycle: 'monthly' | 'yearly';
  trialDays?: number;
}

export interface TenantUpdatePayload {
  name?: string;
  domain?: string;
  email?: string;
  phoneNumber?: string;
  description?: string;
  countryId?: number | null;
  stateId?: number | null;
  city?: string;
  address?: string;
  postalCode?: string;
}

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
  private geoBaseUrl = `${environment.tenantApiUrl}`;

  constructor(private http: HttpClient) {}

  getTenants(
    page: number = 1,
    limit?: number,
    filters: { search?: string; status?: string } = {}
  ): Observable<TenantResponse> {
    let params = new HttpParams()
      .set('page', String(page))
      .set('sort_by', 'created_at')
      .set('sort_order', 'desc');

    if (limit) params = params.set('limit', String(limit));
    if (filters.search) {
      params = params.set('search', filters.search);
      params = params.set('q', filters.search);
    }
    if (filters.status) {
      params = params.set('status', filters.status);
    }

    return this.http.get<TenantResponse>(this.baseUrl, { params });
  }

  searchTenants(filters: any = {}, limit?: number, page: number = 1) {
    const params = new URLSearchParams({
      page: page.toString(),
      ...(limit ? { limit: limit.toString() } : {}),
      ...filters,
    });
    return this.http.get<any>(`${this.baseUrl}/search?${params.toString()}`);
  }

  getOne(id: number): Observable<{ success?: boolean; data: Tenant }> {
    return this.http.get<{ success?: boolean; data: Tenant }>(`${this.baseUrl}/${id}`);
  }

  getIndustries(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/industries`);
  }

  getCountries(): Observable<any> {
    return this.http.get<any>(`${this.geoBaseUrl}/countries`);
  }

  getStates(countryId: number): Observable<any> {
    const params = new HttpParams().set('country_id', String(countryId));
    return this.http.get<any>(`${this.geoBaseUrl}/states`, { params });
  }

  getCities(stateId: number): Observable<any> {
    const params = new HttpParams().set('state_id', String(stateId));
    return this.http.get<any>(`${this.geoBaseUrl}/cities`, { params });
  }

  create(data: TenantCreatePayload): Observable<any> {
    return this.http.post<any>(this.baseUrl, data);
  }

  update(id: number, data: TenantUpdatePayload): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/${id}`, data);
  }

  delete(id: number): Observable<any> {
    return this.http.delete<any>(`${this.baseUrl}/${id}`);
  }

  sendCredentials(tenantId: number, email: string) {
    return this.http.post<any>(`${this.baseUrl}/${tenantId}/send-credentials`, { email });
  }
}
