import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { FieldOption } from '../models/form-field.model';
import { FormModuleListItem } from '../../forms/models/form-module.model';
import { FormsService } from '../../forms/services/forms.service';

const MODULE_API_PATHS: Record<string, string> = {
  users: '/users',
  user: '/users',
  vendors: '/vendors',
  vendor: '/vendors',
  items: '/items',
  item: '/items',
  roles: '/roles',
  role: '/roles',
  locations: '/locations',
  location: '/locations',
  'job-position': '/jobpositions',
  'job-positions': '/jobpositions',
  jobpositions: '/jobpositions',
  'reporting-group': '/reporting-groups',
  'reporting-groups': '/reporting-groups',
};

const PREFERRED_LABEL_KEYS = [
  'name',
  'title',
  'label',
  'fullName',
  'full_name',
  'email',
  'description',
];

@Injectable({
  providedIn: 'root',
})
export class DynamicModuleOptionsService {
  constructor(
    private http: HttpClient,
    private formsService: FormsService
  ) {}

  getAvailableModules(activeModuleSlug: string): Observable<FormModuleListItem[]> {
    return this.formsService.getForms().pipe(
      map(response =>
        (response.data ?? []).filter(
          form =>
            form.module?.isActive !== false &&
            !this.isSameModule(this.getModuleSlug(form), activeModuleSlug)
        )
      )
    );
  }

  getModuleRecords(moduleSlug: string): Observable<Record<string, unknown>[]> {
    const endpoint = this.resolveModuleEndpoint(moduleSlug);
    const base = environment.tenantApiUrl.replace(/\/$/, '');
    const url = `${base}${endpoint}?page=1&limit=500`;

    return this.http.get<unknown>(url).pipe(
      map(response => this.extractRecords(response))
    );
  }

  extractDisplayFieldKeys(records: Record<string, unknown>[]): string[] {
    const sample =
      records.find(record => this.readRecordId(record) != null) ?? records[0];

    if (!sample) {
      return [];
    }

    const keys = Object.keys(sample).filter(key => {
      const value = sample[key];
      return (
        key !== 'id' &&
        (typeof value === 'string' ||
          typeof value === 'number' ||
          typeof value === 'boolean')
      );
    });

    return keys.sort((a, b) => {
      const aRank = PREFERRED_LABEL_KEYS.indexOf(a);
      const bRank = PREFERRED_LABEL_KEYS.indexOf(b);

      if (aRank !== -1 || bRank !== -1) {
        return (aRank === -1 ? 999 : aRank) - (bRank === -1 ? 999 : bRank);
      }

      return a.localeCompare(b);
    });
  }

  buildOptionsFromRecords(
    records: Record<string, unknown>[],
    labelField: string
  ): FieldOption[] {
    return records
      .map(record => {
        const id = this.readRecordId(record);
        const label = record[labelField];

        if (id == null || label == null || label === '') {
          return null;
        }

        return {
          label: String(label),
          value: id as string | number,
        };
      })
      .filter((option): option is FieldOption => option !== null);
  }

  getModuleSlug(form: FormModuleListItem): string {
    return form.module?.slug || form.moduleName;
  }

  getModuleLabel(form: FormModuleListItem): string {
    return form.module?.name || form.name || form.moduleName;
  }

  private resolveModuleEndpoint(moduleSlug: string): string {
    const normalized = this.normalizeSlug(moduleSlug);

    if (MODULE_API_PATHS[normalized]) {
      return MODULE_API_PATHS[normalized];
    }

    return `/${normalized.replace(/-/g, '')}`;
  }

  private extractRecords(response: unknown): Record<string, unknown>[] {
    if (Array.isArray(response)) {
      return response.filter(this.isRecord);
    }

    if (!response || typeof response !== 'object') {
      return [];
    }

    const record = response as Record<string, unknown>;

    for (const key of ['data', 'results', 'items']) {
      const nested = record[key];
      if (Array.isArray(nested)) {
        return nested.filter(this.isRecord);
      }
    }

    return [];
  }

  private readRecordId(record: Record<string, unknown>): string | number | null {
    const id = record['id'] ?? record['_id'];

    if (typeof id === 'string' || typeof id === 'number') {
      return id;
    }

    return null;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  private isSameModule(moduleSlug: string, activeModuleSlug: string): boolean {
    const left = this.normalizeSlug(moduleSlug);
    const right = this.normalizeSlug(activeModuleSlug);

    if (!left || !right) {
      return false;
    }

    if (left === right) {
      return true;
    }

    return left.replace(/-/g, '') === right.replace(/-/g, '');
  }

  private normalizeSlug(slug: string): string {
    return String(slug ?? '')
      .trim()
      .toLowerCase()
      .replace(/_/g, '-');
  }
}
