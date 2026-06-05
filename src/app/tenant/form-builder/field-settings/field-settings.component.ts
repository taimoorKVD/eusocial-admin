import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormField } from '../models/form-field.model';
import { toFieldName } from '../utils/form-field.factory';

@Component({
  selector: 'app-field-settings',
  standalone: false,
  templateUrl: './field-settings.component.html',
  styleUrl: './field-settings.component.scss',
})
export class FieldSettingsComponent {
  @Input() set field(value: FormField | undefined) {
    if (value) {
      this._field = {
        ...value,
        name: value.name || toFieldName(value.label),
        defaultValue: value.defaultValue ?? value.value ?? '',
        width: value.width ?? 12,
        validations: value.validations || {},
        condition: value.condition || { fieldId: '', value: '' },
        options: [...(value.options || [])],
        optionSource: value.optionSource ? { ...value.optionSource } : undefined,
      };
    }
  }

  get field(): FormField | undefined {
    return this._field;
  }

  private _field!: FormField;

  @Output() update = new EventEmitter<FormField>();
  @Output() duplicate = new EventEmitter<void>();
  @Output() delete = new EventEmitter<void>();

  onChange(): void {
    if (!this._field) {
      return;
    }

    this.update.emit({
      ...this._field,
      options: [...(this._field.options || [])],
      optionSource: this._field.optionSource
        ? { ...this._field.optionSource }
        : undefined,
      condition: this._field.condition
        ? { ...this._field.condition }
        : { fieldId: '', value: '' },
    });
  }

  updateOptions(event: Event): void {
    if (!this._field) {
      return;
    }

    const value = (event.target as HTMLTextAreaElement).value;

    this._field.options = value
      .split('\n')
      .map(v => v.trim())
      .filter(v => v);

    this.onChange();
  }

  get optionsText(): string {
    return this._field?.options?.join('\n') || '';
  }

  onDuplicateClick(): void {
    this.duplicate.emit();
  }

  onDeleteClick(): void {
    if (!confirm('Remove this field from the form?')) {
      return;
    }

    this.delete.emit();
  }
}
