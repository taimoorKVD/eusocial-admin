import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  InvoiceStats,
  InvoiceStatus,
  ListMeta,
  MasterInvoice,
} from '../interfaces/master-billing';

export interface InvoiceListQuery {
  page?: number;
  limit?: number;
  tenant?: string;
  status?: InvoiceStatus | '';
  from?: string;
  to?: string;
}

@Injectable({ providedIn: 'root' })
export class MasterInvoiceService {
  private readonly baseUrl = `${environment.apiUrl}/invoices`;

  constructor(private http: HttpClient) {}

  getStats(): Observable<{ success: boolean; data: InvoiceStats }> {
    return this.http.get<{ success: boolean; data: InvoiceStats }>(`${this.baseUrl}/stats`);
  }

  getInvoices(
    query: InvoiceListQuery = {}
  ): Observable<{ success: boolean; meta: ListMeta; data: MasterInvoice[] }> {
    let params = new HttpParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    });
    return this.http.get<{ success: boolean; meta: ListMeta; data: MasterInvoice[] }>(this.baseUrl, {
      params,
    });
  }

  getInvoice(id: number): Observable<{ success: boolean; data: MasterInvoice }> {
    return this.http.get<{ success: boolean; data: MasterInvoice }>(`${this.baseUrl}/${id}`);
  }

  downloadPdf(id: number): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${id}/pdf`, { responseType: 'blob' });
  }
}
