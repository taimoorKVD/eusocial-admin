import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class TenantItemService {

  private baseUrl = `${environment.tenantApiUrl}/items`;

  constructor(private http: HttpClient) {}

  getItems(page: number = 1, limit?: number) {
    return this.http.get<any>(
      `${this.baseUrl}?page=${page}${limit ? `&limit=${limit}` : ''}`
    );
  }

  searchItems(filters: any = {}, limit?: number) {
    const params = new URLSearchParams({
      ...(limit ? { limit: limit.toString() } : {}),
      ...filters
    });
    return this.http.get<any>(
      `${this.baseUrl}/search?${params.toString()}`
    );
  }

  getItemById(id: number) {
    return this.http.get<any>(`${this.baseUrl}/${id}`);
  }

  createItem(payload: any) {
    return this.http.post(this.baseUrl, payload);
  }

  updateItem(id: number, data: any) {
    return this.http.put(`${this.baseUrl}/${id}`, data);
  }

  deleteItem(id: number) {
    return this.http.delete(`${this.baseUrl}/${id}`);
  }

  bulkDeleteItems(ids: number[]) {
    return this.http.delete('', { body: { ids } });
  }
}
