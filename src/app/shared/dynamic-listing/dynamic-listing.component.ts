import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { DynamicField } from '../../interfaces/dynamic-field';
import {
  formatListingCellValue,
  getListingBadgeClass,
  getListingImageSrc,
  getOrderedVisibleFieldIds,
  getRecordTrackId,
  resolveInitialVisibleFieldIds,
  saveVisibleColumnIds,
  splitCommaSeparatedValue,
} from './dynamic-listing.helpers';

@Component({
  selector: 'app-dynamic-listing',
  standalone: false,
  templateUrl: './dynamic-listing.component.html',
  styleUrl: './dynamic-listing.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DynamicListingComponent {
  readonly columnDropdownGroup = 'dynamic-listing';
  readonly columnDropdownId = 'column-selector';
  readonly getRecordTrackId = getRecordTrackId;
  readonly getListingBadgeClass = getListingBadgeClass;
  readonly splitCommaSeparatedValue = splitCommaSeparatedValue;

  readonly fields = input.required<DynamicField[]>();
  readonly records = input.required<Record<string, unknown>[]>();
  readonly storageKey = input('');
  readonly defaultVisibleCount = input(4);
  readonly showActions = input(true);
  readonly emptyMessage = input('No records found');

  readonly editRecord = output<Record<string, unknown>>();
  readonly deleteRecord = output<Record<string, unknown>>();
  readonly visibleColumnsChange = output<DynamicField[]>();

  readonly sortedFields = signal<DynamicField[]>([]);
  readonly visibleFieldIds = signal<Set<string>>(new Set());

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

  onColumnToggle(field: DynamicField, checked: boolean): void {
    this.visibleFieldIds.update((current) => {
      const next = new Set(current);

      if (checked) {
        next.add(field.id);
      } else if (next.size > 1) {
        next.delete(field.id);
      }

      return next;
    });

    this.persistColumnPreferences();
    this.emitVisibleColumnsChange();
  }

  getCellValue(record: Record<string, unknown>, field: DynamicField): string {
    return formatListingCellValue(record, field);
  }

  getImageSrc(record: Record<string, unknown>, field: DynamicField): string | null {
    return getListingImageSrc(record, field);
  }

  onEdit(record: Record<string, unknown>): void {
    this.editRecord.emit(record);
  }

  onDelete(record: Record<string, unknown>): void {
    this.deleteRecord.emit(record);
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
