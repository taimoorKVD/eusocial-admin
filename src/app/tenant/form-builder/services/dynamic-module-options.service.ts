import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, shareReplay, switchMap } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { FieldOption, FormField } from '../models/form-field.model';
import { FormModuleListItem } from '../../forms/models/form-module.model';
import { FormsService } from '../../forms/services/forms.service';
import { FormStorageService } from '../../forms/services/form-storage.service';
import { ReportingGroupService } from '../../../services/reporting-group.service';

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

interface ModuleDataCache {
  records: Record<string, unknown>[];
  columns: string[];
}

@Injectable({
  providedIn: 'root',
})
export class DynamicModuleOptionsService {
  private readonly modulesCache = new Map<string, Observable<FormModuleListItem[]>>();
  private readonly recordsCache = new Map<string, Observable<Record<string, unknown>[]>>();
  private readonly moduleDataCache = new Map<string, Observable<ModuleDataCache>>();
  private readonly schemaColumnsCache = new Map<string, Observable<string[]>>();
  private readonly reportingGroupService = inject(ReportingGroupService);

  constructor(
    private http: HttpClient,
    private formsService: FormsService,
    private formStorageService: FormStorageService
  ) {}

  getAvailableModules(activeModuleSlug: string): Observable<FormModuleListItem[]> {
    const cacheKey = this.normalizeSlug(activeModuleSlug);

    if (!this.modulesCache.has(cacheKey)) {
      const request = this.formsService.getForms().pipe(
        map(response =>
          (response.data ?? []).filter(
            form =>
              form.module?.isActive !== false &&
              !this.isSameModule(this.getModuleSlug(form), activeModuleSlug)
          )
        ),
        shareReplay(1)
      );
      this.modulesCache.set(cacheKey, request);
    }

    return this.modulesCache.get(cacheKey)!;
  }

  getModuleRecords(moduleSlug: string): Observable<Record<string, unknown>[]> {
    const cacheKey = this.normalizeSlug(moduleSlug);

    // Phase 1: serve Reporting Groups from localStorage (no API yet).
    if (
      cacheKey === 'reporting-group' ||
      cacheKey === 'reporting-groups' ||
      cacheKey === 'reportinggroups'
    ) {
      return of(this.reportingGroupService.getModuleRecords());
    }

    if (!this.recordsCache.has(cacheKey)) {
      const endpoint = this.resolveModuleEndpoint(moduleSlug);
      const base = environment.tenantApiUrl.replace(/\/$/, '');
      const url = `${base}${endpoint}?page=1&limit=500`;

      const request = this.http.get<unknown>(url).pipe(
        map(response => this.extractRecords(response)),
        shareReplay(1)
      );
      this.recordsCache.set(cacheKey, request);
    }

    return this.recordsCache.get(cacheKey)!;
  }

  getModuleData(moduleSlug: string): Observable<ModuleDataCache> {
    const cacheKey = this.normalizeSlug(moduleSlug);

    if (!this.moduleDataCache.has(cacheKey)) {
      const request = this.getModuleRecords(moduleSlug).pipe(
        switchMap(records => this.resolveModuleData(moduleSlug, records)),
        catchError(() =>
          this.getModuleSchemaColumns(moduleSlug).pipe(
            map(columns => ({ records: [], columns }))
          )
        ),
        shareReplay(1)
      );
      this.moduleDataCache.set(cacheKey, request);
    }

    return this.moduleDataCache.get(cacheKey)!;
  }

  buildModuleDataFromRecords(
    records: Record<string, unknown>[]
  ): ModuleDataCache {
    return {
      records,
      columns: this.extractColumnNamesFromRecords(records),
    };
  }

  buildDefaultOptionsFromRecords(
    records: Record<string, unknown>[]
  ): FieldOption[] {
    return this.buildOptionsFromRecords(records, 'name');
  }

  buildOptionsFromRecords(
    records: Record<string, unknown>[],
    labelKey: string
  ): FieldOption[] {
    const normalizedLabelKey = String(labelKey ?? '').trim();

    if (!normalizedLabelKey) {
      return [];
    }

    return records
      .map(record => {
        const id = this.readRecordId(record);
        const labelValue = this.readScalarValue(record, normalizedLabelKey);

        if (id == null || labelValue == null || labelValue === '') {
          return null;
        }

        return {
          label: String(labelValue),
          value: id,
        };
      })
      .filter((option): option is FieldOption => option !== null);
  }

  extractColumnNamesFromRecords(
    records: Record<string, unknown>[]
  ): string[] {
    const columns = new Set<string>();

    for (const record of records) {
      for (const [key, value] of Object.entries(record)) {
        if (this.isScalarColumnValue(value)) {
          columns.add(key);
        }
      }
    }

    return this.sortColumnNames(columns);
  }

  extractColumnNamesFromSchemaFields(fields: FormField[]): string[] {
    const columns = new Set<string>(['id']);

    for (const field of fields) {
      const name = String(field.name ?? '').trim();

      if (name) {
        columns.add(name);
      }
    }

    return this.sortColumnNames(columns);
  }

  getDefaultDisplayColumn(columns: string[]): string {
    if (columns.includes('name')) {
      return 'name';
    }

    if (columns.includes('title')) {
      return 'title';
    }

    return columns[0] ?? '';
  }

  getModuleSlug(form: FormModuleListItem): string {
    return form.module?.slug || form.moduleName;
  }

  getModuleLabel(form: FormModuleListItem): string {
    return form.module?.name || form.name || form.moduleName;
  }

  private resolveModuleData(
    moduleSlug: string,
    records: Record<string, unknown>[]
  ): Observable<ModuleDataCache> {
    const columnsFromRecords = this.extractColumnNamesFromRecords(records);

    if (columnsFromRecords.length > 0) {
      return of({ records, columns: columnsFromRecords });
    }

    return this.getModuleSchemaColumns(moduleSlug).pipe(
      map(columns => ({ records, columns }))
    );
  }

  private getModuleSchemaColumns(moduleSlug: string): Observable<string[]> {
    const cacheKey = this.normalizeSlug(moduleSlug);

    if (!this.schemaColumnsCache.has(cacheKey)) {
      const request = this.formStorageService.loadForm(moduleSlug).pipe(
        map(schema => {
          if (!schema?.fields?.length) {
            return this.getFallbackColumnNames();
          }

          return this.extractColumnNamesFromSchemaFields(schema.fields);
        }),
        catchError(() => of(this.getFallbackColumnNames())),
        shareReplay(1)
      );
      this.schemaColumnsCache.set(cacheKey, request);
    }

    return this.schemaColumnsCache.get(cacheKey)!;
  }

  private getFallbackColumnNames(): string[] {
    return ['id', 'name', 'title', 'email', 'phone', 'status'];
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

  private sortColumnNames(columns: Set<string>): string[] {
    const preferredOrder = ['id', 'name', 'title', 'email', 'phone', 'status'];

    return Array.from(columns).sort((left, right) => {
      const leftIndex = preferredOrder.indexOf(left);
      const rightIndex = preferredOrder.indexOf(right);

      if (leftIndex !== -1 || rightIndex !== -1) {
        if (leftIndex === -1) {
          return 1;
        }

        if (rightIndex === -1) {
          return -1;
        }

        return leftIndex - rightIndex;
      }

      return left.localeCompare(right);
    });
  }

  private isScalarColumnValue(value: unknown): boolean {
    return (
      value == null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    );
  }

  private readScalarValue(
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
