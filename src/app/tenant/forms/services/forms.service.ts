import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  FormModuleApiItem,
  FormModuleListItem,
  FormsListResponse,
} from '../models/form-module.model';

@Injectable({
  providedIn: 'root',
})
export class FormsService {
  private readonly apiUrl = `${environment.tenantApiUrl}/forms`;

  constructor(private http: HttpClient) {}

  getForms(): Observable<FormsListResponse> {
    return this.http
      .get<FormsListResponse | FormModuleApiItem[]>(this.apiUrl)
      .pipe(map(response => this.normalizeResponse(response)));
  }

  private normalizeResponse(
    response: FormsListResponse | FormModuleApiItem[]
  ): FormsListResponse {
    if (Array.isArray(response)) {
      return { data: response.map(item => this.normalizeItem(item)) };
    }

    const items = Array.isArray(response?.data)
      ? (response.data as FormModuleApiItem[])
      : [];

    return {
      ...response,
      data: items.map(item => this.normalizeItem(item)),
    };
  }

  private normalizeItem(item: FormModuleApiItem): FormModuleListItem {
    const moduleName =
      item.moduleName ??
      item.module_name ??
      item.route ??
      item.module?.slug ??
      item.slug ??
      '';

    const moduleType = this.normalizeModuleType(
      item.module?.type ?? item.type,
    );

    const module = {
      id: item.module?.id ?? item.id ?? 0,
      name: item.module?.name ?? item.name ?? moduleName,
      slug: item.module?.slug ?? moduleName,
      isActive: item.module?.isActive ?? true,
      type: moduleType,
    };

    return {
      id: item.id,
      name: item.name ?? moduleName,
      moduleName,
      type: moduleType,
      module,
    };
  }

  private normalizeModuleType(raw: unknown): 'static' | 'dynamic' | undefined {
    const value = String(raw ?? '')
      .trim()
      .toLowerCase();

    if (value === 'static' || value === 'dynamic') {
      return value;
    }

    return undefined;
  }
}
