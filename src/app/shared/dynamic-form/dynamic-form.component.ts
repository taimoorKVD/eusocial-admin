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
import { Subscription, forkJoin, merge, of } from 'rxjs';
import { catchError, take } from 'rxjs/operators';
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
  ConditionalFieldEffects,
  buildValuesByFieldId,
  conditionalEffectsEqual,
  resolveAllConditionalEffects,
} from '../conditional-logic';
import {
  getDynamicFieldErrorMessage,
  shouldShowDynamicFieldError,
} from './dynamic-form.validation';
import {
  buildDynamicFormGroupConfig,
  getFieldValidators,
  getInitialFieldValue,
  getOptionValue,
  isMultiSelectField,
  normalizeCheckboxFormValue,
  serializeDynamicFieldsSchema,
  sortDynamicFields,
} from './dynamic-form.builder';
import {
  allowsDecimalPoint,
  getNumberFieldStep,
  sanitizeNumberFieldInput,
} from './number-field.utils';
import { getFieldCharacterLimit } from './character-limit.utils';
import {
  earlierIsoDate,
  getRangePlaceholderFrom as resolveRangePlaceholderFrom,
  getRangePlaceholderTo as resolveRangePlaceholderTo,
  getRangeSideLabel as resolveRangeSideLabel,
  laterIsoDate,
  normalizeRangeTimeFormat,
  normalizeRangeType,
  normalizeRangeValue,
  normalizeTimeTo24h,
  parseRangeNumber,
  RangeFieldValue,
  resolveRangeStep,
  sanitizeRangeNumberInput,
} from './range-field.utils';
import { DropdownOverlayService } from '../directives/dropdown-panel/dropdown-overlay.service';
import { ToastrService } from 'ngx-toastr';
import { FormImageUploadService } from '../../tenant/form-builder/services/form-image-upload.service';
import { ImageFile } from '../../tenant/form-builder/models/image-file.model';
import {
  cloneImageFiles,
  filterAnswerImages,
  getImageUploadRejectionReason,
  IMAGE_ACCEPT_ATTRIBUTE,
  IMAGE_TYPE_ERROR_MESSAGE,
  readImageMultiple,
  resolveImageDisplayUrl,
  resolveMaxFiles,
  resolveMinFiles,
} from '../../tenant/form-builder/utils/image-field.utils';
import {
  getRatingStarValues,
  normalizeMaxRating,
  normalizeRatingValue,
} from './rating-field.utils';

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
  private readonly formImageUploadService = inject(FormImageUploadService);
  private readonly toastr = inject(ToastrService);

  readonly selectDropdownGroup = 'dynamic-form-select';

  readonly fields = input.required<DynamicField[]>();
  /**
   * Enables Country → State → City dependency handling. Only Create/Edit pages
   * opt in. Child lists are loaded lazily from /states and /cities when a parent
   * is selected; they are not preloaded.
   */
  readonly enableLocationDependencies = input(false);
  readonly valueChange = output<DynamicFormValue>();

  form!: FormGroup;
  readonly sortedFields = signal<DynamicField[]>([]);
  readonly formReady = signal(false);
  readonly imageUploading = signal<Record<string, boolean>>({});
  readonly imageLightboxUrl = signal<string | null>(null);
  readonly showPasswords = signal<Record<string, boolean>>({});
  readonly selectSearchQueries = signal<Record<string, string>>({});
  /**
   * Per-field option lists that override the field's own `options` for the
   * dependent location dropdowns (State/City). Empty until a parent is chosen.
   */
  readonly locationOptionOverrides = signal<Record<string, DynamicFieldOption[]>>({});
  readonly conditionalEffects = signal<Record<string, ConditionalFieldEffects>>({});
  private fieldsSchemaKey = '';
  private applyingConditionalState = false;

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
    const raw = this.form?.getRawValue() ?? {};
    return this.toLocationSubmitValues(
      this.normalizeImageFormValue(
        normalizeCheckboxFormValue(raw, this.sortedFields()),
      ),
    );
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

    const normalized: DynamicFormValue = { ...values };
    for (const field of this.sortedFields()) {
      if (!Object.prototype.hasOwnProperty.call(normalized, field.name)) {
        continue;
      }

      if (field.type === 'image') {
        normalized[field.name] = filterAnswerImages(normalized[field.name]);
      } else if (field.type === 'rating') {
        normalized[field.name] = normalizeRatingValue(
          normalized[field.name],
          normalizeMaxRating(field.maxRating),
        );
      }
    }

    this.form.patchValue(normalized);
    this.refreshLocationOptionsFromValues();
    this.refreshConditionalEffects();
    this.emitNormalizedValue();
    this.cdr.markForCheck();
  }

  resetToDefaults(): void {
    if (!this.form) return;

    for (const field of this.sortedFields()) {
      this.form.get(field.name)?.setValue(this.getInitialValue(field));
    }

    this.imageUploading.set({});
    this.refreshConditionalEffects();
    this.emitNormalizedValue();
    this.cdr.markForCheck();
  }

  getColClass(field: DynamicField): string {
    const width = field.width ?? 6;
    return `col-md-${width}`;
  }

  isFieldVisible(field: DynamicField): boolean {
    const effect = this.conditionalEffects()[field.id];
    return effect ? effect.visible : field.isShow !== false;
  }

  isFieldRequired(field: DynamicField): boolean {
    return this.conditionalEffects()[field.id]?.required ?? !!field.required;
  }

  isFieldDisabled(field: DynamicField): boolean {
    return this.conditionalEffects()[field.id]?.disabled === true;
  }

  getConditionalEffects(): Record<string, ConditionalFieldEffects> {
    return this.conditionalEffects();
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

  getImageAcceptAttribute(): string {
    return IMAGE_ACCEPT_ATTRIBUTE;
  }

  getReferenceImages(field: DynamicField): ImageFile[] {
    return cloneImageFiles(field.referenceImages);
  }

  getAnswerImages(field: DynamicField): ImageFile[] {
    return filterAnswerImages(this.form?.get(field.name)?.value);
  }

  isImageMultiple(field: DynamicField): boolean {
    return readImageMultiple(field);
  }

  getImageMaxFiles(field: DynamicField): number {
    return resolveMaxFiles(field);
  }

  getImageMinFiles(field: DynamicField): number {
    return resolveMinFiles(field);
  }

  canAddAnswerImages(field: DynamicField): boolean {
    if (this.isFieldDisabled(field) || this.imageUploading()[field.name]) {
      return false;
    }
    return this.getAnswerImages(field).length < resolveMaxFiles(field);
  }

  getAnswerImageSlotsRemaining(field: DynamicField): number {
    return Math.max(0, resolveMaxFiles(field) - this.getAnswerImages(field).length);
  }

  onAnswerImagesSelected(event: Event, field: DynamicField): void {
    const control = this.form.get(field.name);
    if (!control || control.disabled || this.imageUploading()[field.name]) {
      return;
    }

    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    input.value = '';

    if (!files.length) {
      return;
    }

    const remaining = this.getAnswerImageSlotsRemaining(field);
    if (remaining <= 0) {
      this.toastr.warning(
        `${field.label} allows at most ${resolveMaxFiles(field)} image${resolveMaxFiles(field) === 1 ? '' : 's'}.`,
      );
      return;
    }

    const selected = files.slice(0, remaining);
    if (files.length > remaining) {
      this.toastr.warning(
        `Only ${remaining} more image${remaining === 1 ? '' : 's'} can be uploaded for ${field.label}.`,
      );
    }

    const rejected = selected
      .map((file) => ({ file, reason: getImageUploadRejectionReason(file) }))
      .filter((item) => !!item.reason);

    if (rejected.length) {
      this.toastr.error(rejected[0].reason || IMAGE_TYPE_ERROR_MESSAGE);
    }

    const validFiles = selected.filter((file) => !getImageUploadRejectionReason(file));
    if (!validFiles.length) {
      return;
    }

    this.imageUploading.update((state) => ({ ...state, [field.name]: true }));

    forkJoin(
      validFiles.map((file) =>
        this.formImageUploadService.upload(file, 'answer').pipe(
          catchError((err) => {
            this.toastr.error(
              err?.error?.message || err?.message || 'Failed to upload image.',
            );
            return of(null);
          }),
        ),
      ),
    ).subscribe({
      next: (results) => {
        const uploaded = results.filter((item): item is ImageFile => !!item);
        if (!uploaded.length) {
          return;
        }

        const next = [
          ...filterAnswerImages(control.value),
          ...uploaded.map((image) => ({ ...image, purpose: 'answer' as const })),
        ].slice(0, resolveMaxFiles(field));

        control.setValue(next);
        control.markAsDirty();
        control.markAsTouched();
        this.emitNormalizedValue();
        this.cdr.markForCheck();
      },
      complete: () => {
        this.imageUploading.update((state) => ({ ...state, [field.name]: false }));
        this.cdr.markForCheck();
      },
    });
  }

  removeAnswerImage(field: DynamicField, index: number): void {
    const control = this.form.get(field.name);
    if (!control || control.disabled) {
      return;
    }

    const next = filterAnswerImages(control.value);
    if (index < 0 || index >= next.length) {
      return;
    }

    const [removed] = next.splice(index, 1);

    const applyLocalRemove = () => {
      control.setValue(next);
      control.markAsDirty();
      control.markAsTouched();
      this.emitNormalizedValue();
      this.cdr.markForCheck();
    };

    const key = removed?.key?.trim();
    if (!key) {
      applyLocalRemove();
      return;
    }

    this.formImageUploadService.deleteImage(key).subscribe({
      next: () => applyLocalRemove(),
      error: (err) => {
        this.toastr.error(
          err?.error?.message || err?.message || 'Failed to delete image.',
        );
        this.cdr.markForCheck();
      },
    });
  }

  getImageDisplayUrl(image: ImageFile): string {
    return resolveImageDisplayUrl(image);
  }

  openImageLightbox(image: ImageFile | string): void {
    const url =
      typeof image === 'string' ? image : resolveImageDisplayUrl(image);
    if (!url) {
      return;
    }
    this.imageLightboxUrl.set(url);
  }

  closeImageLightbox(): void {
    this.imageLightboxUrl.set(null);
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

  getNumberStep(field: DynamicField): string {
    return getNumberFieldStep(field);
  }

  getMaxRating(field: DynamicField): number {
    return normalizeMaxRating(field.maxRating);
  }

  getRatingStarValues(field: DynamicField): number[] {
    return getRatingStarValues(this.getMaxRating(field));
  }

  getRatingValue(field: DynamicField): number {
    return normalizeRatingValue(this.form?.get(field.name)?.value, this.getMaxRating(field)) ?? 0;
  }

  isRatingSelected(field: DynamicField, star: number): boolean {
    return star <= this.getRatingValue(field);
  }

  onRatingSelect(field: DynamicField, star: number): void {
    if (this.isFieldDisabled(field)) {
      return;
    }

    const control = this.form?.get(field.name);
    if (!control || control.disabled) {
      return;
    }

    const max = this.getMaxRating(field);
    const current = normalizeRatingValue(control.value, max);
    // Toggle off when clicking the same selected value on an optional field.
    const next =
      current === star && !this.isFieldRequired(field)
        ? null
        : normalizeRatingValue(star, max);

    control.setValue(next);
    control.markAsDirty();
    control.markAsTouched();
    this.emitNormalizedValue();
    this.cdr.markForCheck();
  }

  getCharacterLimit(field: DynamicField): number | null {
    return getFieldCharacterLimit(field);
  }

  getRangeType(field: DynamicField): 'number' | 'date' | 'time' {
    return normalizeRangeType(field.rangeType);
  }

  getRangeStep(field: DynamicField): number {
    return resolveRangeStep(field);
  }

  getRangeTimeFormat(field: DynamicField): '12' | '24' {
    return normalizeRangeTimeFormat(field.timeFormat);
  }

  getRangePlaceholderFrom(field: DynamicField): string {
    return resolveRangePlaceholderFrom(field);
  }

  getRangePlaceholderTo(field: DynamicField): string {
    return resolveRangePlaceholderTo(field);
  }

  getRangeSideLabel(field: DynamicField, side: 'from' | 'to'): string {
    return resolveRangeSideLabel(field, side);
  }

  getRangeFromMinDate(field: DynamicField): string | null {
    return field.rangeMinDate || null;
  }

  getRangeFromMaxDate(field: DynamicField): string | null {
    return earlierIsoDate(field.rangeMaxDate, this.getRangeSideValue(field, 'to')) || null;
  }

  getRangeToMinDate(field: DynamicField): string | null {
    return laterIsoDate(field.rangeMinDate, this.getRangeSideValue(field, 'from')) || null;
  }

  getRangeToMaxDate(field: DynamicField): string | null {
    return field.rangeMaxDate || null;
  }

  getRangeSideValue(field: DynamicField, side: 'from' | 'to'): string {
    const value = normalizeRangeValue(this.form?.get(field.name)?.value);
    const raw = value[side];
    if (raw == null || raw === '') {
      return '';
    }

    if (this.getRangeType(field) === 'time') {
      return normalizeTimeTo24h(raw) ?? '';
    }

    return String(raw);
  }

  onRangeDateChange(
    dateStr: string | null,
    field: DynamicField,
    side: 'from' | 'to',
  ): void {
    const control = this.form?.get(field.name);
    if (!control || control.disabled) {
      return;
    }

    const current = normalizeRangeValue(control.value);
    const nextValue: RangeFieldValue = {
      ...current,
      [side]: dateStr || null,
    };

    control.setValue(nextValue);
    control.markAsDirty();
    control.markAsTouched();
    this.emitNormalizedValue();
    // Force immediate rebinding so the opposite Flatpickr receives
    // updated minDate/maxDate before the user opens it.
    this.cdr.detectChanges();
  }

  onRangeSideInput(event: Event, field: DynamicField, side: 'from' | 'to'): void {
    const control = this.form?.get(field.name);
    if (!control || control.disabled) {
      return;
    }

    const input = event.target as HTMLInputElement;
    const rangeType = this.getRangeType(field);
    const current = normalizeRangeValue(control.value);
    let nextSide: string | number | null = input.value;

    if (rangeType === 'number') {
      const sanitized = sanitizeRangeNumberInput(
        input.value,
        allowsDecimalPoint(field),
      );
      if (input.value !== sanitized) {
        input.value = sanitized;
      }
      nextSide = sanitized === '' || sanitized === '-' || sanitized === '.' || sanitized === '-.'
        ? null
        : (parseRangeNumber(sanitized) ?? sanitized);
    } else if (rangeType === 'time') {
      nextSide = normalizeTimeTo24h(input.value);
    } else if (rangeType === 'date') {
      nextSide = input.value || null;
    }

    const nextValue: RangeFieldValue = {
      ...current,
      [side]: nextSide,
    };

    control.setValue(nextValue);
    control.markAsDirty();
    control.markAsTouched();
    this.emitNormalizedValue();
    this.cdr.markForCheck();
  }

  onNumberInput(event: Event, field: DynamicField): void {
    const input = event.target as HTMLInputElement;
    const control = this.form?.get(field.name);
    if (!control || control.disabled) {
      return;
    }

    const allowDecimal = allowsDecimalPoint(field);
    const sanitized = sanitizeNumberFieldInput(input.value, allowDecimal);

    if (input.value !== sanitized) {
      input.value = sanitized;
    }

    const nextValue =
      sanitized === '' || sanitized === '-' || sanitized === '.' || sanitized === '-.'
        ? null
        : Number(sanitized);

    if (control.value !== nextValue) {
      control.setValue(Number.isFinite(nextValue as number) ? nextValue : null);
      control.markAsDirty();
      control.markAsTouched();
    }
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
    if (!control || control.disabled) {
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
    return control.value.some((item: unknown) => String(item) === String(value));
  }

  onMultiCheckboxChange(fieldName: string, value: unknown, event: Event): void {
    const control = this.form.get(fieldName);
    if (!control || control.disabled) return;

    let current: unknown[] = Array.isArray(control.value) ? [...control.value] : [];

    if ((event.target as HTMLInputElement).checked) {
      if (!current.some(item => String(item) === String(value))) {
        current = [...current, value];
      }
    } else {
      current = current.filter((item) => String(item) !== String(value));
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
      field.type === 'range' ||
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
      this.imageUploading.set({});
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
      this.imageUploading.set({});
      this.subscribeToFormChanges();
      this.setupLocationDependencies(sorted);
      this.refreshConditionalEffects();
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
        const value = preserved.get(field.id);
        patch[field.name] =
          field.type === 'image' ? filterAnswerImages(value) : value;
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
        if (this.applyingConditionalState) {
          return;
        }

        this.refreshConditionalEffects();
        this.emitNormalizedValue();
        this.cdr.markForCheck();
      },
    );
  }

  private refreshConditionalEffects(): void {
    if (!this.form) {
      this.conditionalEffects.set({});
      return;
    }

    const fields = this.sortedFields();
    const valuesByFieldId = buildValuesByFieldId(fields, this.form.getRawValue());
    const nextEffects = resolveAllConditionalEffects(fields, valuesByFieldId);

    if (!conditionalEffectsEqual(this.conditionalEffects(), nextEffects)) {
      this.conditionalEffects.set(nextEffects);
    }

    this.applyConditionalControlState();
  }

  private applyConditionalControlState(): void {
    if (!this.form) {
      return;
    }

    this.applyingConditionalState = true;

    try {
      const effects = this.conditionalEffects();

      for (const field of this.sortedFields()) {
        const control = this.form.get(field.name);
        if (!control) {
          continue;
        }

        const effect = effects[field.id] ?? {
          visible: field.isShow !== false,
          required: !!field.required,
          disabled: field.isReadonly === true,
        };

        control.setValidators(
          getFieldValidators(field, {
            required: effect.required,
            visible: effect.visible,
          }),
        );
        control.updateValueAndValidity({ emitEvent: false });

        const shouldDisable = effect.disabled || !effect.visible;
        if (shouldDisable && control.enabled) {
          control.disable({ emitEvent: false });
        } else if (!shouldDisable && control.disabled) {
          control.enable({ emitEvent: false });
        }
      }
    } finally {
      this.applyingConditionalState = false;
    }
  }

  private emitNormalizedValue(): void {
    if (!this.form) return;
    this.valueChange.emit(
      this.normalizeImageFormValue(
        normalizeCheckboxFormValue(this.form.getRawValue(), this.sortedFields()),
      ),
    );
  }

  private normalizeImageFormValue(raw: DynamicFormValue): DynamicFormValue {
    const result: DynamicFormValue = { ...raw };

    for (const field of this.sortedFields()) {
      if (field.type === 'image') {
        result[field.name] = filterAnswerImages(raw[field.name]);
      }
    }

    return result;
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
      return;
    }

    if (city && country) {
      this.loadCityOptionsForCountry(this.controlValue(country));
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
      const cityField = this.locationFields.cities;
      if (cityField) {
        this.setOverride(cityField, []);
      }
      return;
    }

    this.locationCache
      .getStatesForCountry(countryValue)
      .pipe(take(1))
      .subscribe((records) => {
        this.setOverride(stateField, this.mapRecordsToOptions(stateField, records));

        const cityField = this.locationFields.cities;
        if (cityField) {
          this.loadCityOptionsForState(this.controlValue(stateField));
        }

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
      .getCitiesForState(this.resolveLocationParentId(this.locationFields.states, stateValue))
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
    this.alignControlValueToOptions(field, options);
  }

  /**
   * Country stays as an ID in the payload. State and City selections are
   * converted to their display names when reading `value` for submit.
   */
  private toLocationSubmitValues(raw: DynamicFormValue): DynamicFormValue {
    const next: DynamicFormValue = { ...raw };
    const kinds: LocationKind[] = ['states', 'cities'];

    for (const kind of kinds) {
      const field = this.locationFields[kind];
      if (!field) {
        continue;
      }

      const key = Object.prototype.hasOwnProperty.call(next, field.name)
        ? field.name
        : field.id;
      if (!Object.prototype.hasOwnProperty.call(next, key)) {
        continue;
      }

      next[key] = this.mapLocationValueToNames(next[key], this.getFieldOptions(field));
    }

    return next;
  }

  private mapLocationValueToNames(
    value: unknown,
    options: (string | DynamicFieldOption)[],
  ): unknown {
    if (this.isEmptyValue(value)) {
      return value;
    }

    const isArray = Array.isArray(value);
    const items = isArray ? value : [value];
    const names = items.map((item) => {
      const raw =
        item && typeof item === 'object' && 'id' in (item as object)
          ? (item as { id: unknown }).id
          : item;
      const match = options.find((option, index) => {
        const optionValue = getOptionValue(option, index);
        const optionLabel = this.getOptionLabel(option);
        return String(optionValue) === String(raw) || String(optionLabel) === String(raw);
      });

      return match ? this.getOptionLabel(match) : raw;
    });

    return isArray ? names : names[0];
  }

  private alignControlValueToOptions(
    field: DynamicField,
    options: DynamicFieldOption[],
  ): void {
    const control = this.form?.get(field.name);
    if (!control || !options.length) {
      return;
    }

    const value = control.value;
    if (this.isEmptyValue(value)) {
      return;
    }

    const isArray = Array.isArray(value);
    const items = isArray ? value : [value];
    const mapped = items.map((item) => {
      const raw =
        item && typeof item === 'object' && 'id' in (item as object)
          ? (item as { id: unknown }).id
          : item;
      const byValue = options.find((option) => String(option.value) === String(raw));
      if (byValue) {
        return byValue.value;
      }

      const byLabel = options.find(
        (option) => String(option.label).toLowerCase() === String(raw).toLowerCase(),
      );
      return byLabel?.value ?? raw;
    });

    const next = isArray ? mapped : mapped[0];
    if (JSON.stringify(next) !== JSON.stringify(value)) {
      control.setValue(next, { emitEvent: false });
    }
  }

  private resolveLocationParentId(field: DynamicField | undefined, value: unknown): unknown {
    if (!field || this.isEmptyValue(value)) {
      return value;
    }

    const raw = Array.isArray(value) ? value[0] : value;
    const options = this.getFieldOptions(field);
    const match = options.find((option, index) => {
      const optionValue = getOptionValue(option, index);
      const optionLabel = this.getOptionLabel(option);
      return String(optionValue) === String(raw) || String(optionLabel) === String(raw);
    });

    return match ? getOptionValue(match) : raw;
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
