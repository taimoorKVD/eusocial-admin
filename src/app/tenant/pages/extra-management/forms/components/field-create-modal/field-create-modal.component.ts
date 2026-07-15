import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FormBuilderModule } from '../../../../../form-builder/form-builder-module';
import { FormField } from '../../../../../form-builder/models/form-field.model';
import { FormFieldConfig } from '../../models/dynamic-form.models';
import {
  FIELD_BUILDER_TYPE_OPTIONS,
  createDraftBuilderField,
  mapBuilderFieldToConfig,
} from '../../utils/field-builder-adapter.utils';

@Component({
  selector: 'app-field-create-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, FormBuilderModule],
  templateUrl: './field-create-modal.component.html',
  styleUrl: './field-create-modal.component.scss',
})
export class FieldCreateModalComponent implements OnChanges {
  @Input() isOpen = false;
  @Output() saved = new EventEmitter<FormFieldConfig>();
  @Output() closed = new EventEmitter<void>();

  readonly typeOptions = FIELD_BUILDER_TYPE_OPTIONS;
  readonly draftField = signal<FormField>(createDraftBuilderField('text'));
  readonly schema = signal<FormField[]>([this.draftField()]);
  readonly selectedType = signal<FormField['type']>('text');

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']?.currentValue === true) {
      this.resetDraft('text');
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }

  close(): void {
    this.closed.emit();
  }

  onTypeChange(type: FormField['type']): void {
    this.resetDraft(type);
  }

  onFieldUpdate(field: FormField): void {
    // FieldSettings mutates the draft in place; avoid rebinding and resetting the panel.
    if (this.draftField()?.id === field.id) {
      return;
    }
    this.draftField.set(field);
    this.schema.set([field]);
  }

  submit(): void {
    const field = this.draftField();
    if (!field.label?.trim()) {
      return;
    }
    this.saved.emit(mapBuilderFieldToConfig(field));
  }

  private resetDraft(type: FormField['type']): void {
    this.selectedType.set(type);
    const draft = createDraftBuilderField(type);
    this.draftField.set(draft);
    this.schema.set([draft]);
  }
}
