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
        condition: value.condition || { fieldId: '', value: '' },
        options: value.options || []
      };
    }
  }

  get field(): FormField | undefined {
    return this._field;
  }

  private _field: FormField | any;

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
}
