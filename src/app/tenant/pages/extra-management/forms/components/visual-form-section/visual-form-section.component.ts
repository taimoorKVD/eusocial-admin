import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  FormFieldConfig,
  FormRow,
  VisualFormFile,
  VisualFormSection,
  createEmptyRow,
} from '../../models/dynamic-form.models';
import { SectionFieldPreviewComponent } from '../section-field-preview/section-field-preview.component';

@Component({
  selector: 'app-visual-form-section',
  standalone: true,
  imports: [CommonModule, FormsModule, SectionFieldPreviewComponent],
  templateUrl: './visual-form-section.component.html',
  styleUrl: './visual-form-section.component.scss',
})
export class VisualFormSectionComponent {
  readonly maxInstructions = 100;
  readonly maxFileSizeKb = 500;
  readonly acceptedTypes = ['.jpg', '.jpeg', '.png'];

  @Input({ required: true }) section!: VisualFormSection;
  @Output() addFieldRequested = new EventEmitter<{ sectionId: string; rowId: string }>();
  @Output() sectionChange = new EventEmitter<VisualFormSection>();
  @Output() removeSection = new EventEmitter<string>();

  get primaryRow(): FormRow {
    if (!this.section.rows?.length) {
      return createEmptyRow();
    }
    return this.section.rows[0];
  }

  onInstructionsChange(value: string): void {
    const instructions = value.slice(0, this.maxInstructions);
    this.emitConfig({ instructions });
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const selected = Array.from(input.files ?? []);
    if (!selected.length) return;

    const valid: VisualFormFile[] = [];
    for (const file of selected) {
      const ext = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`;
      const sizeKb = file.size / 1024;
      if (!this.acceptedTypes.includes(ext)) continue;
      if (sizeKb > this.maxFileSizeKb) continue;
      valid.push({ name: file.name, size: file.size });
    }

    if (valid.length) {
      this.emitConfig({
        files: [...this.section.configuration.files, ...valid],
      });
    }

    input.value = '';
  }

  removeFile(index: number): void {
    const files = this.section.configuration.files.filter((_, i) => i !== index);
    this.emitConfig({ files });
  }

  requestAddField(): void {
    const row = this.ensurePrimaryRow();
    this.addFieldRequested.emit({ sectionId: this.section.id, rowId: row.id });
  }

  removeField(fieldId: string): void {
    const row = this.primaryRow;
    const target = row.fields.find((f) => f.id === fieldId);
    if (!target || target.isDefault) return;

    this.sectionChange.emit({
      ...this.section,
      rows: this.section.rows.map((r) =>
        r.id === row.id ? { ...r, fields: r.fields.filter((f) => f.id !== fieldId) } : r,
      ),
    });
  }

  onFieldValueChange(fieldId: string, value: string): void {
    const row = this.primaryRow;
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

  trackField(_: number, field: FormFieldConfig): string {
    return field.id;
  }

  private ensurePrimaryRow(): FormRow {
    if (this.section.rows?.length) {
      return this.section.rows[0];
    }
    const row = createEmptyRow();
    this.sectionChange.emit({ ...this.section, rows: [row] });
    return row;
  }

  private emitConfig(partial: Partial<VisualFormSection['configuration']>): void {
    this.sectionChange.emit({
      ...this.section,
      rows: this.section.rows?.length ? this.section.rows : [createEmptyRow()],
      configuration: {
        ...this.section.configuration,
        ...partial,
      },
    });
  }
}
