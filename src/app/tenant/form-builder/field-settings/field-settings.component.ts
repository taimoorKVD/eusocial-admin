import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormField } from '../models/form-field.model';

@Component({
  selector: 'app-field-settings',
  standalone: false,
  templateUrl: './field-settings.component.html',
  styleUrl: './field-settings.component.scss',
})
export class FieldSettingsComponent {
  @Input() field!: FormField;
  @Output() update = new EventEmitter<FormField>();

  onChange() {
    this.update.emit({
      ...this.field,
      options: [...this.field.options]
    });
  }

  updateOptions(event: Event) {
  const value = (event.target as HTMLTextAreaElement).value;

  this.field.options = value
    .split('\n')
    .map(v => v.trim())
    .filter(v => v);

  this.onChange();
}

  get optionsText(): string {
    return this.field.options.join('\n');
  }
}
