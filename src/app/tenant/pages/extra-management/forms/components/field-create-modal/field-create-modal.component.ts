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
  /** Latest FieldSettings emit — FieldSettings clones the field, so draft must not be the only source. */
  private readonly latestField = signal<FormField | null>(null);
  readonly selectedType = signal<string>('text');
  readonly isTypeDropdownOpen = signal(false);
  readonly isClosing = signal(false);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']?.currentValue === true) {
      this.isClosing.set(false);
      this.resetDraft('text');
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeWithAnimation();
    }
  }

  close(): void {
    this.closed.emit();
  }

  closeWithAnimation(): void {
    this.isClosing.set(true);
    setTimeout(() => {
      this.isTypeDropdownOpen.set(false);
      this.isClosing.set(false);
      this.close();
    }, 240);
  }

  getTypeLabel(): string {
    const match = this.typeOptions.find((o) => o.value === this.selectedType());
    return match?.label ?? 'Select type';
  }

  onTypeSelect(type: string): void {
    this.isTypeDropdownOpen.set(false);
    this.onTypeChange(type);
  }

  onTypeChange(type: string): void {
    this.resetDraft(type);
  }

  onFieldUpdate(field: FormField): void {
    // Capture emitted clone for submit; avoid rebinding [field] (would re-init settings).
    this.latestField.set(field);
  }

  submit(): void {
    const field = this.latestField() ?? this.draftField();
    if (!field.label?.trim()) {
      return;
    }
    this.saved.emit(mapBuilderFieldToConfig(field, this.selectedType()));
  }

  private resetDraft(type: string): void {
    this.selectedType.set(type);
    this.latestField.set(null);
    const draft = createDraftBuilderField(type);
    this.draftField.set(draft);
    this.schema.set([draft]);
  }
}
