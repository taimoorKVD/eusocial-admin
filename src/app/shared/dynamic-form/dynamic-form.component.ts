import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
} from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subscription, merge } from 'rxjs';
import {
  DynamicField,
  DynamicFieldOption,
  DynamicFormValue,
} from '../../interfaces/dynamic-field';
import {
  getDynamicFieldErrorMessage,
  shouldShowDynamicFieldError,
} from './dynamic-form.validation';
import { FormArray, FormControl } from '@angular/forms';
@Component({
  selector: 'app-dynamic-form',
  standalone: false,
  templateUrl: './dynamic-form.component.html',
  styleUrl: './dynamic-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DynamicFormComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) fields: DynamicField[] = [];
  @Output() valueChange = new EventEmitter<DynamicFormValue>();

  form!: FormGroup;
  sortedFields: DynamicField[] = [];
  imagePreviews: Record<string, string> = {};

  private formChangesSub?: Subscription;

  constructor(
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['fields']) {
      console.log('Fields changed:', this.fields);
      this.buildForm();
    }
  }

  ngOnDestroy(): void {
    this.formChangesSub?.unsubscribe();
  }

  // ─── Public API for parent ───────────────────────────────────────────────────

  get value(): DynamicFormValue {
    return this.form?.getRawValue() ?? {};
  }

  get invalid(): boolean {
    return this.form?.invalid ?? true;
  }

  getControl(name: string): AbstractControl | null {
    return this.form?.get(name) ?? null;
  }

  validate(): boolean {
    this.markAllAsTouched();
    return this.form?.valid ?? false;
  }

  markAllAsTouched(): void {
    this.form?.markAllAsTouched();
    this.cdr.markForCheck();
  }

  patchValue(values: DynamicFormValue): void {
    if (!this.form || !values) return;
    this.form.patchValue(values);
    this.valueChange.emit(
  this.normalizeCheckboxValues(this.form.getRawValue())
);
    this.cdr.markForCheck();
  }

  resetToDefaults(): void {
    if (!this.form) return;
    for (const field of this.sortedFields) {
      this.form.get(field.name)?.setValue(this.getInitialValue(field));
    }
    this.imagePreviews = {};
    this.valueChange.emit(
  this.normalizeCheckboxValues(this.form.getRawValue())
);
    this.cdr.markForCheck();
  }

  // ─── Template helpers ─────────────────────────────────────────────────────────

  trackByField(_index: number, field: DynamicField): string {
    return field.id;
  }

  trackByOption(index: number, option: string | DynamicFieldOption): string | number {
    return typeof option === 'string'
      ? option
      : (option.value ?? index);
  }

  getColClass(field: DynamicField): string {
    const width = field.width ?? 6;
    return `col-md-${width}`;
  }

  getErrorMessage(field: DynamicField): string | null {
    const control = this.getControl(field.name);
    return getDynamicFieldErrorMessage(field, control, shouldShowDynamicFieldError(control));
  }

  getOptionLabel(option: string | DynamicFieldOption): string {
    return typeof option === 'string' ? option : option.label;
  }

  getOptionValue(option: string | DynamicFieldOption, index = 0): string | number {
    return typeof option === 'string' ? option : (option.value ?? index);
  }

  onImageSelected(event: Event, fieldName: string): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      return;
    }

    this.form.get(fieldName)?.setValue(file);
    this.form.get(fieldName)?.markAsDirty();
    this.form.get(fieldName)?.markAsTouched();

    const reader = new FileReader();
    reader.onload = () => {
      this.imagePreviews[fieldName] = reader.result as string;
      this.valueChange.emit(
  this.normalizeCheckboxValues(this.form.getRawValue())
);
      this.cdr.markForCheck();
    };
    reader.readAsDataURL(file);
  }

  removeImage(fieldName: string, input: HTMLInputElement): void {
    delete this.imagePreviews[fieldName];
    this.form.get(fieldName)?.setValue(null);
    this.form.get(fieldName)?.markAsTouched();
    input.value = '';
    this.valueChange.emit(
  this.normalizeCheckboxValues(this.form.getRawValue())
);
    this.cdr.markForCheck();
  }

  private buildForm(): void {
    this.formChangesSub?.unsubscribe();

    if (!this.fields?.length) {
      this.form = this.fb.group({});
      this.sortedFields = [];
      this.imagePreviews = {};
      this.cdr.markForCheck();
      return;
    }

    this.sortedFields = [...this.fields]
      .map((field, index) => ({ field, index }))
      .sort((a, b) =>
        (a.field.order ?? a.index) - (b.field.order ?? b.index) || a.index - b.index,
      )
      .map(({ field }) => field);

    const groupConfig: Record<string, unknown> = {};
    // for (const field of this.sortedFields) {
    //   groupConfig[field.name] = [this.getInitialValue(field), this.getValidators(field)];
    // }
    for (const field of this.sortedFields) {
      if (field.type === 'checkbox') {
        const isSingle = (field.options?.length ?? 0) <= 1;

        if (isSingle) {
          groupConfig[field.name] = [
            !!field.defaultValue || !!field.value,
            this.getValidators(field),
          ];
        } else {
          const selectedValues = Array.isArray(field.value) ? field.value : [];

          const formArray = this.fb.array(
            field.options.map(opt => {
              const value = this.getOptionValue(opt);
              return new FormControl(selectedValues.includes(value));
            })
          );

          groupConfig[field.name] = formArray;
        }

        continue;
      }

      groupConfig[field.name] = [
        this.getInitialValue(field),
        this.getValidators(field),
      ];
    }
    this.form = this.fb.group(groupConfig);
    this.imagePreviews = {};
    this.subscribeToFormChanges();
    this.valueChange.emit(
  this.normalizeCheckboxValues(this.form.getRawValue())
);
    this.cdr.markForCheck();
  }

  private getInitialValue(field: DynamicField): unknown {
    switch (field.type) {
      case 'radio': {
        if (field.defaultValue !== undefined && field.defaultValue !== null && field.defaultValue !== '') {
          return field.defaultValue;
        }

        if (field.value !== undefined && field.value !== null && field.value !== '') {
          return field.value;
        }

        const firstOption = field.options?.[0];
        return firstOption !== undefined ? this.getOptionValue(firstOption, 0) : '';
      }
      case 'checkbox':
        return false;
      case 'number':
        return field.defaultValue ?? field.value ?? null;
      case 'image':
        return field.defaultValue ?? field.value ?? null;
      default:
        return field.defaultValue ?? field.value ?? '';
    }
  }

  private getValidators(field: DynamicField) {
    const validators = [];
    if (field.required) validators.push(Validators.required);
    if (field.type === 'email') validators.push(Validators.email);
    return validators;
  }

  private subscribeToFormChanges(): void {
    this.formChangesSub = merge(this.form.valueChanges, this.form.statusChanges).subscribe(() => {
      this.valueChange.emit(
  this.normalizeCheckboxValues(this.form.getRawValue())
);
      this.cdr.markForCheck();
    });
  }

  private normalizeCheckboxValues(raw: any): any {
    const result = { ...raw };

    for (const field of this.sortedFields) {
      if (field.type !== 'checkbox') continue;

      const value = raw[field.name];

      // single checkbox already boolean
      if ((field.options?.length ?? 0) <= 1) {
        result[field.name] = !!value;
        continue;
      }

      // multi checkbox → convert boolean array → selected values
      const selected: string[] = [];

      if (Array.isArray(value)) {
        value.forEach((checked: boolean, i: number) => {
          if (checked) {
            selected.push(this.getOptionValue(field.options[i]).toString());
          }
        });
      }

      result[field.name] = selected;
    }

    return result;
  }
}
