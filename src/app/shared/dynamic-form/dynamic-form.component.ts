import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
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
import { DropdownOverlayService } from '../directives/dropdown-panel/dropdown-overlay.service';

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
  private readonly overlayService = inject(DropdownOverlayService);

  readonly selectDropdownGroup = 'dynamic-form-select';

  readonly fields = input.required<DynamicField[]>();
  readonly valueChange = output<DynamicFormValue>();

  form!: FormGroup;
  readonly sortedFields = signal<DynamicField[]>([]);
  readonly imagePreviews = signal<Record<string, string>>({});
  readonly showPasswords = signal<Record<string, boolean>>({});
  readonly selectSearchQueries = signal<Record<string, string>>({});

  readonly filteredSelectOptions = computed(() => {
    const queries = this.selectSearchQueries();
    const result: Record<string, (string | DynamicFieldOption)[]> = {};

    for (const field of this.sortedFields()) {
      if (field.type !== 'select') {
        continue;
      }

      const options = field.options ?? [];
      const query = (queries[field.name] ?? '').trim().toLowerCase();

      result[field.name] = query
        ? options.filter((option) =>
            this.getOptionLabel(option).toLowerCase().includes(query),
          )
        : options;
    }

    return result;
  });

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

  onSelectSearch(fieldName: string, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.selectSearchQueries.update((queries) => ({ ...queries, [fieldName]: value }));
  }

  getSelectDisplayLabel(field: DynamicField): string {
    const control = this.form?.get(field.name);
    const selectedValue = control?.value;

    if (selectedValue === undefined || selectedValue === null || selectedValue === '') {
      return `Select ${field.label}`;
    }

    const options = field.options ?? [];
    const match = options.find(
      (option, index) => String(getOptionValue(option, index)) === String(selectedValue),
    );

    return match ? this.getOptionLabel(match) : String(selectedValue);
  }

  isSelectOptionSelected(
    field: DynamicField,
    option: string | DynamicFieldOption,
    index: number,
  ): boolean {
    const control = this.form?.get(field.name);
    if (!control) {
      return false;
    }

    return String(control.value) === String(getOptionValue(option, index));
  }

  selectOption(
    field: DynamicField,
    option?: string | DynamicFieldOption,
    index = 0,
  ): void {
    const control = this.form.get(field.name);
    if (!control) {
      return;
    }

    control.setValue(option === undefined ? '' : getOptionValue(option, index));
    control.markAsDirty();
    control.markAsTouched();
    this.overlayService.close();
    this.emitNormalizedValue();
    this.cdr.markForCheck();
  }

  clearSelectedOption(field: DynamicField, event: MouseEvent): void {
    event.stopPropagation(); // Dropdown open na ho

    const control = this.form.get(field.name);
    if (!control) {
      return;
    }

    control.setValue('');
    control.markAsDirty();
    control.markAsTouched();

    this.emitNormalizedValue();
    this.cdr.markForCheck();
  }

  generatePassword(fieldName: string): void {
    const control = this.form.get(fieldName);
    if (!control) {
      return;
    }

    control.setValue(this.createRandomPassword());
    control.markAsDirty();
    control.markAsTouched();
    this.showPasswords.update((state) => ({ ...state, [fieldName]: true }));
    this.emitNormalizedValue();
    this.cdr.markForCheck();
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
    this.selectSearchQueries.set({});
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

  private createRandomPassword(): string {
    const length = 8 + Math.floor(Math.random() * 5);
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '!@#$%^&*';
    const all = upper + lower + numbers + special;

    const chars = [
      upper[Math.floor(Math.random() * upper.length)],
      lower[Math.floor(Math.random() * lower.length)],
      numbers[Math.floor(Math.random() * numbers.length)],
      special[Math.floor(Math.random() * special.length)],
      ...Array.from({ length: length - 4 }, () => all[Math.floor(Math.random() * all.length)]),
    ];

    for (let i = chars.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }

    return chars.join('');
  }
}
