import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormField } from '../models/form-field.model';

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
        name: value.name || this.toFieldName(value.label),
        defaultValue: value.defaultValue ?? value.value ?? '',
        width: value.width ?? 12,
        validations: value.validations || {},
        condition: value.condition || { fieldId: '', value: '' },
        options: value.options || []
      };
      this.validationsJson = JSON.stringify(this._field.validations, null, 2);
    }
  }

  get field(): FormField | undefined {
    return this._field;
  }

  private _field: FormField | any;
  validationsJson = '{}';

  @Output() update = new EventEmitter<FormField>();

  onChange() {
    if (this._field) {
      this.update.emit({
        ...this._field,
        options: [...(this._field.options || [])]
      });
    }
  }

  updateOptions(event: Event) {
    if (!this._field) return;

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

  updateValidations(event: Event) {
    const value = (event.target as HTMLTextAreaElement).value;
    this.validationsJson = value;

    try {
      this._field.validations = value ? JSON.parse(value) : {};
      this.onChange();
    } catch {
      // ignore invalid json while typing
    }
  }

  private toFieldName(label: string | null | undefined): string {
    const normalizedLabel = String(label ?? 'field');
    const fieldName = normalizedLabel
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

    return fieldName || 'field';
  }
}
