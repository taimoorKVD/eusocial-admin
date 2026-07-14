import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  DataEntrySection,
  FormFieldConfig,
  FormRow,
  createEmptyRow,
} from '../../models/dynamic-form.models';

@Component({
  selector: 'app-data-entry-section',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './data-entry-section.component.html',
  styleUrl: './data-entry-section.component.scss',
})
export class DataEntrySectionComponent {
  @Input({ required: true }) section!: DataEntrySection;
  @Output() addFieldRequested = new EventEmitter<{ sectionId: string; rowId: string }>();
  @Output() sectionChange = new EventEmitter<DataEntrySection>();
  @Output() removeSection = new EventEmitter<string>();

  addRow(): void {
    const updated: DataEntrySection = {
      ...this.section,
      rows: [...this.section.rows, createEmptyRow()],
    };
    this.sectionChange.emit(updated);
  }

  removeField(row: FormRow, fieldId: string): void {
    const updated: DataEntrySection = {
      ...this.section,
      rows: this.section.rows.map((r) =>
        r.id === row.id
          ? { ...r, fields: r.fields.filter((f) => f.id !== fieldId) }
          : r,
      ),
    };
    this.sectionChange.emit(updated);
  }

  requestAddField(rowId: string): void {
    this.addFieldRequested.emit({ sectionId: this.section.id, rowId });
  }

  trackField(_index: number, field: FormFieldConfig): string {
    return field.id;
  }

  trackRow(_index: number, row: FormRow): string {
    return row.id;
  }
}
