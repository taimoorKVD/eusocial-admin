import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormFieldConfig } from '../../models/dynamic-form.models';

/**
 * Editable FormFieldConfig control — matches section input styling.
 */
@Component({
  selector: 'app-section-field-preview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './section-field-preview.component.html',
  styleUrl: './section-field-preview.component.scss',
})
export class SectionFieldPreviewComponent {
  @Input({ required: true }) field!: FormFieldConfig;
  @Output() valueChange = new EventEmitter<string>();

  get selectPlaceholder(): string {
    return this.field.placeholder || `Select ${this.field.label || ''}`.trim() || 'Select';
  }

  onInput(event: Event): void {
    this.valueChange.emit((event.target as HTMLInputElement | HTMLTextAreaElement).value);
  }

  onSelect(event: Event): void {
    this.valueChange.emit((event.target as HTMLSelectElement).value);
  }

  onCheckboxToggle(checked: boolean): void {
    this.valueChange.emit(checked ? 'true' : 'false');
  }

  onOptionCheckboxToggle(option: string, checked: boolean): void {
    const selected = this.selectedOptions();
    const next = checked
      ? [...selected, option]
      : selected.filter((item) => item !== option);
    this.valueChange.emit(next.join(','));
  }

  onRadioSelect(option: string): void {
    this.valueChange.emit(option);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    this.valueChange.emit(file?.name ?? '');
  }

  isOptionChecked(option: string): boolean {
    return this.selectedOptions().includes(option);
  }

  private selectedOptions(): string[] {
    const raw = this.field.value ?? '';
    if (!raw.trim()) return [];
    return raw.split(',').map((part) => part.trim()).filter(Boolean);
  }
}
