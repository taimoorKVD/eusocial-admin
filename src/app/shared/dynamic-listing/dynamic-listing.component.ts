import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { DynamicField } from '../../interfaces/dynamic-field';
import {
  formatListingCellValue,
  getDefaultVisibleFieldIds,
  getListingImageSrc,
  loadVisibleColumnIds,
  saveVisibleColumnIds,
  sortListingFields,
} from './dynamic-listing.helpers';

@Component({
  selector: 'app-dynamic-listing',
  standalone: false,
  templateUrl: './dynamic-listing.component.html',
  styleUrl: './dynamic-listing.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DynamicListingComponent implements OnChanges {
  readonly columnDropdownGroup = 'dynamic-listing';
  readonly columnDropdownId = 'column-selector';

  @Input({ required: true }) fields: DynamicField[] = [];
  @Input({ required: true }) records: Record<string, unknown>[] = [];
  @Input() storageKey = '';
  @Input() defaultVisibleCount = 4;
  @Input() showActions = true;
  @Input() emptyMessage = 'No records found';

  @Output() editRecord = new EventEmitter<Record<string, unknown>>();
  @Output() deleteRecord = new EventEmitter<Record<string, unknown>>();
  @Output() visibleColumnsChange = new EventEmitter<DynamicField[]>();

  sortedFields: DynamicField[] = [];
  visibleFieldIds = new Set<string>();

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['fields']) {
      this.initializeColumns();
    }
  }

  get visibleColumns(): DynamicField[] {
    return this.sortedFields.filter((field) => this.visibleFieldIds.has(field.id));
  }

  get hasRecords(): boolean {
    return this.records.length > 0;
  }

  isColumnVisible(fieldId: string): boolean {
    return this.visibleFieldIds.has(fieldId);
  }

  onColumnToggle(field: DynamicField, checked: boolean): void {
    if (checked) {
      this.visibleFieldIds.add(field.id);
    } else if (this.visibleFieldIds.size > 1) {
      this.visibleFieldIds.delete(field.id);
    }

    this.persistColumnPreferences();
    this.emitVisibleColumnsChange();
    this.cdr.markForCheck();
  }

  getCellValue(record: Record<string, unknown>, field: DynamicField): string {
    return formatListingCellValue(record, field);
  }

  getImageSrc(record: Record<string, unknown>, field: DynamicField): string | null {
    return getListingImageSrc(record, field);
  }

  trackByFieldId(_index: number, field: DynamicField): string {
    return field.id;
  }

  trackByRecordId(index: number, record: Record<string, unknown>): string | number {
    const id = record['id'];
    return typeof id === 'string' || typeof id === 'number' ? id : index;
  }

  onEdit(record: Record<string, unknown>): void {
    this.editRecord.emit(record);
  }

  onDelete(record: Record<string, unknown>): void {
    this.deleteRecord.emit(record);
  }

  private initializeColumns(): void {
    this.sortedFields = sortListingFields(this.fields || []);

    const savedIds = loadVisibleColumnIds(this.storageKey);
    const validSavedIds = savedIds?.filter((id) =>
      this.sortedFields.some((field) => field.id === id),
    );

    if (validSavedIds?.length) {
      this.visibleFieldIds = new Set(validSavedIds);
    } else {
      this.visibleFieldIds = new Set(
        getDefaultVisibleFieldIds(this.sortedFields, this.defaultVisibleCount),
      );
      this.persistColumnPreferences();
    }

    this.emitVisibleColumnsChange();
    this.cdr.markForCheck();
  }

  private emitVisibleColumnsChange(): void {
    queueMicrotask(() => {
      this.visibleColumnsChange.emit(this.visibleColumns);
    });
  }

  private persistColumnPreferences(): void {
    const orderedVisibleIds = this.sortedFields
      .filter((field) => this.visibleFieldIds.has(field.id))
      .map((field) => field.id);

    saveVisibleColumnIds(this.storageKey, orderedVisibleIds);
  }

  getFieldClass(field: any): string {
     switch (field.type) {
    case 'checkbox':
      return 'border border-[#ea580c] hover:bg-orange-100';

    case 'radio':
      return 'border border-[#ea580c] hover:bg-orange-100';

    default:
      return 'bg-gray-50 text-gray-700 border border-gray-200';
  }
  }

  splitValue(value: any): string[] {
    if (!value) return [];

    return value
      .toString()
      .split(',')
      .map((item: string) => item.trim())
      .filter((item: string) => item.length);
  }
}
