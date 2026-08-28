import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { DynamicField } from '../../interfaces/dynamic-field';
import { LocationCacheService } from '../../services/location-cache.service';
import {
  formatListingCellValue,
  getDependentLocationFieldIdsToClear,
  getListingBadgeClass,
  getListingFieldLocationKind,
  getListingImageSrc,
  getListingImageSrcs,
  getListingLocationFieldIds,
  getOrderedVisibleFieldIds,
  getRecordTrackId,
  resolveInitialVisibleFieldIds,
  saveVisibleColumnIds,
  splitCommaSeparatedValue,
} from './dynamic-listing.helpers';
import { BulkSelectionState, toNumericIds } from './bulk-selection.state';

@Component({
  selector: 'app-dynamic-listing',
  standalone: false,
  templateUrl: './dynamic-listing.component.html',
  styleUrl: './dynamic-listing.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DynamicListingComponent {
  private readonly locationCache = inject(LocationCacheService);

  readonly getRecordTrackId = getRecordTrackId;
  readonly getListingBadgeClass = getListingBadgeClass;
  readonly splitCommaSeparatedValue = splitCommaSeparatedValue;

  readonly columnModalOpen = signal(false);
  readonly columnModalSearch = signal('');

  readonly filteredModalColumns = computed(() => {
    const query = this.columnModalSearch().trim().toLowerCase();
    const fields = this.sortedFields();

    if (!query) {
      return fields;
    }

    return fields.filter((field) => field.label.toLowerCase().includes(query));
  });

  readonly fields = input.required<DynamicField[]>();
  readonly records = input.required<Record<string, unknown>[]>();
  readonly storageKey = input('');
  readonly defaultVisibleCount = input(4);
  readonly showActions = input(true);
  readonly emptyMessage = input('No records found');
  readonly selectable = input(false);
  readonly bulkSelection = input<BulkSelectionState | undefined>(undefined);

  readonly editRecord = output<Record<string, unknown>>();
  readonly deleteRecord = output<Record<string, unknown>>();
  readonly visibleColumnsChange = output<DynamicField[]>();

  readonly sortedFields = signal<DynamicField[]>([]);
  readonly visibleFieldIds = signal<Set<string>>(new Set());

  readonly selectedIds = computed(() => this.bulkSelection()?.selectedIds() ?? []);

  readonly selectableRecordIds = computed(() =>
    toNumericIds(this.records().map((record) => record['id'])),
  );

  readonly hasSelectableRecords = computed(() => this.selectableRecordIds().length > 0);

  readonly isAllSelected = computed(() => {
    const state = this.bulkSelection();
    return !!state && state.isAllSelected(this.selectableRecordIds());
  });

  readonly isIndeterminate = computed(() => {
    const state = this.bulkSelection();
    return !!state && state.isIndeterminate(this.selectableRecordIds());
  });

  readonly locationFieldIds = computed(() =>
    getListingLocationFieldIds(this.sortedFields()),
  );

  readonly hasCountryColumnVisible = computed(() => {
    const countryId = this.locationFieldIds().countryId;
    return !!countryId && this.visibleFieldIds().has(countryId);
  });

  readonly hasStateColumnVisible = computed(() => {
    const stateId = this.locationFieldIds().stateId;
    return !!stateId && this.visibleFieldIds().has(stateId);
  });

  readonly visibleColumns = computed(() => {
    const visibleIds = this.visibleFieldIds();
    return this.sortedFields().filter((field) => visibleIds.has(field.id));
  });

  readonly hasRecords = computed(() => this.records().length > 0);

  constructor() {
    effect(() => {
      this.initializeColumns(this.fields());
    });
  }

  isColumnVisible(fieldId: string): boolean {
    return this.visibleFieldIds().has(fieldId);
  }

  isColumnDisabled(field: DynamicField): boolean {
    const kind = getListingFieldLocationKind(field);

    if (kind === 'states') {
      return !this.hasCountryColumnVisible();
    }

    if (kind === 'cities') {
      return !this.hasStateColumnVisible();
    }

    return false;
  }

  openColumnModal(): void {
    this.columnModalOpen.set(true);
  }

  closeColumnModal(): void {
    this.columnModalOpen.set(false);
    this.columnModalSearch.set('');
  }

  onColumnModalSearch(event: Event): void {
    this.columnModalSearch.set((event.target as HTMLInputElement).value);
  }

  onColumnToggle(field: DynamicField, checked: boolean): void {
    if (checked && this.isColumnDisabled(field)) {
      return;
    }

    this.visibleFieldIds.update((current) => {
      const next = new Set(current);
      const locationIds = this.locationFieldIds();

      if (checked) {
        next.add(field.id);
        return next;
      }

      const idsToRemove = new Set<string>([field.id]);
      for (const dependentId of getDependentLocationFieldIdsToClear(
        field,
        locationIds,
      )) {
        idsToRemove.add(dependentId);
      }

      let remainingCount = 0;
      for (const id of next) {
        if (!idsToRemove.has(id)) {
          remainingCount += 1;
        }
      }

      if (remainingCount === 0) {
        return current;
      }

      for (const id of idsToRemove) {
        next.delete(id);
      }

      return next;
    });

    this.persistColumnPreferences();
    this.emitVisibleColumnsChange();
  }

  getCellValue(record: Record<string, unknown>, field: DynamicField): string {
    return formatListingCellValue(record, field, this.locationCache.countries());
  }

  getImageSrc(record: Record<string, unknown>, field: DynamicField): string | null {
    return getListingImageSrc(record, field);
  }

  getImageSrcs(record: Record<string, unknown>, field: DynamicField): string[] {
    return getListingImageSrcs(record, field);
  }

  onEdit(record: Record<string, unknown>): void {
    this.editRecord.emit(record);
  }

  onDelete(record: Record<string, unknown>): void {
    this.deleteRecord.emit(record);
  }

  isSelectableRecord(record: Record<string, unknown>): boolean {
    const id = record['id'];
    return id != null && id !== '' && !Number.isNaN(Number(id));
  }

  isRecordSelected(record: Record<string, unknown>): boolean {
    if (!this.isSelectableRecord(record)) {
      return false;
    }
    return this.selectedIds().includes(Number(record['id']));
  }

  onToggleRecordSelection(record: Record<string, unknown>): void {
    const state = this.bulkSelection();
    if (!state || !this.isSelectableRecord(record)) {
      return;
    }
    state.toggle(Number(record['id']));
  }

  onToggleSelectAll(): void {
    const state = this.bulkSelection();
    if (!state) {
      return;
    }
    state.toggleAll(this.selectableRecordIds());
  }

  private initializeColumns(fields: DynamicField[]): void {
    const { sortedFields, visibleFieldIds, persistDefaults } = resolveInitialVisibleFieldIds(
      fields,
      this.storageKey(),
      this.defaultVisibleCount(),
    );

    this.sortedFields.set(sortedFields);
    this.visibleFieldIds.set(new Set(visibleFieldIds));

    if (persistDefaults) {
      this.persistColumnPreferences();
    }

    this.emitVisibleColumnsChange();
  }

  private emitVisibleColumnsChange(): void {
    queueMicrotask(() => {
      this.visibleColumnsChange.emit(this.visibleColumns());
    });
  }

  private persistColumnPreferences(): void {
    saveVisibleColumnIds(
      this.storageKey(),
      getOrderedVisibleFieldIds(this.sortedFields(), this.visibleFieldIds()),
    );
  }
}
