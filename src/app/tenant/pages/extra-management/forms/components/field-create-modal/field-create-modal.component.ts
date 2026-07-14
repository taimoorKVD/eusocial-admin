import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  FIELD_TYPE_OPTIONS,
  FormFieldConfig,
  WIDTH_OPTIONS,
  createId,
} from '../../models/dynamic-form.models';

@Component({
  selector: 'app-field-create-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './field-create-modal.component.html',
  styleUrl: './field-create-modal.component.scss',
})
export class FieldCreateModalComponent implements OnChanges {
  private readonly fb = inject(FormBuilder);

  @Input() isOpen = false;
  @Output() saved = new EventEmitter<FormFieldConfig>();
  @Output() closed = new EventEmitter<void>();

  readonly fieldTypeOptions = FIELD_TYPE_OPTIONS;
  readonly widthOptions = WIDTH_OPTIONS;

  readonly form = this.fb.nonNullable.group({
    type: ['text' as FormFieldConfig['type'], Validators.required],
    label: ['', Validators.required],
    name: ['', [Validators.required, Validators.pattern(/^[a-zA-Z][a-zA-Z0-9_]*$/)]],
    placeholder: [''],
    required: [false],
    readonly: [false],
    width: ['auto'],
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']?.currentValue === true) {
      this.form.reset({
        type: 'text',
        label: '',
        name: '',
        placeholder: '',
        required: false,
        readonly: false,
        width: 'auto',
      });
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

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const field: FormFieldConfig = {
      id: createId('field'),
      type: value.type,
      label: value.label.trim(),
      name: value.name.trim(),
      placeholder: value.placeholder.trim() || undefined,
      required: value.required,
      readonly: value.readonly || undefined,
      width: value.width !== 'auto' ? value.width : undefined,
    };

    this.saved.emit(field);
  }
}
