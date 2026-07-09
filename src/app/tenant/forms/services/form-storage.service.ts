import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormField } from '../../form-builder/models/form-field.model';
import { normalizeFieldOrder } from '../../form-builder/utils/form-field.factory';
import { Observable, map, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { LocationCacheService } from '../../../services/location-cache.service';

export interface StoredFormSchema {
  moduleName: string;
  formName: string;
  formId: string | number | null;
  sections: any[];
  fields: FormField[];
  conditionalRules: any[];
  markAsDraft?: boolean;
  updatedAt: string;
}

interface SaveSchemaRequest {
  schema: {
    sections: any[];
    fields: FormField[];
    conditionalRules: any[];
  };
  markAsDraft: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class FormStorageService {
  private saveSchemaUrl = `${environment.tenantApiUrl}/forms`;
  private readonly locationCache = inject(LocationCacheService);

  constructor(private http: HttpClient) {}

  saveForm(moduleName: string,
    data: {
      formName: string;
      formId: string | number | null;
      fields: FormField[];
      sections?: any[];
      conditionalRules?: any[];
      markAsDraft?: boolean;
    }
  ): Observable<StoredFormSchema> {
    const schema = {
      sections: data.sections ?? [],
      fields: data.fields ?? [],
      conditionalRules: data.conditionalRules ?? []
    };

    const requestPayload: SaveSchemaRequest = {
      schema,
      markAsDraft: data.markAsDraft ?? true
    };

    const payload: StoredFormSchema = {
      moduleName,
      formName: data.formName,
      formId: data.formId,
      sections: schema.sections,
      fields: schema.fields,
      conditionalRules: schema.conditionalRules,
      markAsDraft: requestPayload.markAsDraft,
      updatedAt: new Date().toISOString()
    };

    console.log('with payload:', payload);
    return this.http.put<any>(`${this.saveSchemaUrl}/${data.formId}/schema`, requestPayload).pipe(
      map(response => this.extractSchema(response, payload))
    );
  }

  loadForm(moduleName: string): Observable<StoredFormSchema | null> {
    const loadSchemaUrl = `${environment.tenantApiUrl}/forms/modules/${moduleName}`;

    return this.http.get<any>(loadSchemaUrl).pipe(
      map(response => this.extractSchema(response, null, moduleName))
    );
  }

  // deleteForm(moduleName: string): Observable<void> {
  //   return this.http.delete<void>(this.saveSchemaUrl);
  // }

  private extractSchema(
    response: any,
    fallback: StoredFormSchema | null,
    moduleName = 'users'
  ): StoredFormSchema | null {
    if (!response && fallback) {
      return fallback;
    }

    const source = response?.data ?? response;
    if (!source) {
      return fallback;
    }

    return {
      moduleName: source.moduleName || moduleName,
      formName: source.form?.name || fallback?.formName || 'Users Dynamic Form',
      formId: source.form?.moduleId ?? fallback?.formId ?? 1,
      sections: Array.isArray(source.sections)
        ? source.sections
        : Array.isArray(source.schema?.sections)
          ? source.schema.sections
          : fallback?.sections || [],
      fields: normalizeFieldOrder(
        Array.isArray(source.fields)
          ? source.fields
          : Array.isArray(source.schema?.fields)
            ? source.schema.fields
            : fallback?.fields || []
      ),
      conditionalRules: Array.isArray(source.conditionalRules)
        ? source.conditionalRules
        : Array.isArray(source.schema?.conditionalRules)
          ? source.schema.conditionalRules
          : fallback?.conditionalRules || [],
      markAsDraft: source.markAsDraft ?? fallback?.markAsDraft ?? true,
      updatedAt: source.updatedAt || fallback?.updatedAt || new Date().toISOString()
    };
  }

  getEndpointApi<T>(
    endpoint: string,
    params?: Record<string, any>
  ): Observable<T> {

    const cached = this.locationCache.getCachedResponse<T>(endpoint);
    if (cached) {
      return cached;
    }

    // console.log(endpoint)
    // const normalizedEndpoint = endpoint.replace(/^\/+/, '').toLowerCase();
    // if (normalizedEndpoint === 'states' || normalizedEndpoint === 'cities') {
    //   return of(null as T);
    // }

    const apiUrl = `${environment.tenantApiUrl}/${endpoint}`;
    return this.http.get<T>(apiUrl);
  }
}
