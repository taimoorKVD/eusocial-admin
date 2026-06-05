import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { FieldOption, OptionSource } from '../models/form-field.model';
import { normalizeFieldOptions } from '../utils/field-options.utils';
import { normalizeEndpoint } from '../utils/option-source.utils';

@Injectable({
  providedIn: 'root',
})
export class FieldOptionsService {
  private readonly cache = new Map<string, FieldOption[]>();

  constructor(private http: HttpClient) {}

  getOptions(optionSource?: OptionSource): Observable<FieldOption[]> {
    if (!optionSource) {
      return of([]);
    }

    if (optionSource.type === 'static') {
      return of(this.mapStaticOptions(optionSource));
    }

    if (optionSource.type !== 'api' || !optionSource.endpoint) {
      return of([]);
    }

    const cacheKey = this.buildCacheKey(optionSource);
    const cached = this.cache.get(cacheKey);

    if (cached) {
      return of(cached);
    }

    const url = this.buildRequestUrl(optionSource.endpoint);

    return this.http.get<unknown>(url).pipe(
      map(response => {
        const options = this.mapApiResponse(response, optionSource);
        this.cache.set(cacheKey, options);
        return options;
      }),
      catchError(() => of([]))
    );
  }

  private buildRequestUrl(endpoint: string): string {
    const resolved = this.resolveEndpoint(endpoint);

    if (resolved.includes('?')) {
      return resolved;
    }

    return `${resolved}?page=1&limit=500`;
  }

  private resolveEndpoint(endpoint: string): string {
    if (/^https?:\/\//i.test(endpoint)) {
      return endpoint;
    }

    const normalized = normalizeEndpoint(endpoint);
    const base = environment.tenantApiUrl.replace(/\/$/, '');
    const path = normalized.startsWith('/') ? normalized : `/${normalized}`;

    if (path.startsWith('/api/')) {
      return `${base}${path.replace(/^\/api/, '')}`;
    }

    return `${base}${path}`;
  }

  private mapApiResponse(
    response: unknown,
    optionSource: OptionSource
  ): FieldOption[] {
    const labelKey = optionSource.response?.labelKey || 'name';
    const valueKey = optionSource.response?.valueKey || 'id';
    const dataPath = optionSource.response?.dataPath ?? 'data';
    const items = this.extractItems(response, dataPath);

    return items
      .map(item => this.mapItemToOption(item, labelKey, valueKey))
      .filter((option): option is FieldOption => option !== null);
  }

  private mapItemToOption(
    item: unknown,
    labelKey: string,
    valueKey: string
  ): FieldOption | null {
    if (!item || typeof item !== 'object') {
      return null;
    }

    const record = item as Record<string, unknown>;
    const label = this.readValue(record, labelKey);
    const value = this.readValue(record, valueKey);

    if (label == null || value == null) {
      return null;
    }

    return {
      label: String(label),
      value: value as string | number,
    };
  }

  private readValue(
    record: Record<string, unknown>,
    key: string
  ): unknown {
    if (key in record) {
      return record[key];
    }

    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

    if (snakeKey in record) {
      return record[snakeKey];
    }

    return undefined;
  }

  private extractItems(response: unknown, dataPath?: string): unknown[] {
    if (Array.isArray(response)) {
      return response;
    }

    if (!response || typeof response !== 'object') {
      return [];
    }

    const record = response as Record<string, unknown>;

    if (dataPath) {
      const nested = this.readPath(record, dataPath);
      if (Array.isArray(nested)) {
        return nested;
      }
    }

    if (Array.isArray(record['data'])) {
      return record['data'];
    }

    if (Array.isArray(record['results'])) {
      return record['results'];
    }

    if (Array.isArray(record['items'])) {
      return record['items'];
    }

    return [];
  }

  private readPath(source: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce<unknown>((current, key) => {
      if (!current || typeof current !== 'object') {
        return undefined;
      }

      return (current as Record<string, unknown>)[key];
    }, source);
  }

  private mapStaticOptions(optionSource: OptionSource): FieldOption[] {
    return normalizeFieldOptions(optionSource.options);
  }

  private buildCacheKey(optionSource: OptionSource): string {
    const response = optionSource.response || {};
    return [
      optionSource.endpoint,
      response.labelKey,
      response.valueKey,
      response.dataPath,
    ].join('|');
  }
}
