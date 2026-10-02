import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, shareReplay, switchMap } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { FieldOption, FormField } from '../models/form-field.model';
import {
  FormModuleKind,
  FormModuleListItem,
} from '../../forms/models/form-module.model';
import { FormsService } from '../../forms/services/forms.service';
import { FormStorageService } from '../../forms/services/form-storage.service';

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

export interface ModuleColumnOption {
  id: string;
  label: string;
}

export interface ModuleDataCache {
  records: Record<string, unknown>[];
  columns: ModuleColumnOption[];
  /** Key used to read display labels from each record (`name` or field id). */
  displayLabelKey: string;
  moduleType: FormModuleKind;
  /** Pre-built Select Options using the resolved display key. */
  options: FieldOption[];
}

@Injectable({
  providedIn: 'root',
})
export class DynamicModuleOptionsService {
  private readonly modulesCache = new Map<string, Observable<FormModuleListItem[]>>();
  private readonly recordsCache = new Map<string, Observable<Record<string, unknown>[]>>();
  private readonly moduleDataCache = new Map<string, Observable<ModuleDataCache>>();
  private readonly schemaFieldsCache = new Map<string, Observable<FormField[]>>();
  private readonly moduleTypeBySlug = new Map<string, FormModuleKind>();

  constructor(
    private http: HttpClient,
    private formsService: FormsService,
    private formStorageService: FormStorageService
  ) {}

  getAvailableModules(activeModuleSlug: string): Observable<FormModuleListItem[]> {
    const cacheKey = this.normalizeSlug(activeModuleSlug);

    if (!this.modulesCache.has(cacheKey)) {
      const request = this.formsService.getForms().pipe(
        map(response => {
          const modules = (response.data ?? []).filter(
            form =>
              form.module?.isActive !== false &&
              !this.isSameModule(this.getModuleSlug(form), activeModuleSlug)
          );
          this.rememberModuleTypes(modules);
          return modules;
        }),
        shareReplay(1)
      );
      this.modulesCache.set(cacheKey, request);
    }

    return this.modulesCache.get(cacheKey)!;
  }

  getModuleRecords(moduleSlug: string): Observable<Record<string, unknown>[]> {
    const cacheKey = this.normalizeSlug(moduleSlug);

    if (!this.recordsCache.has(cacheKey)) {
      const endpoint = this.resolveModuleEndpoint(moduleSlug);
      const base = environment.tenantApiUrl.replace(/\/$/, '');
      const url = `${base}${endpoint}`;

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
      const request = this.resolveModuleType(moduleSlug).pipe(
        switchMap(moduleType =>
          this.getModuleRecords(moduleSlug).pipe(
            switchMap(records => this.resolveModuleData(moduleSlug, records, moduleType)),
            catchError(() =>
              this.getModuleSchemaFields(moduleSlug).pipe(
                map(fields =>
                  this.buildModuleDataCache([], fields, moduleType, 'name'),
                ),
              )
            ),
          ),
        ),
        shareReplay(1),
      );
      this.moduleDataCache.set(cacheKey, request);
    }

    return this.moduleDataCache.get(cacheKey)!;
  }

  buildModuleDataFromRecords(
    records: Record<string, unknown>[]
  ): ModuleDataCache {
    return this.buildModuleDataCache(records, [], 'static', 'name');
  }

  buildDefaultOptionsFromRecords(
    records: Record<string, unknown>[]
  ): FieldOption[] {
    return this.buildOptionsFromRecords(records, 'name');
  }

  buildOptionsFromRecords(
    records: Record<string, unknown>[],
    labelKey: string,
    valueKey = 'id'
  ): FieldOption[] {
    const normalizedLabelKey = String(labelKey ?? '').trim();
    const normalizedValueKey = String(valueKey ?? '').trim() || 'id';

    if (!normalizedLabelKey) {
      return [];
    }

    return records
      .map((record, index) => {
        const value = this.readRecordOptionValue(record, normalizedValueKey);
        const labelValue = this.readScalarValue(record, normalizedLabelKey);

        if (value == null || labelValue == null || labelValue === '') {
          return null;
        }

        const option: FieldOption = {
          label: String(labelValue),
          value,
          sortOrder: index,
        };

        if (typeof value === 'number') {
          option.id = value;
        }

        return option;
      })
      .filter((option): option is FieldOption => option !== null);
  }

  /**
   * Resolve which record property holds the human-readable name/label.
   * Static modules: prefer `name` on the record.
   * Dynamic modules: use module schema metadata (systemMappingKey / fieldKey / id).
   */
  resolveDisplayLabelKey(
    moduleType: FormModuleKind,
    fields: FormField[],
    records: Record<string, unknown>[],
  ): string {
    if (moduleType === 'static') {
      return this.resolveStaticDisplayLabelKey(records);
    }

    return this.resolveDynamicDisplayLabelKey(fields, records);
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
    return this.buildModuleColumns([], fields).map(column => column.id);
  }

  getDefaultDisplayColumn(columns: ModuleColumnOption[]): string {
    const ids = columns.map(column => column.id);

    if (ids.includes('name')) {
      return 'name';
    }

    if (ids.includes('title')) {
      return 'title';
    }

    return columns[0]?.id ?? '';
  }

  getModuleSlug(form: FormModuleListItem): string {
    return form.module?.slug || form.moduleName;
  }

  getModuleLabel(form: FormModuleListItem): string {
    return form.module?.name || form.name || form.moduleName;
  }

  getCachedModuleType(moduleSlug: string): FormModuleKind | undefined {
    return this.moduleTypeBySlug.get(this.normalizeSlug(moduleSlug));
  }

  private resolveModuleData(
    moduleSlug: string,
    records: Record<string, unknown>[],
    moduleType: FormModuleKind,
  ): Observable<ModuleDataCache> {
    if (moduleType === 'static') {
      const displayLabelKey = this.resolveStaticDisplayLabelKey(records);
      return of(
        this.buildModuleDataCache(records, [], moduleType, displayLabelKey),
      );
    }

    return this.getModuleSchemaFields(moduleSlug).pipe(
      map(fields => {
        const displayLabelKey = this.resolveDynamicDisplayLabelKey(fields, records);
        return this.buildModuleDataCache(
          records,
          fields,
          moduleType,
          displayLabelKey,
        );
      }),
    );
  }

  private buildModuleDataCache(
    records: Record<string, unknown>[],
    fields: FormField[],
    moduleType: FormModuleKind,
    displayLabelKey: string,
  ): ModuleDataCache {
    const resolvedKey = displayLabelKey || 'name';
    return {
      records,
      columns: this.buildModuleColumns(records, fields),
      displayLabelKey: resolvedKey,
      moduleType,
      options: this.buildOptionsFromRecords(records, resolvedKey),
    };
  }

  private resolveStaticDisplayLabelKey(
    records: Record<string, unknown>[],
  ): string {
    if (records.some(record => this.hasNonEmptyValue(record, 'name'))) {
      return 'name';
    }
    if (records.some(record => this.hasNonEmptyValue(record, 'title'))) {
      return 'title';
    }
    return 'name';
  }

  private resolveDynamicDisplayLabelKey(
    fields: FormField[],
    records: Record<string, unknown>[],
  ): string {
    const candidates = fields.filter(field => String(field.id ?? '').trim());

    const bySystemMapping = candidates.find(field =>
      this.isNameLikeKey(field.systemMappingKey),
    );
    if (bySystemMapping?.id) {
      return String(bySystemMapping.id);
    }

    const byFieldKey = candidates.find(field =>
      this.isNameLikeKey(field.fieldKey) || this.isNameLikeKey(field.name),
    );
    if (byFieldKey?.id) {
      return String(byFieldKey.id);
    }

    const byLabel = candidates.find(field => this.isNameLikeLabel(field.label));
    if (byLabel?.id) {
      return String(byLabel.id);
    }

    const presentOnRecords = candidates.find(field =>
      records.some(record => this.hasNonEmptyValue(record, String(field.id))),
    );
    if (presentOnRecords?.id) {
      return String(presentOnRecords.id);
    }

    // Fallbacks for legacy/partial schemas.
    if (records.some(record => this.hasNonEmptyValue(record, 'name'))) {
      return 'name';
    }

    return candidates[0]?.id ? String(candidates[0].id) : 'name';
  }

  private isNameLikeKey(raw: unknown): boolean {
    const key = String(raw ?? '')
      .trim()
      .toLowerCase();
    if (!key) {
      return false;
    }
    return key === 'name' || key.endsWith('_name');
  }

  private isNameLikeLabel(raw: unknown): boolean {
    const label = String(raw ?? '')
      .trim()
      .toLowerCase();
    if (!label) {
      return false;
    }
    return label === 'name' || label.endsWith(' name');
  }

  private hasNonEmptyValue(
    record: Record<string, unknown>,
    key: string,
  ): boolean {
    const value = this.readScalarValue(record, key);
    return value != null && String(value).trim() !== '';
  }

  private resolveModuleType(moduleSlug: string): Observable<FormModuleKind> {
    const cached = this.getCachedModuleType(moduleSlug);
    if (cached) {
      return of(cached);
    }

    return this.formsService.getForms().pipe(
      map(response => {
        this.rememberModuleTypes(response.data ?? []);
        return (
          this.getCachedModuleType(moduleSlug) ?? this.inferModuleType(moduleSlug)
        );
      }),
    );
  }

  private inferModuleType(moduleSlug: string): FormModuleKind {
    // Location catalogs and similar known static modules when type is missing.
    const kind = this.normalizeSlug(moduleSlug);
    if (
      kind === 'countries' ||
      kind === 'states' ||
      kind === 'cities' ||
      kind === 'roles' ||
      kind === 'locations'
    ) {
      return 'static';
    }
    return 'dynamic';
  }

  private rememberModuleTypes(modules: FormModuleListItem[]): void {
    for (const form of modules) {
      const slug = this.normalizeSlug(this.getModuleSlug(form));
      const type = this.normalizeModuleType(form.module?.type ?? form.type);
      if (slug && type) {
        this.moduleTypeBySlug.set(slug, type);
      }
    }
  }

  private normalizeModuleType(raw: unknown): FormModuleKind | undefined {
    const value = String(raw ?? '')
      .trim()
      .toLowerCase();
    if (value === 'static' || value === 'dynamic') {
      return value;
    }
    return undefined;
  }

  private getModuleSchemaFields(moduleSlug: string): Observable<FormField[]> {
    const cacheKey = this.normalizeSlug(moduleSlug);

    if (!this.schemaFieldsCache.has(cacheKey)) {
      const request = this.formStorageService.loadForm(moduleSlug).pipe(
        map(schema => schema?.fields ?? []),
        catchError(() => of([])),
        shareReplay(1)
      );
      this.schemaFieldsCache.set(cacheKey, request);
    }

    return this.schemaFieldsCache.get(cacheKey)!;
  }

  private buildModuleColumns(
    records: Record<string, unknown>[],
    fields: FormField[]
  ): ModuleColumnOption[] {
    const labelByKey = this.buildSchemaColumnLabelMap(fields);
    const columnIds = new Set<string>();

    for (const field of fields) {
      const id = String(field.id ?? '').trim();
      if (id) {
        columnIds.add(id);
      }
    }

    for (const columnId of this.extractColumnNamesFromRecords(records)) {
      columnIds.add(columnId);
    }

    if (!columnIds.size) {
      return this.getFallbackColumns();
    }

    const columns: ModuleColumnOption[] = Array.from(columnIds).map(id => ({
      id,
      label: labelByKey.get(id) || this.formatColumnLabel(id),
    }));

    return this.sortModuleColumns(columns);
  }

  private buildSchemaColumnLabelMap(fields: FormField[]): Map<string, string> {
    const labels = new Map<string, string>();

    for (const field of fields) {
      const label = String(field.label ?? '').trim();
      if (!label) {
        continue;
      }

      const id = String(field.id ?? '').trim();
      const name = String(field.name ?? '').trim();
      const fieldKey = String(field.fieldKey ?? '').trim();
      const systemMappingKey = String(field.systemMappingKey ?? '').trim();

      if (id) {
        labels.set(id, label);
      }
      if (name) {
        labels.set(name, label);
      }
      if (fieldKey) {
        labels.set(fieldKey, label);
      }
      if (systemMappingKey) {
        labels.set(systemMappingKey, label);
      }
    }

    return labels;
  }

  private formatColumnLabel(columnId: string): string {
    const normalized = String(columnId ?? '').trim();

    if (!normalized || /^fld_/i.test(normalized)) {
      return normalized;
    }

    return normalized
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, character => character.toUpperCase());
  }

  private getFallbackColumns(): ModuleColumnOption[] {
    return ['id', 'name', 'title', 'email', 'phone', 'status'].map(id => ({
      id,
      label: this.formatColumnLabel(id),
    }));
  }

  private sortModuleColumns(columns: ModuleColumnOption[]): ModuleColumnOption[] {
    const orderedIds = this.sortColumnNames(
      new Set(columns.map(column => column.id))
    );
    const columnsById = new Map(columns.map(column => [column.id, column]));

    return orderedIds
      .map(id => columnsById.get(id))
      .filter((column): column is ModuleColumnOption => !!column);
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

  /** Read option value using configured `valueKey` (falls back to id/_id when key is `id`). */
  private readRecordOptionValue(
    record: Record<string, unknown>,
    valueKey: string
  ): string | number | null {
    const fromKey = this.readScalarValue(record, valueKey);

    if (typeof fromKey === 'string' || typeof fromKey === 'number') {
      return fromKey;
    }

    if (valueKey === 'id' || valueKey === '_id') {
      return this.readRecordId(record);
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
