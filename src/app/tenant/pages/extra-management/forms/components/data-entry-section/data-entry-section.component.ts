import {
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgSelectModule } from '@ng-select/ng-select';
import { FormsModule } from '@angular/forms';
import { TenantItemService } from '../../../../../../services/tenant-item.service';
import {
  DataEntrySection,
  FormFieldConfig,
  FormRow,
  createDataEntryRow,
} from '../../models/dynamic-form.models';
import { resolveItemDisplayName } from '../../utils/field-builder-adapter.utils';

@Component({
  selector: 'app-data-entry-section',
  standalone: true,
  imports: [CommonModule, FormsModule, NgSelectModule],
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
