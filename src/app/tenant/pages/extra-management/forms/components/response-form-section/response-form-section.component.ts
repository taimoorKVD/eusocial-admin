import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormFieldConfig,
  FormRow,
  ResponseFormSection,
} from '../../models/dynamic-form.models';

@Component({
  selector: 'app-response-form-section',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './response-form-section.component.html',
  styleUrl: './response-form-section.component.scss',
})
export class ResponseFormSectionComponent {
  @Input({ required: true }) section!: ResponseFormSection;
  @Output() addFieldRequested = new EventEmitter<{ sectionId: string; rowId: string }>();
  @Output() sectionChange = new EventEmitter<ResponseFormSection>();
  @Output() removeSection = new EventEmitter<string>();

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

  trackField(_: number, field: FormFieldConfig): string {
    return field.id;
  }

  trackRow(_: number, row: FormRow): string {
    return row.id;
  }
}
