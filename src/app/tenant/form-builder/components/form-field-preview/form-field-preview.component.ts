import {
  Component,
  DestroyRef,
  Input,
  OnChanges,
  SimpleChanges,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  FieldOption,
  FormField,
  OptionSource,
} from '../../models/form-field.model';
import { FieldOptionsService } from '../../services/field-options.service';
import {
  isOptionFieldType,
  normalizeFieldTypeName,
} from '../../utils/field-type.utils';
import {
  normalizeFieldOptions,
  normalizeCheckboxFieldOptions,
} from '../../utils/field-options.utils';
import { resolveFieldOptionSource } from '../../utils/option-source.utils';

@Component({
  selector: 'app-form-field-preview',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './form-field-preview.component.html',
  host: {
    class: 'block pointer-events-none select-none',
  },
})
export class FormFieldPreviewComponent implements OnChanges {
  @Input({ required: true }) field!: FormField;

  displayOptions: FieldOption[] = [];
  loadingOptions = false;
  optionsError = false;

  fieldType: FormField['type'] = 'text';
  isSelectField = false;
  isRadioField = false;
  isCheckboxField = false;
  isReadonly = false;

  get previewValue(): unknown {
    return this.field?.defaultValue ?? this.field?.value ?? '';
  }

  private readonly destroyRef = inject(DestroyRef);
  private optionsRequestId = 0;

  constructor(private fieldOptionsService: FieldOptionsService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['field']) {
      this.syncFieldTypeFlags();
      this.loadOptions();
    }
  }

  trackByOptionValue(_index: number, option: FieldOption): string | number {
    return option.value;
  }

  isCheckboxChecked(value: string | number): boolean {
    const selected = this.field.value;

    if (!Array.isArray(selected)) {
      return false;
    }

    return selected.some((item: unknown) => item === value);
  }

  private syncFieldTypeFlags(): void {
    this.fieldType = normalizeFieldTypeName(
      this.field.fieldTypeName,
      this.field.type
    );
    this.isSelectField = this.fieldType === 'select';
    this.isRadioField = this.fieldType === 'radio';
    this.isCheckboxField = this.fieldType === 'checkbox';
    this.isReadonly = this.field.isReadonly === true;
  }

  private loadOptions(): void {
    if (!isOptionFieldType(this.fieldType)) {
      this.displayOptions = [];
      this.loadingOptions = false;
      this.optionsError = false;
      return;
    }

    const optionSource: OptionSource | undefined = resolveFieldOptionSource(
      this.field
    );

    if (!optionSource) {
      this.setDisplayOptionsFromStatic();
      this.loadingOptions = false;
      this.optionsError = false;
      return;
    }

    const requestId = ++this.optionsRequestId;

    this.loadingOptions = true;
    this.optionsError = false;

    this.fieldOptionsService
      .getOptions(optionSource)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: options => {
          if (requestId !== this.optionsRequestId) {
            return;
          }

          const resolved =
            options.length > 0
              ? this.normalizeStaticOptions(options)
              : this.normalizeStaticOptions(this.field.options);

          this.displayOptions = resolved;
          this.loadingOptions = false;
          this.optionsError = resolved.length === 0;
        },
        error: () => {
          if (requestId !== this.optionsRequestId) {
            return;
          }

          this.displayOptions = [];
          this.loadingOptions = false;
          this.optionsError = true;
        },
      });
  }

  private setDisplayOptionsFromStatic(): void {
    this.displayOptions = this.normalizeStaticOptions(this.field.options);
  }

  private normalizeStaticOptions(options: Array<string | FieldOption> | undefined): FieldOption[] {
    return this.isCheckboxField
      ? normalizeCheckboxFieldOptions(options)
      : normalizeFieldOptions(options);
  }
}
