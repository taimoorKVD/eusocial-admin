import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ReportingGroup,
  ReportingGroupAssignedItem,
  ReportingGroupCategory,
  ReportingGroupOption,
} from '../interfaces/reporting-group';

interface ReportingGroupApiResponse {
  id: number;
  name: string;
  description?: string;
  isActive?: boolean;
  reportingCategories?: ReportingCategoryApiResponse[];
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

interface ReportingCategoryApiResponse {
  id: number;
  name: string;
  description?: string;
  reportingGroupId?: number;
  items?: ReportingGroupAssignedItem[];
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

interface ApiResponse<T> {
  data?: T[];
  reportingGroups?: T[];
  [key: string]: unknown;
}

@Injectable({ providedIn: 'root' })
export class ReportingGroupService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.tenantApiUrl}/reporting-groups`;
  private readonly categoriesBaseUrl = `${environment.tenantApiUrl}/reporting-categories`;

  private readonly groupsSignal = signal<ReportingGroup[]>([]);

  readonly groups = this.groupsSignal.asReadonly();

  /** Fetch all reporting groups from the API. */
  loadGroups(page = 1, limit = 500): Observable<unknown> {
    return this.http.get(`${this.baseUrl}?page=${page}&limit=${limit}`).pipe(
      tap((response) => {
        const raw = this.extractGroups(response);
        const normalized = raw.map((g) => this.normalizeGroup(g));
        this.groupsSignal.set(normalized);
      })
    );
  }

  getGroups(): ReportingGroup[] {
    return this.groupsSignal();
  }

  getGroupById(id: string): ReportingGroup | undefined {
    return this.groupsSignal().find((group) => group.id === id);
  }

  createGroup(name: string): Observable<unknown> {
    return this.http.post(this.baseUrl, { name });
  }

  updateGroup(id: string, name: string): Observable<unknown> {
    return this.http.put(`${this.baseUrl}/${id}`, { name });
  }

  deleteGroup(id: string): Observable<unknown> {
    return this.http.delete(`${this.baseUrl}/${id}`);
  }

  addCategory(reportingGroupId: string, name: string): Observable<unknown> {
    return this.http.post(this.categoriesBaseUrl, {
      reportingGroupId: Number(reportingGroupId),
      name,
    });
  }

  updateCategory(categoryId: string, name: string): Observable<unknown> {
    return this.http.put(`${this.categoriesBaseUrl}/${categoryId}`, { name });
  }

  deleteCategory(categoryId: string): Observable<unknown> {
    return this.http.delete(`${this.categoriesBaseUrl}/${categoryId}`);
  }

  assignItemsToCategory(categoryId: string, itemIds: (number | string)[]): Observable<unknown> {
    return this.http.post(`${this.categoriesBaseUrl}/${categoryId}/items`, {
      itemIds: itemIds.map(Number),
    });
  }

  removeItemsFromCategory(categoryId: string, itemIds: (number | string)[]): Observable<unknown> {
    return this.http.delete(`${this.categoriesBaseUrl}/${categoryId}/items`, {
      body: { itemIds: itemIds.map(Number) },
    });
  }

  /** Flattened categories for Item form multi-select (value = category id). */
  getCategoryOptions(): ReportingGroupOption[] {
    const options: ReportingGroupOption[] = [];

    for (const group of this.groupsSignal()) {
      for (const category of group.categories) {
        options.push({
          id: category.id,
          name: category.name,
          label: `${group.name} / ${category.name}`,
          value: category.id,
          groupId: group.id,
          groupName: group.name,
        });
      }
    }

    return options;
  }

  /**
   * Returns a `{ data: [...] }` payload when the endpoint targets reporting groups,
   * otherwise null so callers fall through to the real API.
   */
  tryGetApiResponse(endpoint?: string | null): { data: ReportingGroupOption[] } | null {
    if (!this.isReportingGroupsEndpoint(endpoint)) {
      return null;
    }

    return { data: this.getCategoryOptions() };
  }

  /** Observable wrapper for form option loaders (API-shaped). */
  getApiResponse$(endpoint?: string | null): Observable<{ data: ReportingGroupOption[] } | null> {
    const result = this.tryGetApiResponse(endpoint);
    return new Observable((subscriber) => {
      subscriber.next(result);
      subscriber.complete();
    });
  }

  /** Records shaped for DynamicModuleOptionsService. */
  getModuleRecords(): Record<string, unknown>[] {
    return this.getCategoryOptions().map((option) => ({
      id: option.id,
      name: option.name,
      label: option.label,
      value: option.value,
      groupId: option.groupId,
      groupName: option.groupName,
    }));
  }

  /** Re-hydrate after slug changes (e.g. login as another tenant). */
  reload(): void {
    this.loadGroups().subscribe();
  }

  isReportingGroupsEndpoint(endpoint?: string | null): boolean {
    if (!endpoint) {
      return false;
    }

    const normalized = endpoint
      .trim()
      .toLowerCase()
      .replace(/^\/+/, '')
      .split('?')[0]
      .replace(/\/+$/, '')
      .replace(/_/g, '-');

    return (
      normalized === 'reporting-groups' ||
      normalized === 'reporting-group' ||
      normalized === 'reportinggroups'
    );
  }

  private extractGroups(response: unknown): ReportingGroupApiResponse[] {
    if (Array.isArray(response)) {
      return response as ReportingGroupApiResponse[];
    }

    if (!response || typeof response !== 'object') {
      return [];
    }

    const record = response as ApiResponse<ReportingGroupApiResponse>;

    for (const key of ['reportingGroups', 'data', 'results', 'items']) {
      const nested = record[key];
      if (Array.isArray(nested)) {
        return nested as ReportingGroupApiResponse[];
      }
    }

    return [];
  }

  private normalizeGroup(raw: ReportingGroupApiResponse): ReportingGroup {
    return {
      id: String(raw.id ?? ''),
      name: String(raw.name || 'Untitled Group'),
      categories: Array.isArray(raw.reportingCategories)
        ? raw.reportingCategories.map((c) => this.normalizeCategory(c))
        : [],
      createdAt: raw.createdAt || '',
      updatedAt: raw.updatedAt || '',
    };
  }

  private normalizeCategory(raw: ReportingCategoryApiResponse): ReportingGroupCategory {
    return {
      id: String(raw.id ?? ''),
      name: String(raw.name || 'Untitled Category'),
      items: Array.isArray(raw.items)
        ? this.uniqueItems(
            raw.items.map((item) => ({
              id: item.id,
              name: String(item.name || `Item ${item.id}`),
            }))
          )
        : [],
    };
  }

  private uniqueItems(items: ReportingGroupAssignedItem[]): ReportingGroupAssignedItem[] {
    const seen = new Set<string>();
    const result: ReportingGroupAssignedItem[] = [];

    for (const item of items) {
      const key = String(item.id);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      result.push({ id: item.id, name: String(item.name || `Item ${item.id}`) });
    }

    return result;
  }
}
