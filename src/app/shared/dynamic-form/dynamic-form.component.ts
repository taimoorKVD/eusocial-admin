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
import { AbstractControl, FormArray, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
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

  private formChangesSub?: Subscription;

  constructor(
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['fields']) {
      this.buildForm();
    }
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
    if (!this.form || !values) {
      return;
    }

    this.form.patchValue(values);
    this.valueChange.emit(this.form.getRawValue());
    this.cdr.markForCheck();
  }

  resetToDefaults(): void {
    if (!this.form) {
      return;
    }

    for (const field of this.sortedFields) {
      this.form.get(field.name)?.setValue(this.getInitialValue(field));
    }

    this.valueChange.emit(this.form.getRawValue());
    this.cdr.markForCheck();
  }

  trackByField(_index: number, field: DynamicField): string {
    return field.id;
  }

  trackByOption(index: number, option: string | DynamicFieldOption): string | number {
    return this.getOptionValue(option, index);
  }

  getColClass(field: DynamicField): string {
    if(field.label === "Availability Days") {
      return 'col-md-12';
    }
    // const width = field.width ?? 12;
    const width = 6;
    // return `grid grid-cols-3 gap-10 mb-[30px]`;
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
    return typeof option === 'string' ? option : option.value ?? index;
  }

  private buildForm(): void {
    this.formChangesSub?.unsubscribe();

    if (!this.fields?.length) {
      this.form = this.fb.group({});
      this.sortedFields = [];
      this.cdr.markForCheck();
      return;
    }

    this.sortedFields = [...this.fields]
      .map((field, index) => ({ field, index }))
      .sort(
        (a, b) =>
          (a.field.order ?? a.index) - (b.field.order ?? b.index) || a.index - b.index,
      )
      .map(({ field }) => field);

    const groupConfig: Record<string, unknown> = {};

    for (const field of this.sortedFields) {
      groupConfig[field.name] = [this.getInitialValue(field), this.getValidators(field)];
    }

    this.form = this.fb.group(groupConfig);
    this.subscribeToFormChanges();
    this.valueChange.emit(this.form.getRawValue());
    this.cdr.markForCheck();
  }

  private getInitialValue(field: DynamicField): unknown {
    if (field.value !== undefined && field.value !== null) {
      return field.value;
    }

    switch (field.type) {
      case 'checkbox':
        return false;
      case 'number':
        return null;
      default:
        return '';
    }
  }

  private getValidators(field: DynamicField) {
    const validators = [];

    if (field.required) {
      validators.push(Validators.required);
    }

    if (field.type === 'email') {
      validators.push(Validators.email);
    }

    return validators;
  }

  private subscribeToFormChanges(): void {
    this.formChangesSub = merge(this.form.valueChanges, this.form.statusChanges).subscribe(
      () => {
        this.valueChange.emit(this.form.getRawValue());
        this.cdr.markForCheck();
      },
    );
  }
  imagePreviews: Record<string, string> = {};
  onImageSelected(event: Event, fieldName: string): void {
    const input = event.target as HTMLInputElement;

    if (!input.files?.length) {
      return;
    }

    const file = input.files[0];

    this.form.get(fieldName)?.setValue(file);
    this.form.get(fieldName)?.markAsDirty();

    const reader = new FileReader();

    reader.onload = () => {
      this.imagePreviews[fieldName] = reader.result as string;
    };

    reader.readAsDataURL(file);
  }
}
