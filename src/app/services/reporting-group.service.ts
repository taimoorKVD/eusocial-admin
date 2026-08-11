import { Injectable, inject, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import {
  ReportingGroup,
  ReportingGroupAssignedItem,
  ReportingGroupCategory,
  ReportingGroupOption,
} from '../interfaces/reporting-group';
import { TenantSessionService } from './tenant-session.service';

/**
 * Tenant-scoped Reporting Groups data access.
 * Persists to localStorage for Phase 1; swap persist/load for API later.
 */
@Injectable({ providedIn: 'root' })
export class ReportingGroupService {
  private readonly session = inject(TenantSessionService);
  private readonly STORAGE_PREFIX = 'tenant_reporting_groups';

  /** In-memory mirror so consumers can react without re-reading storage. */
  private readonly groupsSignal = signal<ReportingGroup[]>(this.loadFromStorage());

  readonly groups = this.groupsSignal.asReadonly();

  getGroups(): ReportingGroup[] {
    return this.groupsSignal();
  }

  getGroupById(id: string): ReportingGroup | undefined {
    return this.groupsSignal().find((group) => group.id === id);
  }

  createGroup(name: string): ReportingGroup {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('Reporting group name is required');
    }

    const now = new Date().toISOString();
    const group: ReportingGroup = {
      id: this.createId('rg'),
      name: trimmed,
      categories: [],
      createdAt: now,
      updatedAt: now,
    };

    this.persist([...this.groupsSignal(), group]);
    return group;
  }

  updateGroup(id: string, name: string): ReportingGroup {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('Reporting group name is required');
    }

    const groups = this.groupsSignal().map((group) =>
      group.id === id
        ? { ...group, name: trimmed, updatedAt: new Date().toISOString() }
        : group
    );

    if (!groups.some((group) => group.id === id)) {
      throw new Error('Reporting group not found');
    }

    this.persist(groups);
    return groups.find((group) => group.id === id)!;
  }

  deleteGroup(id: string): void {
    this.persist(this.groupsSignal().filter((group) => group.id !== id));
  }

  addCategory(groupId: string, name: string): ReportingGroupCategory {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('Category name is required');
    }

    const category: ReportingGroupCategory = {
      id: this.createId('cat'),
      name: trimmed,
      items: [],
    };

    this.mutateGroup(groupId, (group) => ({
      ...group,
      categories: [...group.categories, category],
      updatedAt: new Date().toISOString(),
    }));

    return category;
  }

  updateCategory(
    groupId: string,
    categoryId: string,
    name: string
  ): ReportingGroupCategory {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('Category name is required');
    }

    let updated: ReportingGroupCategory | null = null;

    this.mutateGroup(groupId, (group) => ({
      ...group,
      categories: group.categories.map((category) => {
        if (category.id !== categoryId) {
          return category;
        }
        updated = { ...category, name: trimmed };
        return updated;
      }),
      updatedAt: new Date().toISOString(),
    }));

    if (!updated) {
      throw new Error('Category not found');
    }

    return updated;
  }

  deleteCategory(groupId: string, categoryId: string): void {
    this.mutateGroup(groupId, (group) => ({
      ...group,
      categories: group.categories.filter((category) => category.id !== categoryId),
      updatedAt: new Date().toISOString(),
    }));
  }

  setCategoryItems(
    groupId: string,
    categoryId: string,
    items: ReportingGroupAssignedItem[]
  ): void {
    const unique = this.uniqueItems(items);

    this.mutateGroup(groupId, (group) => ({
      ...group,
      categories: group.categories.map((category) =>
        category.id === categoryId ? { ...category, items: unique } : category
      ),
      updatedAt: new Date().toISOString(),
    }));
  }

  removeItemFromCategory(
    groupId: string,
    categoryId: string,
    itemId: number | string
  ): void {
    this.mutateGroup(groupId, (group) => ({
      ...group,
      categories: group.categories.map((category) =>
        category.id === categoryId
          ? {
              ...category,
              items: category.items.filter((item) => String(item.id) !== String(itemId)),
            }
          : category
      ),
      updatedAt: new Date().toISOString(),
    }));
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
    return of(this.tryGetApiResponse(endpoint));
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
    this.groupsSignal.set(this.loadFromStorage());
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

  private mutateGroup(
    groupId: string,
    updater: (group: ReportingGroup) => ReportingGroup
  ): void {
    let found = false;
    const groups = this.groupsSignal().map((group) => {
      if (group.id !== groupId) {
        return group;
      }
      found = true;
      return updater(group);
    });

    if (!found) {
      throw new Error('Reporting group not found');
    }

    this.persist(groups);
  }

  private persist(groups: ReportingGroup[]): void {
    this.groupsSignal.set(groups);
    try {
      localStorage.setItem(this.storageKey(), JSON.stringify(groups));
    } catch {
      // Storage unavailable — in-memory state still works for the session.
    }
  }

  private loadFromStorage(): ReportingGroup[] {
    try {
      const raw = localStorage.getItem(this.storageKey());
      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .filter((entry) => entry && typeof entry === 'object')
        .map((entry) => this.normalizeGroup(entry as Partial<ReportingGroup>));
    } catch {
      return [];
    }
  }

  private normalizeGroup(raw: Partial<ReportingGroup>): ReportingGroup {
    const now = new Date().toISOString();
    return {
      id: String(raw.id || this.createId('rg')),
      name: String(raw.name || 'Untitled Group'),
      categories: Array.isArray(raw.categories)
        ? raw.categories.map((category) => this.normalizeCategory(category))
        : [],
      createdAt: raw.createdAt || now,
      updatedAt: raw.updatedAt || now,
    };
  }

  private normalizeCategory(raw: Partial<ReportingGroupCategory>): ReportingGroupCategory {
    return {
      id: String(raw.id || this.createId('cat')),
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

  private storageKey(): string {
    const slug = this.session.getSlug() || 'default';
    return `${this.STORAGE_PREFIX}_${slug}`;
  }

  private createId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}
