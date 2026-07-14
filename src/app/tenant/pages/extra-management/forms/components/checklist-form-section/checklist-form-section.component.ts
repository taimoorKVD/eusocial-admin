import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ChecklistFormSection,
  FormFieldConfig,
  FormRow,
} from '../../models/dynamic-form.models';

@Component({
  selector: 'app-checklist-form-section',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './checklist-form-section.component.html',
  styleUrl: './checklist-form-section.component.scss',
})
export class ChecklistFormSectionComponent {
  @Input({ required: true }) section!: ChecklistFormSection;
  @Output() addFieldRequested = new EventEmitter<{ sectionId: string; rowId: string }>();
  @Output() sectionChange = new EventEmitter<ChecklistFormSection>();
  @Output() removeSection = new EventEmitter<string>();

  removeField(row: FormRow, fieldId: string): void {
    const updated: ChecklistFormSection = {
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
