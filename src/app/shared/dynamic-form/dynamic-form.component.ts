import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
  OnDestroy,
} from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup } from '@angular/forms';
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
import {
  buildDynamicFormGroupConfig,
  getInitialFieldValue,
  getOptionValue,
  normalizeCheckboxFormValue,
  sortDynamicFields,
} from './dynamic-form.builder';

@Component({
  selector: 'app-dynamic-form',
  standalone: false,
  templateUrl: './dynamic-form.component.html',
  styleUrl: './dynamic-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DynamicFormComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly fields = input.required<DynamicField[]>();
  readonly valueChange = output<DynamicFormValue>();

  form!: FormGroup;
  readonly sortedFields = signal<DynamicField[]>([]);
  readonly imagePreviews = signal<Record<string, string>>({});
  readonly showPasswords = signal<Record<string, boolean>>({});

  private formChangesSub?: Subscription;

  constructor() {
    effect(() => {
      this.buildForm(this.fields());
    });
  }

  ngOnDestroy(): void {
    this.formChangesSub?.unsubscribe();
  }

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
    this.emitNormalizedValue();
    this.cdr.markForCheck();
  }

  resetToDefaults(): void {
    if (!this.form) return;

    for (const field of this.sortedFields()) {
      this.form.get(field.name)?.setValue(this.getInitialValue(field));
    }

    this.imagePreviews.set({});
    this.emitNormalizedValue();
    this.cdr.markForCheck();
  }

  getColClass(field: DynamicField): string {
    const width = field.width ?? 6;
    return `col-md-${width}`;
  }

  getErrorMessage(field: DynamicField): string | null {
    const control = this.getControl(field.name);
    return getDynamicFieldErrorMessage(
      field,
      control,
      shouldShowDynamicFieldError(control),
    );
  }

  getOptionLabel(option: string | DynamicFieldOption): string {
    return typeof option === 'string' ? option : option.label;
  }

  getOptionValue(option: string | DynamicFieldOption, index = 0): string | number {
    return getOptionValue(option, index);
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
      this.imagePreviews.update((previews) => ({
        ...previews,
        [fieldName]: reader.result as string,
      }));
      this.emitNormalizedValue();
      this.cdr.markForCheck();
    };
    reader.readAsDataURL(file);
  }

  removeImage(fieldName: string, input: HTMLInputElement): void {
    this.imagePreviews.update((previews) => {
      const next = { ...previews };
      delete next[fieldName];
      return next;
    });
    this.form.get(fieldName)?.setValue(null);
    this.form.get(fieldName)?.markAsTouched();
    input.value = '';
    this.emitNormalizedValue();
    this.cdr.markForCheck();
  }

  togglePassword(fieldName: string): void {
    this.showPasswords.update((state) => ({
      ...state,
      [fieldName]: !state[fieldName],
    }));
  }

  isChecked(fieldName: string, value: unknown): boolean {
    const control = this.form.get(fieldName);
    if (!control || !Array.isArray(control.value)) {
      return false;
    }
    return control.value.includes(value);
  }

  onMultiCheckboxChange(fieldName: string, value: unknown, event: Event): void {
    const control = this.form.get(fieldName);
    if (!control) return;

    let current: unknown[] = control.value ?? [];

    if ((event.target as HTMLInputElement).checked) {
      current = [...current, value];
    } else {
      current = current.filter((v) => v !== value);
    }

    control.setValue(current);
    control.markAsDirty();
    control.markAsTouched();
    this.emitNormalizedValue();
  }

  isFullWidthField(field: DynamicField): boolean {
    return (
      field.type === 'image' ||
      field.type === 'textarea' ||
      field.label === 'Availability Days'
    );
  }

  private buildForm(fields: DynamicField[]): void {
    this.formChangesSub?.unsubscribe();

    if (!fields?.length) {
      this.form = this.fb.group({});
      this.sortedFields.set([]);
      this.imagePreviews.set({});
      this.cdr.markForCheck();
      return;
    }

    const sorted = sortDynamicFields(fields);
    this.sortedFields.set(sorted);
    this.form = this.fb.group(buildDynamicFormGroupConfig(this.fb, sorted));
    this.imagePreviews.set({});
    this.subscribeToFormChanges();
    this.emitNormalizedValue();
    this.cdr.markForCheck();
  }

  private getInitialValue(field: DynamicField): unknown {
    return getInitialFieldValue(field);
  }

  private subscribeToFormChanges(): void {
    this.formChangesSub = merge(this.form.valueChanges, this.form.statusChanges).subscribe(
      () => {
        this.emitNormalizedValue();
        this.cdr.markForCheck();
      },
    );
  }

  private emitNormalizedValue(): void {
    if (!this.form) return;
    this.valueChange.emit(
      normalizeCheckboxFormValue(this.form.getRawValue(), this.sortedFields()),
    );
  }
}
