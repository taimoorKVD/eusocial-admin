import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, of } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { ReportingGroupService } from '../../../../services/reporting-group.service';
import { TenantItemService } from '../../../../services/tenant-item.service';
import { FormStorageService } from '../../../forms/services/form-storage.service';
import { DynamicField } from '../../../../interfaces/dynamic-field';
import {
  ReportingGroup,
  ReportingGroupAssignedItem,
  ReportingGroupCategory,
} from '../../../../interfaces/reporting-group';

type ModalMode = 'create-group' | 'edit-group' | 'add-category' | 'edit-category' | 'assign-items' | null;

interface PendingDelete {
  type: 'group' | 'category' | 'item';
  groupId: string;
  categoryId?: string;
  itemId?: number | string;
  label: string;
}

interface CatalogItem {
  id: number | string;
  name: string;
}

@Component({
  selector: 'app-setup-reporting-group',
  standalone: false,
  templateUrl: './setup-reporting-group.html',
  styleUrl: './setup-reporting-group.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetupReportingGroup implements OnInit {
  private readonly reportingGroupService = inject(ReportingGroupService);
  private readonly itemService = inject(TenantItemService);
  private readonly formStorageService = inject(FormStorageService);
  private readonly toastr = inject(ToastrService);
  private readonly destroyRef = inject(DestroyRef);

  readonly groups = this.reportingGroupService.groups;
  readonly expandedGroupIds = signal<Set<string>>(new Set());
  readonly expandedCategoryIds = signal<Set<string>>(new Set());

  readonly modalMode = signal<ModalMode>(null);
  readonly modalName = signal('');
  readonly activeGroupId = signal<string | null>(null);
  readonly activeCategoryId = signal<string | null>(null);
  readonly modalSaving = signal(false);

  readonly catalogItems = signal<CatalogItem[]>([]);
  readonly catalogLoading = signal(false);
  readonly catalogSearch = signal('');
  readonly selectedItemIds = signal<Set<string>>(new Set());

  readonly showDeleteConfirm = signal(false);
  readonly deleteConfirmDescription = signal('');
  private pendingDelete: PendingDelete | null = null;

  readonly hasGroups = computed(() => this.groups().length > 0);

  readonly filteredCatalogItems = computed(() => {
    const query = this.catalogSearch().trim().toLowerCase();
    const items = this.catalogItems();
    if (!query) {
      return items;
    }
    return items.filter((item) => item.name.toLowerCase().includes(query));
  });

  readonly modalTitle = computed(() => {
    switch (this.modalMode()) {
      case 'create-group':
        return 'Create Reporting Group';
      case 'edit-group':
        return 'Edit Reporting Group';
      case 'add-category':
        return 'Add Category';
      case 'edit-category':
        return 'Edit Category';
      case 'assign-items':
        return 'Assign Items';
      default:
        return '';
    }
  });

  ngOnInit(): void {
    this.reportingGroupService.reload();
  }

  isGroupExpanded(groupId: string): boolean {
    return this.expandedGroupIds().has(groupId);
  }

  isCategoryExpanded(categoryId: string): boolean {
    return this.expandedCategoryIds().has(categoryId);
  }

  toggleGroup(groupId: string): void {
    const next = new Set(this.expandedGroupIds());
    if (next.has(groupId)) {
      next.delete(groupId);
    } else {
      next.add(groupId);
    }
    this.expandedGroupIds.set(next);
  }

  toggleCategory(categoryId: string): void {
    const next = new Set(this.expandedCategoryIds());
    if (next.has(categoryId)) {
      next.delete(categoryId);
    } else {
      next.add(categoryId);
    }
    this.expandedCategoryIds.set(next);
  }

  openCreateGroup(): void {
    this.activeGroupId.set(null);
    this.activeCategoryId.set(null);
    this.modalName.set('');
    this.modalMode.set('create-group');
  }

  openEditGroup(group: ReportingGroup, event?: Event): void {
    event?.stopPropagation();
    this.activeGroupId.set(group.id);
    this.activeCategoryId.set(null);
    this.modalName.set(group.name);
    this.modalMode.set('edit-group');
  }

  openAddCategory(group: ReportingGroup, event?: Event): void {
    event?.stopPropagation();
    this.activeGroupId.set(group.id);
    this.activeCategoryId.set(null);
    this.modalName.set('');
    this.modalMode.set('add-category');
    this.ensureGroupExpanded(group.id);
  }

  openEditCategory(
    group: ReportingGroup,
    category: ReportingGroupCategory,
    event?: Event
  ): void {
    event?.stopPropagation();
    this.activeGroupId.set(group.id);
    this.activeCategoryId.set(category.id);
    this.modalName.set(category.name);
    this.modalMode.set('edit-category');
  }

  openAssignItems(
    group: ReportingGroup,
    category: ReportingGroupCategory,
    event?: Event
  ): void {
    event?.stopPropagation();
    this.activeGroupId.set(group.id);
    this.activeCategoryId.set(category.id);
    this.modalName.set('');
    this.catalogSearch.set('');
    this.selectedItemIds.set(
      new Set(category.items.map((item) => String(item.id)))
    );
    this.modalMode.set('assign-items');
    this.ensureGroupExpanded(group.id);
    this.ensureCategoryExpanded(category.id);
    this.loadCatalogItems();
  }

  closeModal(): void {
    this.modalMode.set(null);
    this.modalSaving.set(false);
    this.modalName.set('');
    this.activeGroupId.set(null);
    this.activeCategoryId.set(null);
    this.catalogSearch.set('');
    this.selectedItemIds.set(new Set());
  }

  saveModal(): void {
    const mode = this.modalMode();
    if (!mode || mode === 'assign-items') {
      return;
    }

    const name = this.modalName().trim();
    if (!name) {
      this.toastr.error(
        mode.includes('category') ? 'Category name is required.' : 'Group name is required.'
      );
      return;
    }

    this.modalSaving.set(true);

    try {
      if (mode === 'create-group') {
        const group = this.reportingGroupService.createGroup(name);
        this.ensureGroupExpanded(group.id);
        this.toastr.success('Reporting group created');
      } else if (mode === 'edit-group') {
        const groupId = this.activeGroupId();
        if (!groupId) {
          return;
        }
        this.reportingGroupService.updateGroup(groupId, name);
        this.toastr.success('Reporting group updated');
      } else if (mode === 'add-category') {
        const groupId = this.activeGroupId();
        if (!groupId) {
          return;
        }
        const category = this.reportingGroupService.addCategory(groupId, name);
        this.ensureCategoryExpanded(category.id);
        this.toastr.success('Category added');
      } else if (mode === 'edit-category') {
        const groupId = this.activeGroupId();
        const categoryId = this.activeCategoryId();
        if (!groupId || !categoryId) {
          return;
        }
        this.reportingGroupService.updateCategory(groupId, categoryId, name);
        this.toastr.success('Category updated');
      }

      this.closeModal();
    } catch (error) {
      this.toastr.error(
        error instanceof Error ? error.message : 'Unable to save changes'
      );
    } finally {
      this.modalSaving.set(false);
    }
  }

  saveAssignedItems(): void {
    const groupId = this.activeGroupId();
    const categoryId = this.activeCategoryId();
    if (!groupId || !categoryId) {
      return;
    }

    const selected = this.selectedItemIds();
    const items: ReportingGroupAssignedItem[] = this.catalogItems()
      .filter((item) => selected.has(String(item.id)))
      .map((item) => ({ id: item.id, name: item.name }));

    // Keep previously assigned items that may no longer be in the catalog page.
    const existing =
      this.reportingGroupService
        .getGroupById(groupId)
        ?.categories.find((category) => category.id === categoryId)?.items ?? [];

    for (const item of existing) {
      if (selected.has(String(item.id)) && !items.some((entry) => String(entry.id) === String(item.id))) {
        items.push(item);
      }
    }

    try {
      this.reportingGroupService.setCategoryItems(groupId, categoryId, items);
      this.toastr.success('Items assigned successfully');
      this.closeModal();
    } catch (error) {
      this.toastr.error(
        error instanceof Error ? error.message : 'Unable to assign items'
      );
    }
  }

  confirmDeleteGroup(group: ReportingGroup, event?: Event): void {
    event?.stopPropagation();
    this.pendingDelete = {
      type: 'group',
      groupId: group.id,
      label: group.name,
    };
    this.deleteConfirmDescription.set(
      `Delete reporting group "${group.name}"? Categories and item assignments under it will also be removed.`
    );
    this.showDeleteConfirm.set(true);
  }

  confirmDeleteCategory(
    group: ReportingGroup,
    category: ReportingGroupCategory,
    event?: Event
  ): void {
    event?.stopPropagation();
    this.pendingDelete = {
      type: 'category',
      groupId: group.id,
      categoryId: category.id,
      label: category.name,
    };
    this.deleteConfirmDescription.set(
      `Delete category "${category.name}"? Assigned items will be removed from this category.`
    );
    this.showDeleteConfirm.set(true);
  }

  confirmRemoveItem(
    group: ReportingGroup,
    category: ReportingGroupCategory,
    item: ReportingGroupAssignedItem,
    event?: Event
  ): void {
    event?.stopPropagation();
    this.pendingDelete = {
      type: 'item',
      groupId: group.id,
      categoryId: category.id,
      itemId: item.id,
      label: item.name,
    };
    this.deleteConfirmDescription.set(
      `Remove item "${item.name}" from this category?`
    );
    this.showDeleteConfirm.set(true);
  }

  onConfirmDelete(): void {
    const pending = this.pendingDelete;
    this.showDeleteConfirm.set(false);
    this.deleteConfirmDescription.set('');
    this.pendingDelete = null;

    if (!pending) {
      return;
    }

    try {
      if (pending.type === 'group') {
        this.reportingGroupService.deleteGroup(pending.groupId);
        this.toastr.success('Reporting group deleted');
        return;
      }

      if (pending.type === 'category' && pending.categoryId) {
        this.reportingGroupService.deleteCategory(pending.groupId, pending.categoryId);
        this.toastr.success('Category deleted');
        return;
      }

      if (pending.type === 'item' && pending.categoryId && pending.itemId != null) {
        this.reportingGroupService.removeItemFromCategory(
          pending.groupId,
          pending.categoryId,
          pending.itemId
        );
        this.toastr.success('Item removed from category');
      }
    } catch (error) {
      this.toastr.error(
        error instanceof Error ? error.message : 'Unable to delete'
      );
    }
  }

  closeDeleteConfirm(): void {
    this.showDeleteConfirm.set(false);
    this.deleteConfirmDescription.set('');
    this.pendingDelete = null;
  }

  toggleCatalogItem(itemId: number | string): void {
    const next = new Set(this.selectedItemIds());
    const key = String(itemId);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    this.selectedItemIds.set(next);
  }

  isCatalogItemSelected(itemId: number | string): boolean {
    return this.selectedItemIds().has(String(itemId));
  }

  trackByGroupId(_: number, group: ReportingGroup): string {
    return group.id;
  }

  trackByCategoryId(_: number, category: ReportingGroupCategory): string {
    return category.id;
  }

  trackByItemId(_: number, item: ReportingGroupAssignedItem): string {
    return String(item.id);
  }

  private ensureGroupExpanded(groupId: string): void {
    const next = new Set(this.expandedGroupIds());
    next.add(groupId);
    this.expandedGroupIds.set(next);
  }

  private ensureCategoryExpanded(categoryId: string): void {
    const next = new Set(this.expandedCategoryIds());
    next.add(categoryId);
    this.expandedCategoryIds.set(next);
  }

  private loadCatalogItems(): void {
    this.catalogLoading.set(true);

    // The Items listing resolves each field's API key from the Items module's
    // form schema (field.id || field.name). Reuse the same approach instead of
    // hardcoding the item-name key.
    const schema$ = this.formStorageService.loadForm('items').pipe(
      catchError(() => of(null))
    );

    forkJoin({
      items: this.itemService.getItems(1, 500),
      schema: schema$,
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ items, schema }) => {
          const itemNameKey = this.resolveItemNameKey(
            (schema?.fields || []) as DynamicField[]
          );
          const records = this.extractRecords(items);

          this.catalogItems.set(
            records
              .map((record) => this.toCatalogItem(record, itemNameKey))
              .filter((item): item is CatalogItem => !!item)
          );
          this.catalogLoading.set(false);
        },
        error: () => {
          this.catalogItems.set([]);
          this.catalogLoading.set(false);
          this.toastr.error('Failed to load existing items');
        },
      });
  }

  private extractRecords(response: unknown): Record<string, unknown>[] {
    if (Array.isArray(response)) {
      return response as Record<string, unknown>[];
    }

    if (!response || typeof response !== 'object') {
      return [];
    }

    const record = response as Record<string, unknown>;
    for (const key of ['data', 'results', 'items']) {
      const nested = record[key];
      if (Array.isArray(nested)) {
        return nested as Record<string, unknown>[];
      }
    }

    return [];
  }

  /**
   * Finds the Items schema field that represents the Item Name and returns its
   * API key, using the same `field.id || field.name` resolution as the Items
   * listing page. Returns '' when the schema has no matching field.
   */
  private resolveItemNameKey(fields: DynamicField[]): string {
    const labelMatches = (...labels: string[]) =>
      (field: DynamicField) =>
        labels.includes(String(field.label ?? '').trim().toLowerCase());

    const nameField =
      fields.find((field) => field.name === 'name') ||
      fields.find((field) => field.name === 'item_name') ||
      fields.find(labelMatches('name')) ||
      fields.find(labelMatches('item name'));

    if (!nameField) {
      return '';
    }

    return nameField.id || nameField.name || '';
  }

  private toCatalogItem(
    record: Record<string, unknown>,
    itemNameKey: string
  ): CatalogItem | null {
    const id = record['id'] ?? record['_id'];
    if (id == null || id === '') {
      return null;
    }

    const name = this.resolveItemName(record, itemNameKey);

    return {
      id: id as number | string,
      name: typeof name === 'string' && name.trim() ? name.trim() : `Item ${id}`,
    };
  }

  private resolveItemName(
    record: Record<string, unknown>,
    itemNameKey: string
  ): unknown {
    if (itemNameKey) {
      const value = record[itemNameKey];
      if (typeof value === 'string' && value.trim()) {
        return value;
      }
    }

    const nameCandidates = [
      record['name'],
      record['title'],
      record['itemName'],
      record['item_name'],
      record['label'],
    ];

    return nameCandidates.find(
      (value) => typeof value === 'string' && value.trim()
    );
  }
}
