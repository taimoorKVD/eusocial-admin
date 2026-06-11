import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { FormField } from '../../form-builder/models/form-field.model';
import { normalizeFieldOrder } from '../../form-builder/utils/form-field.factory';

// Note: version creation is handled server-side on Save Form.
// This service only exposes read and restore operations.

export interface FormVersion {
  id: number;
  versionNumber?: number;
  version?: number;
  label?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface FormVersionDetail extends FormVersion {
  fields: FormField[];
  schema?: { fields?: FormField[] };
}

@Injectable({ providedIn: 'root' })
export class FormVersionService {
  constructor(private http: HttpClient) {}

  private base(moduleName: string): string {
    const root = environment.tenantApiUrl.replace(/\/$/, '');
    return `${root}/forms/${moduleName}/versions`;
  }

  getVersions(moduleName: string): Observable<FormVersion[]> {
    return this.http.get<any>(this.base(moduleName)).pipe(
      map(res => this.extractList(res))
    );
  }

  getVersionDetail(moduleName: string, versionNumber: number): Observable<FormVersionDetail> {
    return this.http.get<any>(`${this.base(moduleName)}/${versionNumber}`).pipe(
      map(res => this.extractDetail(res))
    );
  }

  restoreVersion(moduleName: string, versionNumber: number): Observable<FormVersionDetail> {
    return this.http.post<any>(`${this.base(moduleName)}/restore/${versionNumber}`, {}).pipe(
      map(res => this.extractDetail(res))
    );
  }

  private extractList(res: any): FormVersion[] {
    const items: any[] = Array.isArray(res)
      ? res
      : Array.isArray(res?.data)
        ? res.data
        : [];
    return items.map(item => this.extractItem(item));
  }

  private extractItem(item: any): FormVersion {
    return {
      id: item?.id ?? 0,
      versionNumber: item?.versionNumber ?? item?.version ?? item?.id,
      label: item?.label ?? item?.name ?? null,
      createdAt: item?.createdAt ?? item?.created_at ?? null,
      updatedAt: item?.updatedAt ?? item?.updated_at ?? null,
    };
  }

  private extractDetail(res: any): FormVersionDetail {
    const source = res?.data ?? res ?? {};
    const rawFields = this.extractFieldsFromSource(source);

    return {
      ...this.extractItem(source),
      fields: normalizeFieldOrder(rawFields),
    };
  }

  private extractFieldsFromSource(source: Record<string, unknown>): unknown[] {
    const schemaSnapshot = source['schemaSnapshot'] ?? source['schema_snapshot'];

    if (schemaSnapshot && typeof schemaSnapshot === 'object') {
      const snapshot = schemaSnapshot as Record<string, unknown>;
      if (Array.isArray(snapshot['fields'])) {
        return snapshot['fields'];
      }
      if (Array.isArray(snapshot['schema']?.['fields'])) {
        return (snapshot['schema'] as Record<string, unknown>)['fields'] as unknown[];
      }
    }

    if (Array.isArray(source['fields'])) {
      return source['fields'];
    }

    const schema = source['schema'];
    if (schema && typeof schema === 'object' && Array.isArray((schema as Record<string, unknown>)['fields'])) {
      return (schema as Record<string, unknown>)['fields'] as unknown[];
    }

    return [];
  }
}
