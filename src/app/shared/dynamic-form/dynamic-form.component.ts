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
import { take } from 'rxjs/operators';
import {
  DynamicField,
  DynamicFieldOption,
  DynamicFormValue,
} from '../../interfaces/dynamic-field';
import {
  LocationCacheService,
  LocationKind,
} from '../../services/location-cache.service';
import {
  getDynamicFieldErrorMessage,
  shouldShowDynamicFieldError,
} from './dynamic-form.validation';
import {
  buildDynamicFormGroupConfig,
  getInitialFieldValue,
  getOptionValue,
  isMultiSelectField,
  normalizeCheckboxFormValue,
  serializeDynamicFieldsSchema,
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
  private readonly locationCache = inject(LocationCacheService);

  readonly selectDropdownGroup = 'dynamic-form-select';

  readonly fields = input.required<DynamicField[]>();
  /**
   * Enables Country → State → City dependency handling. Only Create/Edit pages
   * opt in; filter screens and the builder preview leave it off so every
   * location dropdown keeps showing the full cached list.
   */
  readonly enableLocationDependencies = input(false);
  readonly valueChange = output<DynamicFormValue>();

  form!: FormGroup;
  readonly sortedFields = signal<DynamicField[]>([]);
  readonly formReady = signal(false);
  readonly imagePreviews = signal<Record<string, string>>({});
  readonly showPasswords = signal<Record<string, boolean>>({});
  readonly selectSearchQueries = signal<Record<string, string>>({});
  /**
   * Per-field option lists that override the field's own `options` for the
   * dependent location dropdowns (State/City). Empty until a parent is chosen.
   */
  readonly locationOptionOverrides = signal<Record<string, DynamicFieldOption[]>>({});
  private fieldsSchemaKey = '';

  /** Resolved Country/State/City fields for the current schema. */
  private locationFields: Partial<Record<LocationKind, DynamicField>> = {};

  readonly filteredSelectOptions = computed(() => {
    const queries = this.selectSearchQueries();
    const overrides = this.locationOptionOverrides();
    const result: Record<string, (string | DynamicFieldOption)[]> = {};

    for (const field of this.sortedFields()) {
      if (field.type !== 'select') {
        continue;
      }

      const options = overrides[field.name] ?? field.options ?? [];
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
    effect(
      () => {
        this.syncFormToFields(this.fields());
      },
      { allowSignalWrites: true },
    );
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
    this.refreshLocationOptionsFromValues();
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

  /**
   * Effective options for a field: a location dependency override when present,
   * otherwise the field's own options. Used by the template for empty-state and
   * label resolution so dependent dropdowns stay in sync with their parent.
   */
  getFieldOptions(field: DynamicField): (string | DynamicFieldOption)[] {
    return this.locationOptionOverrides()[field.name] ?? field.options ?? [];
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

    const options = this.getFieldOptions(field);
    const match = options.find(
      (option, index) => String(getOptionValue(option, index)) === String(selectedValue),
    );

    return match ? this.getOptionLabel(match) : String(selectedValue);
  }

  isMultiSelect(field: DynamicField): boolean {
    return isMultiSelectField(field);
  }

  getMultiSelectSelectedOptions(
    field: DynamicField,
  ): Array<{ label: string; value: string | number }> {
    const control = this.form?.get(field.name);
    const selectedValues = Array.isArray(control?.value) ? control.value : [];
    const options = this.getFieldOptions(field);

    return selectedValues.map((selectedValue: unknown) => {
      const matchIndex = options.findIndex(
        (option, index) => String(getOptionValue(option, index)) === String(selectedValue),
      );

      if (matchIndex >= 0) {
        return {
          label: this.getOptionLabel(options[matchIndex]),
          value: getOptionValue(options[matchIndex], matchIndex),
        };
      }

      return {
        label: String(selectedValue),
        value: selectedValue as string | number,
      };
    });
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

    const optionValue = getOptionValue(option, index);

    if (isMultiSelectField(field)) {
      const selectedValues = Array.isArray(control.value) ? control.value : [];
      return selectedValues.some((value) => String(value) === String(optionValue));
    }

    return String(control.value) === String(optionValue);
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

    if (isMultiSelectField(field)) {
      this.toggleMultiSelectOption(field, option, index);
      return;
    }

    control.setValue(option === undefined ? '' : getOptionValue(option, index));
    control.markAsDirty();
    control.markAsTouched();
    this.overlayService.close();
    this.handleLocationSelection(field);
    this.emitNormalizedValue();
    this.cdr.markForCheck();
  }

  toggleMultiSelectOption(
    field: DynamicField,
    option?: string | DynamicFieldOption,
    index = 0,
  ): void {
    const control = this.form.get(field.name);
    if (!control || option === undefined) {
      return;
    }

    const optionValue = getOptionValue(option, index);
    const current: unknown[] = Array.isArray(control.value) ? [...control.value] : [];
    const existingIndex = current.findIndex((value) => String(value) === String(optionValue));

    if (existingIndex >= 0) {
      current.splice(existingIndex, 1);
    } else {
      current.push(optionValue);
    }

    control.setValue(current);
    control.markAsDirty();
    control.markAsTouched();
    this.handleLocationSelection(field);
    this.emitNormalizedValue();
    this.cdr.markForCheck();
  }

  removeMultiSelectOption(
    field: DynamicField,
    value: string | number,
    event: MouseEvent,
  ): void {
    event.stopPropagation();

    const control = this.form.get(field.name);
    if (!control) {
      return;
    }

    const current: unknown[] = Array.isArray(control.value) ? [...control.value] : [];
    control.setValue(current.filter((item) => String(item) !== String(value)));
    control.markAsDirty();
    control.markAsTouched();
    this.handleLocationSelection(field);
    this.emitNormalizedValue();
    this.cdr.markForCheck();
  }

  clearSelectedOption(field: DynamicField, event: MouseEvent): void {
    event.stopPropagation(); // Dropdown open na ho

    const control = this.form.get(field.name);
    if (!control) {
      return;
    }

    control.setValue(isMultiSelectField(field) ? [] : '');
    control.markAsDirty();
    control.markAsTouched();

    this.handleLocationSelection(field);
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

  private syncFormToFields(fields: DynamicField[]): void {
    const schemaKey = serializeDynamicFieldsSchema(fields);

    if (schemaKey === this.fieldsSchemaKey && this.formReady()) {
      return;
    }

    this.fieldsSchemaKey = schemaKey;
    this.buildForm(fields);
  }

  private buildForm(fields: DynamicField[]): void {
    this.formChangesSub?.unsubscribe();
    const preservedValues = this.collectPreservedValuesByFieldId();
    this.formReady.set(false);

    if (!fields?.length) {
      this.form = this.fb.group({});
      this.sortedFields.set([]);
      this.imagePreviews.set({});
      this.selectSearchQueries.set({});
      this.cdr.markForCheck();
      return;
    }

    const sorted = sortDynamicFields(fields);

    queueMicrotask(() => {
      this.sortedFields.set(sorted);
      this.selectSearchQueries.set({});
      this.form = this.fb.group(buildDynamicFormGroupConfig(this.fb, sorted));
      this.patchPreservedValuesByFieldId(preservedValues, sorted);
      this.imagePreviews.set({});
      this.subscribeToFormChanges();
      this.setupLocationDependencies(sorted);
      this.emitNormalizedValue();
      this.formReady.set(true);
      this.cdr.markForCheck();
    });
  }

  private collectPreservedValuesByFieldId(): Map<string, unknown> {
    const preserved = new Map<string, unknown>();

    if (!this.form) {
      return preserved;
    }

    for (const field of this.sortedFields()) {
      const control = this.form.get(field.name);
      if (control) {
        preserved.set(field.id, control.value);
      }
    }

    return preserved;
  }

  private patchPreservedValuesByFieldId(
    preserved: Map<string, unknown>,
    fields: DynamicField[],
  ): void {
    if (!preserved.size || !this.form) {
      return;
    }

    const patch: DynamicFormValue = {};

    for (const field of fields) {
      if (preserved.has(field.id)) {
        patch[field.name] = preserved.get(field.id);
      }
    }

    if (Object.keys(patch).length) {
      this.form.patchValue(patch);
    }
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

  // ---------------------------------------------------------------------------
  // Country / State / City dependency handling (Create & Edit pages only).
  // Location fields are detected dynamically via `optionSource.endpoint`, so the
  // behaviour applies to every dynamic module without any hardcoded field names.
  // ---------------------------------------------------------------------------

  private setupLocationDependencies(fields: DynamicField[]): void {
    this.locationFields = {};
    this.locationOptionOverrides.set({});

    if (!this.enableLocationDependencies()) {
      return;
    }

    for (const field of fields) {
      if (field.type !== 'select') {
        continue;
      }

      const kind = this.locationCache.resolveKind(field.optionSource?.endpoint);
      if (kind) {
        this.locationFields[kind] = field;
      }
    }

    this.refreshLocationOptionsFromValues();
  }

  /**
   * Loads dependent option lists from the currently selected parent values
   * without clearing any selection. Used on build (empty values) and after an
   * Edit patch (existing values) so children resolve their labels correctly.
   */
  private refreshLocationOptionsFromValues(): void {
    if (!this.enableLocationDependencies() || !this.form) {
      return;
    }

    const { countries: country, states: state, cities: city } = this.locationFields;

    if (state && country) {
      this.loadStateOptions(this.controlValue(country));
    }

    if (city) {
      if (state) {
        this.loadCityOptionsForState(this.controlValue(state));
      } else if (country) {
        this.loadCityOptionsForCountry(this.controlValue(country));
      }
    }
  }

  private handleLocationSelection(field: DynamicField): void {
    if (!this.enableLocationDependencies()) {
      return;
    }

    const { countries: country, states: state, cities: city } = this.locationFields;

    if (country && field === country) {
      const countryValue = this.controlValue(country);

      if (state) {
        this.clearControlValue(state);
        this.loadStateOptions(countryValue);

        // City depends on State (now reset) — clear it and blank its options.
        if (city) {
          this.clearControlValue(city);
          this.setOverride(city, []);
        }
      } else if (city) {
        // No State field: City depends directly on Country.
        this.clearControlValue(city);
        this.loadCityOptionsForCountry(countryValue);
      }
      return;
    }

    if (state && field === state && city) {
      this.clearControlValue(city);
      this.loadCityOptionsForState(this.controlValue(state));
    }
  }

  private loadStateOptions(countryValue: unknown): void {
    const stateField = this.locationFields.states;
    if (!stateField) {
      return;
    }

    if (this.isEmptyValue(countryValue)) {
      this.setOverride(stateField, []);
      return;
    }

    this.locationCache
      .getStatesForCountry(countryValue)
      .pipe(take(1))
      .subscribe((records) => {
        this.setOverride(stateField, this.mapRecordsToOptions(stateField, records));
        this.cdr.markForCheck();
      });
  }

  private loadCityOptionsForState(stateValue: unknown): void {
    const cityField = this.locationFields.cities;
    if (!cityField) {
      return;
    }

    if (this.isEmptyValue(stateValue)) {
      this.setOverride(cityField, []);
      return;
    }

    this.locationCache
      .getCitiesForState(stateValue)
      .pipe(take(1))
      .subscribe((records) => {
        this.setOverride(cityField, this.mapRecordsToOptions(cityField, records));
        this.cdr.markForCheck();
      });
  }

  private loadCityOptionsForCountry(countryValue: unknown): void {
    const cityField = this.locationFields.cities;
    if (!cityField) {
      return;
    }

    if (this.isEmptyValue(countryValue)) {
      this.setOverride(cityField, []);
      return;
    }

    this.locationCache
      .getCitiesForCountry(countryValue)
      .pipe(take(1))
      .subscribe((records) => {
        this.setOverride(cityField, this.mapRecordsToOptions(cityField, records));
        this.cdr.markForCheck();
      });
  }

  private mapRecordsToOptions(
    field: DynamicField,
    records: any[],
  ): DynamicFieldOption[] {
    const labelKey = field.optionSource?.response?.labelKey ?? 'name';
    const valueKey = field.optionSource?.response?.valueKey ?? 'id';

    return (records ?? []).map((record) => ({
      label: String(record?.[labelKey] ?? ''),
      value: record?.[valueKey] as string | number,
    }));
  }

  private setOverride(field: DynamicField, options: DynamicFieldOption[]): void {
    this.locationOptionOverrides.update((prev) => ({
      ...prev,
      [field.name]: options,
    }));
  }

  private controlValue(field: DynamicField): unknown {
    return this.form?.get(field.name)?.value;
  }

  private clearControlValue(field: DynamicField): void {
    this.form?.get(field.name)?.setValue(isMultiSelectField(field) ? [] : '');
  }

  private isEmptyValue(value: unknown): boolean {
    return (
      value === null ||
      value === undefined ||
      value === '' ||
      (Array.isArray(value) && value.length === 0)
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
