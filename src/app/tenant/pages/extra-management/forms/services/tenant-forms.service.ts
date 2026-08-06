import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../../../environments/environment';
import { SavedDynamicForm, createId } from '../models/dynamic-form.models';

/** Raw item shape from GET /api/data-collection/templates. */
export interface TenantFormsApiItem {
  id?: number;
  name?: string;
  schema?: Record<string, any> | null;
  status?: string;
  isActive?: boolean;
  createdAt?: string;
  created_at?: string;
}

export interface TenantFormsApiResponse {
  success?: boolean;
  message?: string;
  count?: number;
  meta?: {
    total?: number;
    page?: number;
    lastPage?: number;
  };
  data?: TenantFormsApiItem[];
}

/** Payload for POST /api/data-collection/templates. */
export interface CreateTenantFormPayload {
  name: string;
  schema?: Record<string, any>;
  createdBy?: number;
}

@Injectable({
  providedIn: 'root',
})
export class TenantFormsService {
  private readonly apiUrl = `${environment.tenantApiUrl}/data-collection/templates`;

  constructor(private http: HttpClient) {}

  getForms(): Observable<SavedDynamicForm[]> {
    return this.http
      .get<TenantFormsApiResponse | TenantFormsApiItem[]>(this.apiUrl)
      .pipe(map((response) => this.normalizeResponse(response)));
  }

  createForm(payload: CreateTenantFormPayload): Observable<TenantFormsApiResponse> {
    return this.http.post<TenantFormsApiResponse>(this.apiUrl, payload);
  }

  private normalizeResponse(
    response: TenantFormsApiResponse | TenantFormsApiItem[],
  ): SavedDynamicForm[] {
    const items = Array.isArray(response)
      ? response
      : Array.isArray(response?.data)
        ? response.data
        : [];

    return items.map((item) => this.normalizeItem(item));
  }

  private normalizeItem(item: TenantFormsApiItem): SavedDynamicForm {
    const schema = item.schema ?? {};
    const sections = Array.isArray(schema['sections']) ? schema['sections'] : [];

    return {
      id: item.id != null ? String(item.id) : createId('form'),
      formName: item.name ?? '',
      sectionCount: sections.length,
      sectionTypes: sections.map((section) => String(section?.type ?? '')),
      createdAt: item.createdAt ?? item.created_at ?? '',
      payload: schema as SavedDynamicForm['payload'],
    };
  }
}
