import {
  Component,
  computed,
  DestroyRef,
  EventEmitter,
  HostListener,
  Input,
  OnInit,
  Output,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TenantItemService } from '../../../../../../services/tenant-item.service';
import {
  DataEntrySection,
  FormFieldConfig,
  FormRow,
  createDataEntryRow,
} from '../../models/dynamic-form.models';
import { resolveItemDisplayName } from '../../utils/field-builder-adapter.utils';
import { SectionFieldPreviewComponent } from '../section-field-preview/section-field-preview.component';

@Component({
  selector: 'app-data-entry-section',
  standalone: true,
  imports: [CommonModule, SectionFieldPreviewComponent],
  templateUrl: './data-entry-section.component.html',
  styleUrl: './data-entry-section.component.scss',
})
export class DataEntrySectionComponent implements OnInit {
  private readonly itemService = inject(TenantItemService);
  private readonly destroyRef = inject(DestroyRef);

  @Input({ required: true }) section!: DataEntrySection;
  @Output() addFieldRequested = new EventEmitter<{ sectionId: string; rowId: string }>();
  @Output() sectionChange = new EventEmitter<DataEntrySection>();
  @Output() removeSection = new EventEmitter<string>();

  readonly itemOptions = signal<{ id: string; name: string }[]>([]);

  readonly itemDropdownOpen = signal<string | null>(null);
  readonly itemSearchQuery = signal('');
  readonly dropdownPosition = signal<{ top: number; left: number; width: number } | null>(null);

  readonly filteredItemOptions = computed(() => {
    const q = this.itemSearchQuery().trim().toLowerCase();
    const opts = this.itemOptions();
    return q ? opts.filter((o) => o.name.toLowerCase().includes(q)) : opts;
  });

  readonly selectDropdownOpen = signal<string | null>(null);
  readonly selectSearchQuery = signal('');
  readonly selectDropdownPosition = signal<{ top: number; left: number; width: number } | null>(null);

  readonly filteredSelectOptions = computed(() => {
    const key = this.selectDropdownOpen();
    if (!key) return [];
    const [, fieldId] = key.split(':');
    const q = this.selectSearchQuery().trim().toLowerCase();
    let options: string[] = [];
    for (const row of this.section.rows) {
      const field = row.fields.find((f) => f.id === fieldId);
      if (field?.options?.length) {
        options = field.options.map((opt) =>
          typeof opt === 'string' ? opt : String(opt.label ?? opt.value),
        );
        break;
      }
    }
    return q ? options.filter((o) => o.toLowerCase().includes(q)) : options;
  });

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!(event.target as HTMLElement).closest('.item-select-dropdown')) {
      this.itemDropdownOpen.set(null);
      this.itemSearchQuery.set('');
      this.dropdownPosition.set(null);
    }
    if (!(event.target as HTMLElement).closest('.select-field-dropdown')) {
      this.selectDropdownOpen.set(null);
      this.selectSearchQuery.set('');
      this.selectDropdownPosition.set(null);
    }
  }

  ngOnInit(): void {
    this.loadItems();
  }

  addRow(): void {
    this.sectionChange.emit({
      ...this.section,
      rows: [...this.section.rows, createDataEntryRow()],
    });
  }

  removeRow(rowId: string): void {
    if (this.section.rows.length <= 1) return;
    this.sectionChange.emit({
      ...this.section,
      rows: this.section.rows.filter((r) => r.id !== rowId),
    });
  }

  removeField(row: FormRow, fieldId: string): void {
    const target = row.fields.find((f) => f.id === fieldId);
    if (!target || target.isDefault) return;

    this.sectionChange.emit({
      ...this.section,
      rows: this.section.rows.map((r) =>
        r.id === row.id ? { ...r, fields: r.fields.filter((f) => f.id !== fieldId) } : r,
      ),
    });
  }

  requestAddField(rowId: string): void {
    this.addFieldRequested.emit({ sectionId: this.section.id, rowId });
  }

  onFieldInput(row: FormRow, fieldId: string, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.updateFieldValue(row, fieldId, value);
  }

  onItemSelect(row: FormRow, fieldId: string, value: string | null): void {
    this.updateFieldValue(row, fieldId, value ?? '');
  }

  toggleItemDropdown(rowId: string, fieldId: string, event?: MouseEvent): void {
    const key = this.itemDropdownKey(rowId, fieldId);
    const current = this.itemDropdownOpen();
    if (current === key) {
      this.itemDropdownOpen.set(null);
      this.itemSearchQuery.set('');
      this.dropdownPosition.set(null);
    } else {
      if (event) {
        const btn = (event.target as HTMLElement).closest('.item-select-dropdown');
        if (btn) {
          const rect = btn.getBoundingClientRect();
          this.dropdownPosition.set({
            top: rect.bottom + 4,
            left: rect.left,
            width: rect.width,
          });
        }
      }
      this.itemDropdownOpen.set(key);
      this.itemSearchQuery.set('');
    }
  }

  selectItemOption(row: FormRow, fieldId: string, name: string): void {
    this.onItemSelect(row, fieldId, name);
    this.itemDropdownOpen.set(null);
    this.itemSearchQuery.set('');
  }

  clearItemSelection(row: FormRow, fieldId: string, event: MouseEvent): void {
    event.stopPropagation();
    this.onItemSelect(row, fieldId, null);
  }

  getItemDisplayLabel(field: FormFieldConfig): string {
    return field.value || 'Select item...';
  }

  itemDropdownKey(rowId: string, fieldId: string): string {
    return `${rowId}:${fieldId}`;
  }

  isItemDropdownOpen(rowId: string, fieldId: string): boolean {
    return this.itemDropdownOpen() === this.itemDropdownKey(rowId, fieldId);
  }

  onItemSearch(event: Event): void {
    this.itemSearchQuery.set((event.target as HTMLInputElement).value);
  }

  isSelectField(field: FormFieldConfig): boolean {
    return field.isDefault === true && field.type === 'select' && field.options?.length === 1;
  }

  selectDropdownKey(rowId: string, fieldId: string): string {
    return `${rowId}:${fieldId}`;
  }

  isSelectDropdownOpen(rowId: string, fieldId: string): boolean {
    return this.selectDropdownOpen() === this.selectDropdownKey(rowId, fieldId);
  }

  toggleSelectDropdown(rowId: string, fieldId: string, event?: MouseEvent): void {
    const key = this.selectDropdownKey(rowId, fieldId);
    if (this.selectDropdownOpen() === key) {
      this.selectDropdownOpen.set(null);
      this.selectSearchQuery.set('');
      this.selectDropdownPosition.set(null);
    } else {
      if (event) {
        const btn = (event.target as HTMLElement).closest('.select-field-dropdown');
        if (btn) {
          const rect = btn.getBoundingClientRect();
          this.selectDropdownPosition.set({
            top: rect.bottom + 4,
            left: rect.left,
            width: rect.width,
          });
        }
      }
      this.selectDropdownOpen.set(key);
      this.selectSearchQuery.set('');
    }
  }

  selectSelectOption(row: FormRow, fieldId: string, option: string): void {
    this.updateFieldValue(row, fieldId, option);
    this.selectDropdownOpen.set(null);
    this.selectSearchQuery.set('');
    this.selectDropdownPosition.set(null);
  }

  clearSelectSelection(row: FormRow, fieldId: string, event: MouseEvent): void {
    event.stopPropagation();
    this.updateFieldValue(row, fieldId, '');
  }

  getSelectDisplayLabel(field: FormFieldConfig): string {
    return field.value || (field.placeholder ?? 'Select...');
  }

  onSelectSearch(event: Event): void {
    this.selectSearchQuery.set((event.target as HTMLInputElement).value);
  }

  onCheckboxChange(row: FormRow, fieldId: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.updateFieldValue(row, fieldId, checked ? 'true' : 'false');
  }

  onSelectChange(row: FormRow, fieldId: string, event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.updateFieldValue(row, fieldId, value);
  }

  updateFieldValue(row: FormRow, fieldId: string, value: string): void {
    this.sectionChange.emit({
      ...this.section,
      rows: this.section.rows.map((r) =>
        r.id === row.id
          ? {
              ...r,
              fields: r.fields.map((f) => (f.id === fieldId ? { ...f, value } : f)),
            }
          : r,
      ),
    });
  }

  isItemField(field: FormFieldConfig): boolean {
    return field.isDefault === true && field.name === 'item';
  }

  isIncludeParField(field: FormFieldConfig): boolean {
    return field.isDefault === true && field.name === 'include_par';
  }

  isParQtyField(field: FormFieldConfig): boolean {
    return field.isDefault === true && field.name === 'par_qty';
  }

  visibleFields(row: FormRow): FormFieldConfig[] {
    return row.fields.filter((f) => !this.isParQtyField(f));
  }

  getParQtyField(row: FormRow): FormFieldConfig | undefined {
    return row.fields.find((f) => this.isParQtyField(f));
  }

  getOptionLabel(opt: string | { label: string; value: string | number }): string {
    return typeof opt === 'string' ? opt : String(opt.label ?? opt.value);
  }

  getOptionValue(opt: string | { label: string; value: string | number }): string {
    return typeof opt === 'string' ? opt : String(opt.value ?? opt.label);
  }

  trackField(_: number, field: FormFieldConfig): string {
    return field.id;
  }

  trackRow(_: number, row: FormRow): string {
    return row.id;
  }

  private loadItems(): void {
    this.itemService
      .getItems(1, 9999)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res: any) => {
          const data = res?.data || res;
          if (!Array.isArray(data)) {
            this.itemOptions.set([]);
            return;
          }
          this.itemOptions.set(
            data.map((item: Record<string, unknown>) => ({
              id: String(item['id'] ?? ''),
              name: resolveItemDisplayName(item),
            })),
          );
        },
        error: () => this.itemOptions.set([]),
      });
  }
}
