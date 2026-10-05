import {
  Component,
  EventEmitter,
  Input,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import {
  CONDITION_ACTION_LABELS,
  CONDITION_ACTIONS,
  CONDITION_OPERATOR_LABELS,
  CONDITION_OPERATORS,
  ConditionActionType,
  ConditionOperator,
  EXPRESSION_OP_LABELS,
  EXPRESSION_OPS,
  ExpressionOp,
  FieldConditionalLogic,
  VALUE_SOURCE_KIND_LABELS,
  VALUE_SOURCE_KINDS,
  ValueSource,
  ValueSourceKind,
  cloneConditionalLogic,
  collectValueSourceFieldIds,
  createDefaultValueSource,
  createEmptyConditionalLogic,
  filterRelatedPropertiesForTargetKind,
  getPrimaryActionType,
  getPrimaryPredicate,
  getPrimarySetValueSource,
  getValidConditionalSourceFields,
  isCompatibleSetValueSourceField,
  normalizeValueSource,
  operatorRequiresValue,
  resolveSetValueFieldKind,
  serializeConditionalLogic,
  setPrimaryActionType,
  setPrimaryPredicate,
  setPrimarySetValueSource,
  supportsSetValueFieldType,
  wouldCreateCircularDependency,
} from '../../../shared/conditional-logic';
import { FormField, FieldOption, OptionSource, RangeFieldType, RangeTimeFormat } from '../models/form-field.model';
import { ImageFile } from '../models/image-file.model';
import { normalizeFieldOption, normalizeStaticSelectFieldOptions } from '../utils/field-options.utils';
import {
  CURRENT_USER_DEFAULT_TOKEN,
  supportsCurrentUserDefault,
} from '../utils/field-default-value.utils';
import { buildPlaceholderFromLabel, supportsPlaceholderAutoGeneration } from '../utils/form-field.factory';
import {
  cloneImageFiles,
  getImageUploadRejectionReason,
  IMAGE_ACCEPT_ATTRIBUTE,
  IMAGE_TYPE_ERROR_MESSAGE,
  readImageMultiple,
  resolveImageDisplayUrl,
  resolveMaxFiles,
  resolveMinFiles,
  sanitizeImageFieldConfig,
} from '../utils/image-field.utils';
import { FormImageUploadService } from '../services/form-image-upload.service';
import { normalizeOptionSource } from '../utils/option-source.utils';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  getCharacterLimitExceededMessage,
  getDefaultCharacterLimit,
  isCharacterLimitAboveMaximum,
  resolveCharacterLimit,
  supportsCharacterLimit as fieldSupportsCharacterLimit,
} from '../../../shared/dynamic-form/character-limit.utils';
import {
  DEFAULT_RANGE_PLACEHOLDER_FROM,
  DEFAULT_RANGE_PLACEHOLDER_TO,
  DEFAULT_RANGE_STEP,
  normalizeRangeTimeFormat,
  normalizeRangeType,
  normalizeRangeValue,
  resetRangeTypeSpecificConfig,
  sanitizeDateBounds,
  sanitizeRangeBounds,
} from '../../../shared/dynamic-form/range-field.utils';
import { normalizeTimeFieldFormat } from '../../../shared/dynamic-form/time-field.utils';
import {
  getDefaultUnitCode,
  getUnitsForFieldType,
  isMeasurementFieldType,
  MeasurementUnit,
  MeasurementUnitMode,
  normalizeMeasurementUnitCode,
  normalizeMeasurementUnitMode,
} from '../../../shared/dynamic-form/measurement-units';
import {
  normalizeMeasurementValue,
} from '../../../shared/dynamic-form/measurement-field.utils';
import {
  getLocationFieldDeleteBlockReason,
  isDynamicSelectOptionsHiddenForModule,
  isMultiSelectionTypeHiddenForModule,
  resolveBuilderLocationKind,
  schemaHasLocationKind,
} from '../utils/location-field-dependencies.utils';
import { isUniqueDynamicModuleOptionDisabled } from '../utils/unique-dynamic-modules.utils';
import { DynamicModuleOptionsService, ModuleColumnOption, ModuleDataCache } from '../services/dynamic-module-options.service';
import { FormModuleListItem } from '../../forms/models/form-module.model';
import { DropdownOverlayService } from '../../../shared/directives/dropdown-panel/dropdown-overlay.service';

type SelectOptionsMode = 'static' | 'dynamic';

/** Fixed Display Column for Dynamic Select — not user-configurable. */
const DYNAMIC_SELECT_LABEL_KEY = 'name';

interface LoadModuleDataOptions {
  /** When true, keep currently saved dynamic option selections (edit restore). */
  preserveSelection?: boolean;
  emitUpdate?: boolean;
}

@Component({
  selector: 'app-field-settings',
  standalone: false,
  templateUrl: './field-settings.component.html',
  styleUrl: './field-settings.component.scss',
})
export class FieldSettingsComponent {
  private readonly toastr = inject(ToastrService);
  private readonly overlayService = inject(DropdownOverlayService);
  private readonly schemaSignal = signal<FormField[]>([]);
  private readonly selectedFieldIdSignal = signal<string | null>(null);
  readonly dynamicOptionsDropdownGroup = 'form-builder-dynamic-options';

  @Input() activeModuleName = '';

  /**
   * When true (Edit Form Builder on user/item/vendor setup), each Dynamic Module
   * may only be assigned to one Select field in the current form.
   */
  @Input() enforceUniqueDynamicModules = false;

  /**
   * When true, the current field is referenced by one or more form-level Logic Rules.
   * Parents compute this (Form Template only).
   */
  @Input() fieldUsedInLogicRules = false;

  @Input() set schema(value: FormField[] | null | undefined) {
    const next = value ?? [];
    const current = this.schemaSignal();
    // Avoid signal writes on identical schema identity churn from parent computeds.
    if (
      current.length === next.length &&
      current.every((field, index) => field === next[index])
    ) {
      return;
    }

    this.schemaSignal.set(next);
    this.ensureConditionSourceIsValid(false);
  }

  /** Country on another field — required before States/Cities can be selected. */
  readonly hasCountryField = computed(() =>
    schemaHasLocationKind(
      this.schemaSignal(),
      'countries',
      this.selectedFieldIdSignal() ?? undefined
    )
  );

  @Input() set field(value: FormField | undefined) {
    if (!value) {
      return;
    }

    this.selectedFieldIdSignal.set(value.id);

    const isSameField = this._field?.id === value.id;

    if (!isSameField) {
      this.overlayService.close();
      this.skipFieldReinitialize = false;
      this.assignField(value);
      this.initializeSelectOptionsState(this._field);
      return;
    }

    // Same field echoed from parent after onChange(). Only refresh local model —
    // never re-run select option normalize/sync/load. Re-init here re-triggers
    // Value <select> ngModel and dynamic option sync → NG0103 in Form Template.
    this.skipFieldReinitialize = false;
    this.assignField(value);
  }

  get field(): FormField | undefined {
    return this._field;
  }

  private _field!: FormField;
  conditionEditor: FieldConditionalLogic = createEmptyConditionalLogic();
  private placeholderManuallyEdited = false;
  private skipFieldReinitialize = false;
  private modulesLoaded = false;
  private modulesLoadPending = false;
  private modulesLoadCallbacks: Array<() => void> = [];
  private loadingModuleSlug: string | null = null;
  private apiLoadingCount = 0;
  private readonly moduleDataBySlug = new Map<string, ModuleDataCache>();
  private readonly relatedPropertyCache = new Map<string, ModuleColumnOption[]>();
  private readonly relatedRecordsCache = new Map<string, Record<string, unknown>[]>();
  private readonly relatedPropertyLoading = new Set<string>();

  optionsMode: SelectOptionsMode = 'static';
  availableModules: FormModuleListItem[] = [];
  selectedModuleSlug = '';
  /** Resolved display label key (`name` or dynamic field id). */
  selectedDisplayColumn = DYNAMIC_SELECT_LABEL_KEY;
  moduleRecords: Record<string, unknown>[] = [];
  moduleColumns: ModuleColumnOption[] = [];
  /** All records from the selected module with resolved display labels. */
  availableDynamicOptions: FieldOption[] = [];
  dynamicOptionsSearchQuery = '';

  modulesLoading = false;
  modulesError: string | null = null;
  recordsLoading = false;

  @Output() update = new EventEmitter<FormField>();
  @Output() duplicate = new EventEmitter<void>();
  @Output() delete = new EventEmitter<void>();
  @Output() loadingChange = new EventEmitter<boolean>();

  constructor(
    private dynamicModuleOptionsService: DynamicModuleOptionsService,
    private formImageUploadService: FormImageUploadService,
  ) {}

  referenceImagesUploading = false;
  referencePreviewUrl: string | null = null;

  onChange(): void {
    if (!this._field || !this.isFieldEditable) {
      return;
    }

    // Parent rebinds `[field]` with a new object. Skip select option re-init on
    // that echo so static normalize / dynamic sync cannot emit again in the same
    // refresh cycle (NG0103 in Form Template Select customization).
    this.skipFieldReinitialize = true;

    this.update.emit({
      ...this._field,
      isShow: this._field.isShow !== false,
      isReadonly: this._field.isReadonly === true,
      defaultValue: this._field.defaultValue,
      options: [...(this._field.options || [])],
      optionSource: this.resolveEmittedOptionSource(),
      referenceImages:
        this._field.type === 'image'
          ? cloneImageFiles(this._field.referenceImages)
          : undefined,
      multiple: this._field.type === 'image' ? this._field.multiple === true : undefined,
      minFiles: this._field.type === 'image' ? this._field.minFiles : undefined,
      maxFiles: this._field.type === 'image' ? this._field.maxFiles : undefined,
      selectionType:
        this._field.type === 'select'
          ? this.resolveSelectSelectionType(this._field)
          : undefined,
      condition: serializeConditionalLogic(this.conditionEditor),
    });
  }

  onLabelChange(): void {
    if (!this._field || !this.isFieldEditable) {
      return;
    }

    if (
      !this.placeholderManuallyEdited &&
      supportsPlaceholderAutoGeneration(this._field.type)
    ) {
      this._field.placeholder = buildPlaceholderFromLabel(this._field.label);
    }

    this.onChange();
  }

  onPlaceholderChange(): void {
    if (!this._field || !this.isFieldEditable) {
      return;
    }

    this.placeholderManuallyEdited = !this.isAutoGeneratedPlaceholder(this._field);
    this.onChange();
  }

  private isAutoGeneratedPlaceholder(field: FormField): boolean {
    if (!supportsPlaceholderAutoGeneration(field.type)) {
      return false;
    }

    const placeholder = (field.placeholder ?? '').trim();
    return !placeholder || placeholder === buildPlaceholderFromLabel(field.label);
  }

  onShowChange(show: boolean): void {
    if (!this._field || !this.isFieldEditable) {
      return;
    }

    this._field.isShow = show;
    this.onChange();
  }

  onAllowDecimalChange(allow: boolean): void {
    if (!this._field || !this.isFieldEditable || !this.isNumberField) {
      return;
    }

    this._field.allowDecimal = allow === true;
    this.onChange();
  }

  onReadonlyChange(readonly: boolean): void {
    if (!this._field || !this.isFieldEditable) {
      return;
    }

    const next = readonly === true;
    if (this._field.isReadonly === next) {
      return;
    }

    this._field.isReadonly = next;
    this.onChange();
  }

  get supportsCharacterLimit(): boolean {
    return fieldSupportsCharacterLimit(this._field?.type);
  }

  get defaultCharacterLimit(): number {
    return getDefaultCharacterLimit(this._field?.type === 'textarea' ? 'textarea' : 'text');
  }

  get characterLimitValue(): number {
    if (!this._field || !this.supportsCharacterLimit) {
      return this.defaultCharacterLimit;
    }

    return (
      resolveCharacterLimit(this._field.type, this._field.characterLimit) ??
      this.defaultCharacterLimit
    );
  }

  onCharacterLimitChange(value: unknown): void {
    if (!this._field || !this.isFieldEditable || !this.supportsCharacterLimit) {
      return;
    }

    if (isCharacterLimitAboveMaximum(this._field.type, value)) {
      this.toastr.warning(getCharacterLimitExceededMessage(this._field.type));
    }

    this._field.characterLimit = resolveCharacterLimit(this._field.type, value);
    this.onChange();
  }

  get isFieldHidden(): boolean {
    return this._field?.isShow === false;
  }

  get isFieldEditable(): boolean {
    return this._field?.isEditable !== false;
  }

  get isSelectField(): boolean {
    return this._field?.type === 'select';
  }

  get isImageField(): boolean {
    return this._field?.type === 'image';
  }

  get imageAcceptAttribute(): string {
    return IMAGE_ACCEPT_ATTRIBUTE;
  }

  get referenceImages(): ImageFile[] {
    return this._field?.referenceImages || [];
  }

  get imageMultiple(): boolean {
    return this._field ? readImageMultiple(this._field) : false;
  }

  get imageMinFiles(): number {
    return this._field ? resolveMinFiles(this._field) : 0;
  }

  get imageMaxFiles(): number {
    return this._field ? resolveMaxFiles(this._field) : 1;
  }

  get canAddMoreReferenceImages(): boolean {
    if (!this._field || !this.isImageField) {
      return false;
    }
    if (!this.imageMultiple) {
      return this.referenceImages.length < 1;
    }
    return this.referenceImages.length < resolveMaxFiles(this._field);
  }

  onImageMultipleChange(checked: boolean): void {
    if (!this._field || !this.isFieldEditable || !this.isImageField) {
      return;
    }

    this._field.multiple = checked === true;
    if (!this._field.multiple) {
      this._field.maxFiles = 1;
      if ((this._field.minFiles ?? 0) > 1) {
        this._field.minFiles = 1;
      }
      if ((this._field.referenceImages?.length ?? 0) > 1) {
        this._field.referenceImages = cloneImageFiles(
          this._field.referenceImages?.slice(0, 1),
        );
      }
    } else if (!this._field.maxFiles || this._field.maxFiles < 2) {
      this._field.maxFiles = 5;
    }

    this.onChange();
  }

  onImageMinFilesChange(raw: string | number): void {
    if (!this._field || !this.isFieldEditable || !this.isImageField) {
      return;
    }

    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) {
      this._field.minFiles = undefined;
      this.onChange();
      return;
    }

    const minFiles = Math.floor(parsed);
    const maxFiles = resolveMaxFiles(this._field);
    this._field.minFiles = Math.min(minFiles, maxFiles);
    this.onChange();
  }

  onImageMaxFilesChange(raw: string | number): void {
    if (!this._field || !this.isFieldEditable || !this.isImageField) {
      return;
    }

    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 1) {
      this._field.maxFiles = this.imageMultiple ? 5 : 1;
      this.onChange();
      return;
    }

    const maxFiles = Math.floor(parsed);
    this._field.maxFiles = this.imageMultiple ? Math.max(1, maxFiles) : 1;
    if ((this._field.minFiles ?? 0) > this._field.maxFiles) {
      this._field.minFiles = this._field.maxFiles;
    }
    this.onChange();
  }

  onReferenceImagesSelected(event: Event): void {
    if (!this._field || !this.isFieldEditable || !this.isImageField || this.referenceImagesUploading) {
      return;
    }

    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    input.value = '';

    if (!files.length) {
      return;
    }

    const remaining = this.imageMultiple
      ? Math.max(0, resolveMaxFiles(this._field) - this.referenceImages.length)
      : Math.max(0, 1 - this.referenceImages.length);

    if (remaining <= 0) {
      this.toastr.warning('Maximum reference images reached.');
      return;
    }

    const selected = files.slice(0, remaining);
    if (files.length > remaining) {
      this.toastr.warning(
        `Only ${remaining} more reference image${remaining === 1 ? '' : 's'} can be added.`,
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

    this.referenceImagesUploading = true;

    forkJoin(
      validFiles.map((file) =>
        this.formImageUploadService.upload(file, 'reference').pipe(
          catchError((err) => {
            this.toastr.error(
              err?.error?.message || err?.message || 'Failed to upload reference image.',
            );
            return of(null);
          }),
        ),
      ),
    ).subscribe({
      next: (results) => {
        const uploaded = results.filter((item): item is ImageFile => !!item);
        if (uploaded.length && this._field) {
          this._field.referenceImages = [
            ...cloneImageFiles(this._field.referenceImages),
            ...uploaded,
          ];
          this.onChange();
        }
      },
      complete: () => {
        this.referenceImagesUploading = false;
      },
    });
  }

  removeReferenceImage(index: number): void {
    if (!this._field || !this.isFieldEditable || !this.isImageField) {
      return;
    }

    const next = cloneImageFiles(this._field.referenceImages);
    if (index < 0 || index >= next.length) {
      return;
    }

    const [removed] = next.splice(index, 1);
    const applyLocalRemove = () => {
      if (!this._field) {
        return;
      }
      this._field.referenceImages = next;
      this.onChange();
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
          err?.error?.message || err?.message || 'Failed to delete reference image.',
        );
      },
    });
  }

  getImageDisplayUrl(image: ImageFile): string {
    return resolveImageDisplayUrl(image);
  }

  openReferencePreview(image: ImageFile | string): void {
    const url =
      typeof image === 'string' ? image : resolveImageDisplayUrl(image);
    this.referencePreviewUrl = url || null;
  }

  closeReferencePreview(): void {
    this.referencePreviewUrl = null;
  }

  /**
   * Selection Type (Single/Multi) — setup Form Builders (users/items/vendors)
   * and Extra Management Form Module (`dynamic-forms`).
   */
  get supportsSelectSelectionType(): boolean {
    if (!this.isSelectField) {
      return false;
    }

    const moduleName = (this.activeModuleName || '').trim().toLowerCase();
    return (
      moduleName === 'users' ||
      moduleName === 'items' ||
      moduleName === 'vendors' ||
      moduleName === 'dynamic-forms'
    );
  }

  /** Countries / States / Cities: Multi is hidden; only Single is allowed. */
  get isMultiSelectionTypeHidden(): boolean {
    return (
      this.optionsMode === 'dynamic' &&
      isMultiSelectionTypeHiddenForModule(this.selectedModuleSlug)
    );
  }

  get selectionType(): 'single' | 'multi' {
    if (!this._field) {
      return 'single';
    }

    return this.resolveSelectSelectionType(this._field);
  }

  setSelectionType(type: 'single' | 'multi'): void {
    if (!this._field || !this.isFieldEditable || !this.supportsSelectSelectionType) {
      return;
    }

    if (type === 'multi' && this.isMultiSelectionTypeHidden) {
      return;
    }

    this._field.selectionType = type;
    this.skipFieldReinitialize = true;
    this.onChange();
  }

  private resolveSelectSelectionType(
    field: FormField
  ): 'single' | 'multi' {
    const moduleSlug =
      field.optionSource?.type === 'dynamic'
        ? field.optionSource.endpoint
        : this.selectedModuleSlug;

    if (
      (this.optionsMode === 'dynamic' || field.optionSource?.type === 'dynamic') &&
      isMultiSelectionTypeHiddenForModule(moduleSlug)
    ) {
      return 'single';
    }

    return field.selectionType === 'multi' ? 'multi' : 'single';
  }

  get isNumberField(): boolean {
    return this._field?.type === 'number';
  }

  get isRatingField(): boolean {
    return this._field?.type === 'rating';
  }

  get isTimeField(): boolean {
    return this._field?.type === 'time';
  }

  get isMeasurementField(): boolean {
    return isMeasurementFieldType(this._field?.type);
  }

  get measurementUnitModeValue(): MeasurementUnitMode {
    return normalizeMeasurementUnitMode(this._field?.unitMode);
  }

  get measurementUnits(): MeasurementUnit[] {
    if (!isMeasurementFieldType(this._field?.type)) {
      return [];
    }
    return [...getUnitsForFieldType(this._field.type)];
  }

  get measurementUnitLabel(): string {
    switch (this._field?.type) {
      case 'price':
        return 'Currency';
      case 'length':
        return 'Length Unit';
      case 'mass':
        return 'Mass Unit';
      case 'volume':
        return 'Volume Unit';
      case 'temperature':
        return 'Temperature Unit';
      default:
        return 'Unit';
    }
  }

  get isRangeField(): boolean {
    return this._field?.type === 'range';
  }

  get isDateField(): boolean {
    return this._field?.type === 'date';
  }

  get rangeTypeValue(): RangeFieldType {
    return normalizeRangeType(this._field?.rangeType);
  }

  get isNumberRange(): boolean {
    return this.isRangeField && this.rangeTypeValue === 'number';
  }

  get isDateRange(): boolean {
    return this.isRangeField && this.rangeTypeValue === 'date';
  }

  get isTimeRange(): boolean {
    return this.isRangeField && this.rangeTypeValue === 'time';
  }

  get isTextareaField(): boolean {
    return this._field?.type === 'textarea';
  }

  get isRadioField(): boolean {
    return this._field?.type === 'radio';
  }

  get isCheckboxField(): boolean {
    return this._field?.type === 'checkbox';
  }

  get isTextLikeValueField(): boolean {
    const type = this._field?.type;
    return (
      type === 'text' ||
      type === 'email' ||
      type === 'barcode' ||
      type === 'qr-code'
    );
  }

  get supportsConfiguredValue(): boolean {
    if (!this._field) {
      return false;
    }
    // Image / signature / file have no Value configuration (file may appear via fieldTypeName).
    const type = String(this._field.type);
    const typeName = String(this._field.fieldTypeName ?? '').toLowerCase();
    return !(
      type === 'image' ||
      type === 'signature' ||
      type === 'file' ||
      typeName === 'file' ||
      typeName === 'image' ||
      typeName === 'signature'
    );
  }

  get isStaticOptionValueField(): boolean {
    return (
      (this.isSelectField && this.optionsMode === 'static') ||
      this.isRadioField ||
      this.isCheckboxField
    );
  }

  get supportsCurrentUserValue(): boolean {
    return !!this._field && supportsCurrentUserDefault(this._field);
  }

  readonly currentUserDefaultToken = CURRENT_USER_DEFAULT_TOKEN;

  get configuredDefaultValue(): unknown {
    return this._field?.defaultValue ?? '';
  }

  get configuredValueText(): string {
    const value = this._field?.defaultValue;
    if (value == null || value === '') {
      return '';
    }
    if (typeof value === 'object') {
      return '';
    }
    return String(value);
  }

  get staticValueOptions(): Array<{ label: string; value: string | number }> {
    return (this._field?.options || [])
      .map((option, index) => {
        if (typeof option === 'string' || typeof option === 'number') {
          return { label: String(option), value: option };
        }
        const normalized = normalizeFieldOption(option);
        if (!normalized) {
          return null;
        }
        return {
          label: normalized.label,
          value: normalized.value ?? index,
        };
      })
      .filter((option): option is { label: string; value: string | number } => !!option);
  }

  get configuredRangeFrom(): string {
    const range = normalizeRangeValue(this._field?.defaultValue);
    return range.from == null || range.from === '' ? '' : String(range.from);
  }

  get configuredRangeTo(): string {
    const range = normalizeRangeValue(this._field?.defaultValue);
    return range.to == null || range.to === '' ? '' : String(range.to);
  }

  get configuredMeasurementAmount(): string {
    if (!this._field || !isMeasurementFieldType(this._field.type)) {
      return '';
    }
    const current = normalizeMeasurementValue(this._field.defaultValue, this._field.type, {
      unitMode: normalizeMeasurementUnitMode(this._field.unitMode),
      unit: this._field.unit,
    });
    return current.value == null ? '' : String(current.value);
  }

  onConfiguredDefaultValueChange(value: unknown): void {
    if (!this._field || !this.isFieldEditable || !this.supportsConfiguredValue) {
      return;
    }

    // Native <select> always yields strings — restore option typing when possible.
    let next: unknown = value ?? '';
    if (typeof next === 'string' && next !== '' && next !== this.currentUserDefaultToken) {
      const matched =
        this.staticValueOptions.find((option) => String(option.value) === next) ??
        this.configuredDynamicValueOptions.find((option) => String(option.value) === next);
      if (matched) {
        next = matched.value;
      }
    }

    if (this.configuredValuesEqual(this._field.defaultValue, next)) {
      return;
    }
    this._field.defaultValue = next;
    this.onChange();
  }

  onConfiguredValueTextChange(value: string | number): void {
    if (!this._field || !this.isFieldEditable || !this.supportsConfiguredValue) {
      return;
    }
    const next = value == null ? '' : value;
    if (this.configuredValuesEqual(this._field.defaultValue, next)) {
      return;
    }
    this._field.defaultValue = next;
    this.onChange();
  }

  isConfiguredMultiValueSelected(optionValue: string | number): boolean {
    const current = this._field?.defaultValue;
    if (!Array.isArray(current)) {
      return String(current ?? '') === String(optionValue);
    }
    return current.some((item) => String(item) === String(optionValue));
  }

  toggleConfiguredMultiValue(optionValue: string | number, checked: boolean): void {
    if (!this._field || !this.isFieldEditable || !this.supportsConfiguredValue) {
      return;
    }

    const current = Array.isArray(this._field.defaultValue)
      ? [...this._field.defaultValue]
      : [];

    const next = checked
      ? current.some((item) => String(item) === String(optionValue))
        ? current
        : [...current, optionValue]
      : current.filter((item) => String(item) !== String(optionValue));

    if (this.configuredValuesEqual(this._field.defaultValue, next)) {
      return;
    }

    this._field.defaultValue = next;
    this.onChange();
  }

  onConfiguredRangeSideChange(side: 'from' | 'to', raw: string | number): void {
    if (!this._field || !this.isFieldEditable || !this.isRangeField) {
      return;
    }

    const current = normalizeRangeValue(this._field.defaultValue);
    let nextSide: string | number | null =
      raw === '' || raw == null ? null : raw;

    if (this.isNumberRange && typeof nextSide === 'string') {
      const parsed = Number(nextSide);
      nextSide = nextSide.trim() === '' || !Number.isFinite(parsed) ? null : parsed;
    }

    const next = {
      ...current,
      [side]: nextSide,
    };

    const nextDefault =
      (next.from == null || next.from === '') && (next.to == null || next.to === '')
        ? ''
        : next;

    if (this.configuredValuesEqual(this._field.defaultValue, nextDefault)) {
      return;
    }

    this._field.defaultValue = nextDefault;
    this.onChange();
  }

  onConfiguredMeasurementAmountChange(raw: string | number): void {
    if (!this._field || !this.isFieldEditable || !isMeasurementFieldType(this._field.type)) {
      return;
    }

    const current = normalizeMeasurementValue(this._field.defaultValue, this._field.type, {
      unitMode: normalizeMeasurementUnitMode(this._field.unitMode),
      unit: this._field.unit,
    });

    const text = String(raw ?? '').trim();
    const amount = text === '' ? null : Number(text);
    const unit =
      current.unit ??
      normalizeMeasurementUnitCode(this._field.type, this._field.unit) ??
      getDefaultUnitCode(this._field.type);

    const nextDefault =
      amount == null || !Number.isFinite(amount)
        ? ''
        : {
            value: amount,
            unit,
          };

    if (this.configuredValuesEqual(this._field.defaultValue, nextDefault)) {
      return;
    }

    this._field.defaultValue = nextDefault;
    this.onChange();
  }

  /** Prevent Value ngModel echo writes from re-emitting identical configuration. */
  private configuredValuesEqual(left: unknown, right: unknown): boolean {
    if (Object.is(left, right)) {
      return true;
    }

    if (left == null || left === '' || right == null || right === '') {
      const leftEmpty = left == null || left === '';
      const rightEmpty = right == null || right === '';
      return leftEmpty && rightEmpty;
    }

    if (Array.isArray(left) || Array.isArray(right)) {
      if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
        return false;
      }
      return left.every((item, index) => String(item) === String(right[index]));
    }

    if (typeof left === 'object' || typeof right === 'object') {
      try {
        return JSON.stringify(left) === JSON.stringify(right);
      } catch {
        return false;
      }
    }

    return String(left) === String(right);
  }

  get rangeStepValue(): number {
    const step = Number(this._field?.rangeStep);
    return Number.isFinite(step) && step > 0 ? step : DEFAULT_RANGE_STEP;
  }

  get timeFormatValue(): RangeTimeFormat {
    if (this.isTimeField) {
      return normalizeTimeFieldFormat(this._field?.timeFormat);
    }
    return normalizeRangeTimeFormat(this._field?.timeFormat);
  }

  onRangeTypeChange(type: string): void {
    if (!this._field || !this.isFieldEditable || !this.isRangeField) {
      return;
    }

    resetRangeTypeSpecificConfig(this._field, normalizeRangeType(type));
    this.onChange();
  }

  onRangeMinChange(value: unknown): void {
    if (!this._field || !this.isFieldEditable || !this.isNumberRange) {
      return;
    }

    const bounds = sanitizeRangeBounds(value, this._field.rangeMax);
    if (bounds.swapped) {
      this.toastr.warning('Minimum value cannot be greater than Maximum value.');
    }
    this._field.rangeMin = bounds.rangeMin;
    this._field.rangeMax = bounds.rangeMax;
    this.onChange();
  }

  onRangeMaxChange(value: unknown): void {
    if (!this._field || !this.isFieldEditable || !this.isNumberRange) {
      return;
    }

    const bounds = sanitizeRangeBounds(this._field.rangeMin, value);
    if (bounds.swapped) {
      this.toastr.warning('Minimum value cannot be greater than Maximum value.');
    }
    this._field.rangeMin = bounds.rangeMin;
    this._field.rangeMax = bounds.rangeMax;
    this.onChange();
  }

  onRangeStepChange(value: unknown): void {
    if (!this._field || !this.isFieldEditable || !this.isNumberRange) {
      return;
    }

    const step = Number(value);
    if (!Number.isFinite(step) || step <= 0) {
      this.toastr.warning('Step must be a positive number.');
      this._field.rangeStep = DEFAULT_RANGE_STEP;
    } else {
      this._field.rangeStep = step;
    }
    this.onChange();
  }

  onRangeAllowDecimalChange(allow: boolean): void {
    if (!this._field || !this.isFieldEditable || !this.isNumberRange) {
      return;
    }

    this._field.allowDecimal = allow === true;
    this.onChange();
  }

  onRangePlaceholderFromChange(value: string): void {
    if (!this._field || !this.isFieldEditable || !this.isRangeField) {
      return;
    }

    this._field.rangePlaceholderFrom = value ?? '';
    this.onChange();
  }

  onRangePlaceholderToChange(value: string): void {
    if (!this._field || !this.isFieldEditable || !this.isRangeField) {
      return;
    }

    this._field.rangePlaceholderTo = value ?? '';
    this.onChange();
  }

  onRangeMinDateChange(value: string): void {
    if (!this._field || !this.isFieldEditable || !this.isDateRange) {
      return;
    }

    const bounds = sanitizeDateBounds(value || undefined, this._field.rangeMaxDate);
    if (bounds.swapped) {
      this.toastr.warning('Minimum date cannot be later than maximum date.');
    }
    this._field.rangeMinDate = bounds.rangeMinDate;
    this._field.rangeMaxDate = bounds.rangeMaxDate;
    this.onChange();
  }

  onRangeMaxDateChange(value: string): void {
    if (!this._field || !this.isFieldEditable || !this.isDateRange) {
      return;
    }

    const bounds = sanitizeDateBounds(this._field.rangeMinDate, value || undefined);
    if (bounds.swapped) {
      this.toastr.warning('Minimum date cannot be later than maximum date.');
    }
    this._field.rangeMinDate = bounds.rangeMinDate;
    this._field.rangeMaxDate = bounds.rangeMaxDate;
    this.onChange();
  }

  onDateMinDateChange(value: string): void {
    if (!this._field || !this.isFieldEditable || !this.isDateField) {
      return;
    }

    const bounds = sanitizeDateBounds(value || undefined, this._field.maxDate);
    if (bounds.swapped) {
      this.toastr.warning('Minimum date cannot be later than maximum date.');
    }
    this._field.minDate = bounds.rangeMinDate;
    this._field.maxDate = bounds.rangeMaxDate;
    this.onChange();
  }

  onDateMaxDateChange(value: string): void {
    if (!this._field || !this.isFieldEditable || !this.isDateField) {
      return;
    }

    const bounds = sanitizeDateBounds(this._field.minDate, value || undefined);
    if (bounds.swapped) {
      this.toastr.warning('Minimum date cannot be later than maximum date.');
    }
    this._field.minDate = bounds.rangeMinDate;
    this._field.maxDate = bounds.rangeMaxDate;
    this.onChange();
  }

  onTimeFormatChange(value: string): void {
    if (!this._field || !this.isFieldEditable || (!this.isTimeRange && !this.isTimeField)) {
      return;
    }

    this._field.timeFormat = this.isTimeField
      ? normalizeTimeFieldFormat(value)
      : normalizeRangeTimeFormat(value);
    this.onChange();
  }

  onMeasurementUnitModeChange(mode: MeasurementUnitMode | string): void {
    if (!this._field || !this.isFieldEditable || !this.isMeasurementField) {
      return;
    }

    this._field.unitMode = normalizeMeasurementUnitMode(mode);
    if (!this._field.unit && isMeasurementFieldType(this._field.type)) {
      this._field.unit = getDefaultUnitCode(this._field.type);
    }
    this.onChange();
  }

  onMeasurementUnitChange(code: string): void {
    if (!this._field || !this.isFieldEditable || !this.isMeasurementField) {
      return;
    }
    if (!isMeasurementFieldType(this._field.type)) {
      return;
    }

    this._field.unit =
      normalizeMeasurementUnitCode(this._field.type, code) ??
      getDefaultUnitCode(this._field.type);
    this.onChange();
  }

  onMeasurementMinValueChange(raw: string | number): void {
    if (!this._field || !this.isFieldEditable || !this.isMeasurementField) {
      return;
    }

    const numeric = typeof raw === 'number' ? raw : Number(String(raw).trim());
    let min = Number.isFinite(numeric) ? numeric : 0;
    const max =
      this._field.maxValue != null && Number.isFinite(Number(this._field.maxValue))
        ? Number(this._field.maxValue)
        : null;

    if (max != null && min > max) {
      this.toastr.warning('Minimum cannot be greater than maximum.');
      min = max;
    }

    this._field.minValue = min;
    this.onChange();
  }

  onMeasurementMaxValueChange(raw: string | number): void {
    if (!this._field || !this.isFieldEditable || !this.isMeasurementField) {
      return;
    }

    const trimmed = String(raw ?? '').trim();
    if (trimmed === '') {
      this._field.maxValue = undefined;
      this.onChange();
      return;
    }

    const numeric = typeof raw === 'number' ? raw : Number(trimmed);
    if (!Number.isFinite(numeric)) {
      this._field.maxValue = undefined;
      this.onChange();
      return;
    }

    let max = numeric;
    const min =
      this._field.minValue != null && Number.isFinite(Number(this._field.minValue))
        ? Number(this._field.minValue)
        : 0;

    if (max < min) {
      this.toastr.warning('Maximum cannot be less than minimum.');
      max = min;
    }

    this._field.maxValue = max;
    this.onChange();
  }

  readonly conditionOperators = CONDITION_OPERATORS.map(value => ({
    value,
    label: CONDITION_OPERATOR_LABELS[value],
  }));

  readonly valueSourceKinds = VALUE_SOURCE_KINDS.map(value => ({
    value,
    label: VALUE_SOURCE_KIND_LABELS[value],
  }));

  readonly expressionOps = EXPRESSION_OPS.map(value => ({
    value,
    label: EXPRESSION_OP_LABELS[value],
  }));

  get conditionActions(): Array<{ value: ConditionActionType; label: string }> {
    const actions = CONDITION_ACTIONS.map(value => ({
      value,
      label: CONDITION_ACTION_LABELS[value],
    }));

    if (!supportsSetValueFieldType(this._field?.type)) {
      return actions.filter(action => action.value !== 'setValue');
    }

    return actions;
  }

  get conditionEnabled(): boolean {
    return this.conditionEditor.enabled;
  }

  get conditionSourceFieldId(): string {
    return getPrimaryPredicate(this.conditionEditor).fieldId;
  }

  get conditionOperator(): ConditionOperator {
    return getPrimaryPredicate(this.conditionEditor).operator;
  }

  get conditionCompareValue(): unknown {
    return getPrimaryPredicate(this.conditionEditor).value ?? '';
  }

  get conditionAction(): ConditionActionType {
    return getPrimaryActionType(this.conditionEditor);
  }

  get conditionNeedsValue(): boolean {
    return operatorRequiresValue(this.conditionOperator);
  }

  get validConditionSourceFields(): FormField[] {
    if (!this._field) {
      return [];
    }

    return getValidConditionalSourceFields(this.schemaSignal(), this._field.id);
  }

  get conditionSourceField(): FormField | null {
    const sourceId = this.conditionSourceFieldId;
    if (!sourceId) {
      return null;
    }

    return this.schemaSignal().find(field => field.id === sourceId) ?? null;
  }

  get conditionSourceOptions(): Array<{ label: string; value: string | number }> {
    const source = this.conditionSourceField;
    if (!source?.options?.length) {
      return [];
    }

    return source.options
      .map((option, index) => {
        if (typeof option === 'string' || typeof option === 'number') {
          return { label: String(option), value: option };
        }

        const normalized = normalizeFieldOption(option);
        if (!normalized) {
          return null;
        }

        return {
          label: normalized.label,
          value: normalized.value ?? index,
        };
      })
      .filter((option): option is { label: string; value: string | number } => !!option);
  }

  get conditionSourceHasOptions(): boolean {
    const type = this.conditionSourceField?.type;
    return (
      (type === 'select' || type === 'radio' || type === 'checkbox') &&
      this.conditionSourceOptions.length > 0
    );
  }

  onConditionEnabledChange(enabled: boolean): void {
    if (!this._field || !this.isFieldEditable) {
      return;
    }

    this.conditionEditor = {
      ...this.conditionEditor,
      enabled,
      when: this.conditionEditor.when ?? createEmptyConditionalLogic().when,
      actions: this.conditionEditor.actions?.length
        ? this.conditionEditor.actions
        : [{ type: 'show' }],
    };
    this._field.condition = this.conditionEditor;
    if (enabled && getPrimaryActionType(this.conditionEditor) === 'setValue') {
      this.prefetchSetValueRelatedProperties();
    }
    this.onChange();
  }

  onConditionSourceChange(fieldId: string): void {
    if (!this._field || !this.isFieldEditable) {
      return;
    }

    if (
      fieldId &&
      wouldCreateCircularDependency(this._field.id, fieldId, this.schemaSignal())
    ) {
      this.toastr.warning('This source field would create a circular dependency.');
      return;
    }

    this.conditionEditor = setPrimaryPredicate(this.conditionEditor, {
      fieldId,
      value: '',
    });
    this._field.condition = this.conditionEditor;
    this.onChange();
  }

  onConditionOperatorChange(operator: ConditionOperator): void {
    if (!this._field || !this.isFieldEditable) {
      return;
    }

    this.conditionEditor = setPrimaryPredicate(this.conditionEditor, {
      operator,
      value: operatorRequiresValue(operator)
        ? getPrimaryPredicate(this.conditionEditor).value ?? ''
        : '',
    });
    this._field.condition = this.conditionEditor;
    this.onChange();
  }

  onConditionValueChange(value: unknown): void {
    if (!this._field || !this.isFieldEditable) {
      return;
    }

    this.conditionEditor = setPrimaryPredicate(this.conditionEditor, { value });
    this._field.condition = this.conditionEditor;
    this.onChange();
  }

  onConditionActionChange(type: ConditionActionType): void {
    if (!this._field || !this.isFieldEditable) {
      return;
    }

    if (type === this.conditionAction) {
      return;
    }

    if (type === 'setValue' && !supportsSetValueFieldType(this._field.type)) {
      this.toastr.warning('Set Value is not available for this field type.');
      return;
    }

    this.conditionEditor = setPrimaryActionType(this.conditionEditor, type);
    this._field.condition = this.conditionEditor;

    if (type === 'setValue') {
      this.prefetchSetValueRelatedProperties();
    }

    this.onChange();
  }

  get conditionUsesSetValue(): boolean {
    return this.conditionAction === 'setValue';
  }

  get setValueSource(): ValueSource {
    return (
      getPrimarySetValueSource(this.conditionEditor) ??
      createDefaultValueSource('relatedData')
    );
  }

  get setValueSourceKind(): ValueSourceKind {
    return this.setValueSource.kind;
  }

  get setValueFixedValue(): unknown {
    const source = this.setValueSource;
    return source.kind === 'fixed' ? (source.value ?? '') : '';
  }

  get setValueFieldId(): string {
    const source = this.setValueSource;
    return source.kind === 'field' ? source.fieldId : '';
  }

  get setValueRelatedSourceFieldId(): string {
    const source = this.setValueSource;
    return source.kind === 'relatedData' ? source.sourceFieldId : '';
  }

  get setValueRelatedProperty(): string {
    const source = this.setValueSource;
    return source.kind === 'relatedData' ? source.property : '';
  }

  get setValueExpressionOp(): ExpressionOp {
    const source = this.setValueSource;
    return source.kind === 'expression' ? source.op : 'multiply';
  }

  get setValueExpressionLeft(): ValueSource {
    const source = this.setValueSource;
    return source.kind === 'expression'
      ? source.left
      : createDefaultValueSource('relatedData');
  }

  get setValueExpressionRight(): ValueSource {
    const source = this.setValueSource;
    return source.kind === 'expression'
      ? source.right
      : createDefaultValueSource('field');
  }

  get setValueExpressionLeftKind(): ValueSourceKind {
    return this.setValueExpressionLeft.kind;
  }

  get setValueExpressionRightKind(): ValueSourceKind {
    return this.setValueExpressionRight.kind;
  }

  get setValueExpressionLeftFixedValue(): unknown {
    const source = this.setValueExpressionLeft;
    return source.kind === 'fixed' ? (source.value ?? '') : '';
  }

  get setValueExpressionRightFixedValue(): unknown {
    const source = this.setValueExpressionRight;
    return source.kind === 'fixed' ? (source.value ?? '') : '';
  }

  get setValueExpressionLeftFieldId(): string {
    const source = this.setValueExpressionLeft;
    return source.kind === 'field' ? source.fieldId : '';
  }

  get setValueExpressionRightFieldId(): string {
    const source = this.setValueExpressionRight;
    return source.kind === 'field' ? source.fieldId : '';
  }

  get setValueExpressionLeftRelatedSourceFieldId(): string {
    const source = this.setValueExpressionLeft;
    return source.kind === 'relatedData' ? source.sourceFieldId : '';
  }

  get setValueExpressionRightRelatedSourceFieldId(): string {
    const source = this.setValueExpressionRight;
    return source.kind === 'relatedData' ? source.sourceFieldId : '';
  }

  get setValueExpressionLeftRelatedProperty(): string {
    const source = this.setValueExpressionLeft;
    return source.kind === 'relatedData' ? source.property : '';
  }

  get setValueExpressionRightRelatedProperty(): string {
    const source = this.setValueExpressionRight;
    return source.kind === 'relatedData' ? source.property : '';
  }

  get dynamicConditionSourceFields(): FormField[] {
    return this.schemaSignal().filter(field => {
      if (field.id === this._field?.id || field.type !== 'select') {
        return false;
      }
      const source = normalizeOptionSource(field.optionSource);
      return source?.type === 'dynamic' && !!source.endpoint;
    });
  }

  get setValueFormFields(): FormField[] {
    if (!this._field) {
      return [];
    }

    return this.schemaSignal().filter(field => {
      if (field.id === this._field.id) {
        return false;
      }
      if (!isCompatibleSetValueSourceField(this._field, field)) {
        return false;
      }
      if (
        wouldCreateCircularDependency(this._field.id, field.id, this.schemaSignal())
      ) {
        return false;
      }
      return true;
    });
  }

  relatedPropertiesFor(sourceFieldId: string | null | undefined): ModuleColumnOption[] {
    if (!sourceFieldId) {
      return [];
    }
    const columns = this.relatedPropertyCache.get(sourceFieldId) ?? [];
    const records = this.relatedRecordsCache.get(sourceFieldId) ?? [];
    const targetKind = resolveSetValueFieldKind(this._field);
    return filterRelatedPropertiesForTargetKind(columns, records, targetKind);
  }

  isRelatedPropertiesLoading(sourceFieldId: string | null | undefined): boolean {
    return !!sourceFieldId && this.relatedPropertyLoading.has(sourceFieldId);
  }

  onSetValueSourceKindChange(kind: ValueSourceKind): void {
    if (!this._field || !this.isFieldEditable || !this.conditionUsesSetValue) {
      return;
    }

    if (kind === this.setValueSourceKind) {
      return;
    }

    this.patchSetValueSource(createDefaultValueSource(kind));
  }

  onSetValueFixedValueChange(value: unknown): void {
    if (!this._field || !this.isFieldEditable || !this.conditionUsesSetValue) {
      return;
    }

    this.patchSetValueSource({ kind: 'fixed', value });
  }

  onSetValueFieldChange(fieldId: string): void {
    if (!this._field || !this.isFieldEditable || !this.conditionUsesSetValue) {
      return;
    }

    if (
      fieldId &&
      wouldCreateCircularDependency(this._field.id, fieldId, this.schemaSignal())
    ) {
      this.toastr.warning('This field would create a circular dependency.');
      return;
    }

    this.patchSetValueSource({ kind: 'field', fieldId });
  }

  onSetValueRelatedSourceChange(sourceFieldId: string): void {
    if (!this._field || !this.isFieldEditable || !this.conditionUsesSetValue) {
      return;
    }

    this.patchSetValueSource({
      kind: 'relatedData',
      sourceFieldId,
      property: '',
    });

    if (sourceFieldId) {
      this.loadRelatedProperties(sourceFieldId);
    }
  }

  onSetValueRelatedPropertyChange(property: string): void {
    if (!this._field || !this.isFieldEditable || !this.conditionUsesSetValue) {
      return;
    }

    const current = this.setValueSource;
    const sourceFieldId =
      current.kind === 'relatedData' ? current.sourceFieldId : '';

    this.patchSetValueSource({
      kind: 'relatedData',
      sourceFieldId,
      property,
    });
  }

  onSetValueExpressionOpChange(op: ExpressionOp): void {
    if (!this._field || !this.isFieldEditable || !this.conditionUsesSetValue) {
      return;
    }

    const current = this.setValueSource;
    if (current.kind !== 'expression') {
      return;
    }

    this.patchSetValueSource({
      ...current,
      op,
    });
  }

  onSetValueExpressionSideKindChange(
    side: 'left' | 'right',
    kind: ValueSourceKind,
  ): void {
    if (!this._field || !this.isFieldEditable || !this.conditionUsesSetValue) {
      return;
    }

    if (kind === 'expression') {
      return;
    }

    const current = this.setValueSource;
    if (current.kind !== 'expression') {
      return;
    }

    const nextSide = createDefaultValueSource(kind);
    this.patchSetValueSource({
      ...current,
      left: side === 'left' ? nextSide : current.left,
      right: side === 'right' ? nextSide : current.right,
    });
  }

  onSetValueExpressionSideFieldChange(side: 'left' | 'right', fieldId: string): void {
    if (!this._field || !this.isFieldEditable || !this.conditionUsesSetValue) {
      return;
    }

    if (
      fieldId &&
      wouldCreateCircularDependency(this._field.id, fieldId, this.schemaSignal())
    ) {
      this.toastr.warning('This field would create a circular dependency.');
      return;
    }

    const current = this.setValueSource;
    if (current.kind !== 'expression') {
      return;
    }

    const nextSide: ValueSource = { kind: 'field', fieldId };
    this.patchSetValueSource({
      ...current,
      left: side === 'left' ? nextSide : current.left,
      right: side === 'right' ? nextSide : current.right,
    });
  }

  onSetValueExpressionSideFixedChange(side: 'left' | 'right', value: unknown): void {
    if (!this._field || !this.isFieldEditable || !this.conditionUsesSetValue) {
      return;
    }

    const current = this.setValueSource;
    if (current.kind !== 'expression') {
      return;
    }

    const nextSide: ValueSource = { kind: 'fixed', value };
    this.patchSetValueSource({
      ...current,
      left: side === 'left' ? nextSide : current.left,
      right: side === 'right' ? nextSide : current.right,
    });
  }

  onSetValueExpressionSideRelatedSourceChange(
    side: 'left' | 'right',
    sourceFieldId: string,
  ): void {
    if (!this._field || !this.isFieldEditable || !this.conditionUsesSetValue) {
      return;
    }

    const current = this.setValueSource;
    if (current.kind !== 'expression') {
      return;
    }

    const nextSide: ValueSource = {
      kind: 'relatedData',
      sourceFieldId,
      property: '',
    };
    this.patchSetValueSource({
      ...current,
      left: side === 'left' ? nextSide : current.left,
      right: side === 'right' ? nextSide : current.right,
    });

    if (sourceFieldId) {
      this.loadRelatedProperties(sourceFieldId);
    }
  }

  onSetValueExpressionSideRelatedPropertyChange(
    side: 'left' | 'right',
    property: string,
  ): void {
    if (!this._field || !this.isFieldEditable || !this.conditionUsesSetValue) {
      return;
    }

    const current = this.setValueSource;
    if (current.kind !== 'expression') {
      return;
    }

    const existing = side === 'left' ? current.left : current.right;
    const sourceFieldId =
      existing.kind === 'relatedData' ? existing.sourceFieldId : '';

    const nextSide: ValueSource = {
      kind: 'relatedData',
      sourceFieldId,
      property,
    };
    this.patchSetValueSource({
      ...current,
      left: side === 'left' ? nextSide : current.left,
      right: side === 'right' ? nextSide : current.right,
    });
  }

  operandSourceKinds(
    _side: 'left' | 'right',
  ): Array<{ value: ValueSourceKind; label: string }> {
    return this.valueSourceKinds.filter(option => option.value !== 'expression');
  }

  private patchSetValueSource(source: ValueSource): void {
    if (!this._field) {
      return;
    }

    const nextSource = normalizeValueSource(source);
    const currentSource = getPrimarySetValueSource(this.conditionEditor);
    if (
      currentSource &&
      JSON.stringify(currentSource) === JSON.stringify(nextSource)
    ) {
      return;
    }

    this.conditionEditor = setPrimarySetValueSource(this.conditionEditor, nextSource);
    this._field.condition = this.conditionEditor;
    this.onChange();
  }

  private prefetchSetValueRelatedProperties(): void {
    const source = getPrimarySetValueSource(this.conditionEditor);
    if (!source) {
      return;
    }

    for (const fieldId of collectValueSourceFieldIds(source)) {
      const field = this.schemaSignal().find(item => item.id === fieldId);
      if (!field) {
        continue;
      }
      const optionSource = normalizeOptionSource(field.optionSource);
      if (optionSource?.type === 'dynamic' && optionSource.endpoint) {
        this.loadRelatedProperties(fieldId);
      }
    }

    // Also prefetch explicit relatedData endpoints from expression sides.
    const visit = (value: ValueSource | null | undefined): void => {
      if (!value) {
        return;
      }
      if (value.kind === 'relatedData' && value.sourceFieldId) {
        this.loadRelatedProperties(value.sourceFieldId);
      }
      if (value.kind === 'expression') {
        visit(value.left);
        visit(value.right);
      }
    };
    visit(source);
  }

  private loadRelatedProperties(sourceFieldId: string): void {
    if (!sourceFieldId) {
      return;
    }
    if (
      this.relatedPropertyCache.has(sourceFieldId) ||
      this.relatedPropertyLoading.has(sourceFieldId)
    ) {
      return;
    }

    const field = this.schemaSignal().find(item => item.id === sourceFieldId);
    if (!field) {
      return;
    }

    const optionSource = normalizeOptionSource(field.optionSource);
    const endpoint = optionSource?.endpoint?.trim() || '';
    if (!endpoint) {
      this.relatedPropertyCache.set(sourceFieldId, []);
      return;
    }

    this.relatedPropertyLoading.add(sourceFieldId);
    this.dynamicModuleOptionsService.getModuleData(endpoint).subscribe({
      next: data => {
        this.relatedPropertyLoading.delete(sourceFieldId);
        this.relatedPropertyCache.set(sourceFieldId, data.columns || []);
        this.relatedRecordsCache.set(sourceFieldId, data.records || []);
      },
      error: () => {
        this.relatedPropertyLoading.delete(sourceFieldId);
        this.relatedPropertyCache.set(sourceFieldId, []);
        this.relatedRecordsCache.set(sourceFieldId, []);
      },
    });
  }

  get dynamicOptionsCount(): number {
    return this.optionsMode === 'dynamic' ? this._field?.options?.length ?? 0 : 0;
  }

  /** Select Options UI — hidden for Countries/States/Cities location modules. */
  get showDynamicSelectOptions(): boolean {
    return (
      this.optionsMode === 'dynamic' &&
      !!this.selectedModuleSlug &&
      !isDynamicSelectOptionsHiddenForModule(this.selectedModuleSlug)
    );
  }

  get filteredAvailableDynamicOptions(): FieldOption[] {
    const query = this.dynamicOptionsSearchQuery.trim().toLowerCase();
    if (!query) {
      return this.availableDynamicOptions;
    }

    return this.availableDynamicOptions.filter(option =>
      String(option.label ?? '')
        .toLowerCase()
        .includes(query),
    );
  }

  /** Value picker: prefer selected dynamic options; fall back to loaded module options. */
  get configuredDynamicValueOptions(): FieldOption[] {
    const selected = (this._field?.options || [])
      .map((option, index) => {
        if (typeof option === 'string' || typeof option === 'number') {
          const match = this.availableDynamicOptions.find(
            (item) => String(item.value) === String(option),
          );
          return {
            label: match?.label ?? String(option),
            value: match?.value ?? option,
          } as FieldOption;
        }
        const normalized = normalizeFieldOption(option);
        if (!normalized) {
          return null;
        }
        return {
          label: normalized.label,
          value: normalized.value ?? index,
        } as FieldOption;
      })
      .filter((option): option is FieldOption => !!option);

    if (selected.length) {
      return selected;
    }

    return this.availableDynamicOptions;
  }

  onDynamicOptionsSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.dynamicOptionsSearchQuery = input.value ?? '';
  }

  setOptionsMode(mode: SelectOptionsMode): void {
    if (!this.isFieldEditable) {
      return;
    }

    this.optionsMode = mode;
    this.overlayService.close();

    if (mode === 'dynamic') {
      this.selectedModuleSlug = '';
      this.selectedDisplayColumn = DYNAMIC_SELECT_LABEL_KEY;
      this.moduleRecords = [];
      this.moduleColumns = [];
      this.availableDynamicOptions = [];
      this.dynamicOptionsSearchQuery = '';
      this._field.options = [];
      this._field.optionSource = undefined;
      this.ensureModulesLoaded();
      return;
    }

    this.onChange();
  }

  onModuleChange(moduleSlug: string): void {
    if (!this.isFieldEditable) {
      return;
    }

    if (!moduleSlug) {
      this.selectedModuleSlug = '';
      this.selectedDisplayColumn = DYNAMIC_SELECT_LABEL_KEY;
      this.moduleRecords = [];
      this.moduleColumns = [];
      this.availableDynamicOptions = [];
      this.dynamicOptionsSearchQuery = '';
      this._field.options = [];
      this._field.optionSource = undefined;
      this.onChange();
      return;
    }

    if (this.isModuleSlugDisabled(moduleSlug)) {
      return;
    }

    this.selectedModuleSlug = moduleSlug;
    this.selectedDisplayColumn = DYNAMIC_SELECT_LABEL_KEY;
    this.moduleRecords = [];
    this.moduleColumns = [];
    this.availableDynamicOptions = [];
    this.dynamicOptionsSearchQuery = '';
    // Changing module must not retain previous module's selected options.
    this._field.options = [];
    this._field.optionSource = this.buildDynamicOptionSource();

    // Location modules only support Single — reset Multi if switching from Items/etc.
    if (isMultiSelectionTypeHiddenForModule(moduleSlug)) {
      this._field.selectionType = 'single';
    }

    this.loadModuleData(moduleSlug, {
      preserveSelection: false,
      emitUpdate: true,
    });
  }

  isModuleOptionDisabled(module: FormModuleListItem): boolean {
    return this.isModuleSlugDisabled(this.getModuleSlug(module));
  }

  private isModuleSlugDisabled(moduleSlug: string): boolean {
    if (
      this.enforceUniqueDynamicModules &&
      isUniqueDynamicModuleOptionDisabled(
        moduleSlug,
        this.schemaSignal(),
        this.selectedFieldIdSignal() ?? undefined
      )
    ) {
      return true;
    }

    const kind = resolveBuilderLocationKind(moduleSlug);

    if (kind !== 'states' && kind !== 'cities') {
      return false;
    }

    return !this.hasCountryField();
  }

  isDynamicOptionSelected(option: FieldOption): boolean {
    const selected = this._field?.options || [];
    return selected.some(
      (item) => String(this.readOptionValue(item)) === String(option.value),
    );
  }

  /** Select All reflects the currently visible (filtered) option list. */
  get isSelectAllChecked(): boolean {
    const targets = this.filteredAvailableDynamicOptions;
    return (
      targets.length > 0 &&
      targets.every((option) => this.isDynamicOptionSelected(option))
    );
  }

  get isSelectAllIndeterminate(): boolean {
    const targets = this.filteredAvailableDynamicOptions;
    if (!targets.length) {
      return false;
    }

    const selectedCount = targets.filter((option) =>
      this.isDynamicOptionSelected(option),
    ).length;

    return selectedCount > 0 && selectedCount < targets.length;
  }

  toggleSelectAllDynamicOptions(): void {
    if (
      !this._field ||
      !this.isFieldEditable ||
      !this.selectedModuleSlug ||
      isDynamicSelectOptionsHiddenForModule(this.selectedModuleSlug)
    ) {
      return;
    }

    const targets = this.filteredAvailableDynamicOptions;
    if (!targets.length) {
      return;
    }

    const current = [...(this._field.options || [])];
    const allTargetsSelected = targets.every((option) =>
      this.isDynamicOptionSelected(option),
    );

    if (allTargetsSelected) {
      // Deselect only currently visible options; keep hidden selections.
      const removeValues = new Set(targets.map((option) => String(option.value)));
      this._field.options = current.filter(
        (item) => !removeValues.has(String(this.readOptionValue(item))),
      );
    } else {
      // Select all visible options without clearing previously selected hidden ones.
      for (const option of targets) {
        const exists = current.some(
          (item) => String(this.readOptionValue(item)) === String(option.value),
        );
        if (!exists) {
          current.push({
            id: typeof option.value === 'number' ? option.value : undefined,
            label: option.label,
            value: option.value,
          });
        }
      }
      this._field.options = current;
    }

    this._field.optionSource = this.buildDynamicOptionSource();
    this.skipFieldReinitialize = true;
    this.onChange();
  }

  toggleDynamicOption(option: FieldOption): void {
    if (
      !this._field ||
      !this.isFieldEditable ||
      !this.selectedModuleSlug ||
      isDynamicSelectOptionsHiddenForModule(this.selectedModuleSlug)
    ) {
      return;
    }

    const current = [...(this._field.options || [])];
    const existingIndex = current.findIndex(
      (item) => String(this.readOptionValue(item)) === String(option.value),
    );

    if (existingIndex >= 0) {
      current.splice(existingIndex, 1);
    } else {
      current.push({
        id: typeof option.value === 'number' ? option.value : undefined,
        label: option.label,
        value: option.value,
      });
    }

    this._field.options = current;
    this._field.optionSource = this.buildDynamicOptionSource();
    this.skipFieldReinitialize = true;
    this.onChange();
  }

  getSelectedDynamicOptionsLabel(): string {
    const count = this.dynamicOptionsCount;
    if (!this.selectedModuleSlug) {
      return 'Select a module first';
    }
    if (this.recordsLoading) {
      return 'Loading options...';
    }
    if (!this.availableDynamicOptions.length) {
      return 'No records found';
    }
    if (count === 0) {
      return 'Select options';
    }
    if (count === 1) {
      const first = this._field?.options?.[0];
      return this.resolveDynamicOptionLabel(first) || '1 option selected';
    }
    return `${count} options selected`;
  }

  private readOptionValue(option: string | number | FieldOption): string | number | null {
    if (typeof option === 'string' || typeof option === 'number') {
      return option;
    }
    return normalizeFieldOption(option)?.value ?? null;
  }

  /** Resolve a saved dynamic option valueKey id to its display label. */
  private resolveDynamicOptionLabel(
    option: string | number | FieldOption | undefined,
  ): string {
    if (option == null) {
      return '';
    }

    const value = this.readOptionValue(option);
    if (value != null && value !== '') {
      const match = this.availableDynamicOptions.find(
        (item) => String(item.value) === String(value),
      );
      if (match?.label) {
        return match.label;
      }
    }

    if (typeof option === 'string') {
      return option;
    }

    if (typeof option === 'number') {
      return String(option);
    }

    return normalizeFieldOption(option)?.label ?? '';
  }

  onMaxRatingChange(value: number): void {
    if (!this.isFieldEditable || !this._field) return;
    this._field.maxRating = value;
    this.onChange();
  }

  getModuleSlug(form: FormModuleListItem): string {
    return this.dynamicModuleOptionsService.getModuleSlug(form);
  }

  getModuleLabel(form: FormModuleListItem): string {
    return this.dynamicModuleOptionsService.getModuleLabel(form);
  }

  getModuleLabelBySlug(moduleSlug: string): string {
    const module = this.availableModules.find(
      item => this.getModuleSlug(item) === moduleSlug
    );

    return module ? this.getModuleLabel(module) : moduleSlug;
  }

  getStaticOptionLabels(): string[] {
    return (this._field?.options || [])
      .map(option => {
        if (typeof option === 'string') {
          return option;
        }

        if (typeof option === 'number') {
          return String(option);
        }

        return normalizeFieldOption(option)?.label ?? '';
      })
      .filter(Boolean);
  }

  updateStaticOptionLabel(index: number, value: string): void {
    if (!this._field || !this.isFieldEditable) {
      return;
    }

    const labels = this.getStaticOptionLabels();
    if (index < 0 || index >= labels.length) {
      return;
    }

    labels[index] = value;
    this.applyStaticOptionLabels(labels);
  }

  addStaticOption(): void {
    if (!this._field || !this.isFieldEditable) {
      return;
    }

    const labels = this.getStaticOptionLabels();
    labels.push(`Option ${labels.length + 1}`);
    this.applyStaticOptionLabels(labels);
  }

  removeStaticOption(index: number): void {
    if (!this._field || !this.isFieldEditable) {
      return;
    }

    const labels = this.getStaticOptionLabels();
    if (index < 0 || index >= labels.length) {
      return;
    }

    labels.splice(index, 1);
    this.applyStaticOptionLabels(labels);
  }

  private applyStaticOptionLabels(labels: string[]): void {
    if (!this._field || !this.isFieldEditable) {
      return;
    }

    const normalizedLabels = labels.map(v => v.trim()).filter(v => v);

    if (this.isSelectField && this.optionsMode === 'static') {
      this._field.options = normalizeStaticSelectFieldOptions(normalizedLabels);
    } else {
      this._field.options = normalizedLabels;
    }

    this._field.optionSource = undefined;
    this.onChange();
  }

  onDuplicateClick(): void {
    if (!this.isFieldEditable) {
      return;
    }

    this.duplicate.emit();
  }

  isDeleteModalOpen = false;

  get deleteModalTitle(): string {
    return this.fieldUsedInLogicRules ? 'Delete Field & Rules' : 'Remove Field';
  }

  get deleteModalMessage(): string {
    if (this.fieldUsedInLogicRules) {
      return 'This field is used in one or more logic rules. Deleting this field will also remove the related logic rules.';
    }
    return 'Remove this field from the form?';
  }

  get deleteConfirmText(): string {
    return this.fieldUsedInLogicRules ? 'Delete Field & Rules' : 'Remove';
  }

  onDeleteClick(): void {
    if (!this.isFieldEditable) {
      return;
    }

    const blockReason = getLocationFieldDeleteBlockReason(
      this._field,
      this.schemaSignal()
    );

    if (blockReason) {
      this.toastr.warning(blockReason);
      return;
    }

    this.isDeleteModalOpen = true;
  }

  onDeleteConfirm(): void {
    const blockReason = getLocationFieldDeleteBlockReason(
      this._field,
      this.schemaSignal()
    );

    if (blockReason) {
      this.isDeleteModalOpen = false;
      this.toastr.warning(blockReason);
      return;
    }

    this.isDeleteModalOpen = false;
    this.delete.emit();
  }

  onDeleteModalClose(): void {
    this.isDeleteModalOpen = false;
  }

  private assignField(value: FormField): void {
    this._field = {
      ...value,
      defaultValue:
        value.defaultValue !== undefined && value.defaultValue !== null
          ? value.defaultValue
          : '',
      width: value.width ?? 12,
      validations: value.validations || {},
      condition: serializeConditionalLogic(value.condition),
      options: [...(value.options || [])],
      optionSource: value.optionSource ? { ...value.optionSource } : undefined,
      ...(value.type === 'image'
        ? (() => {
            const imageConfig = sanitizeImageFieldConfig(
              value as FormField & Record<string, unknown>,
            );
            return {
              referenceImages: cloneImageFiles(imageConfig.referenceImages),
              multiple: imageConfig.multiple,
              minFiles: imageConfig.minFiles,
              maxFiles: imageConfig.maxFiles,
            };
          })()
        : {
            referenceImages: undefined,
            multiple: undefined,
            minFiles: undefined,
            maxFiles: undefined,
          }),
      selectionType:
        value.type === 'select'
          ? this.resolveSelectSelectionType(value)
          : undefined,
      isShow: value.isShow !== false,
      isReadonly: value.isReadonly === true,
      allowDecimal:
        value.type === 'number' ||
        (value.type === 'range' && normalizeRangeType(value.rangeType) === 'number') ||
        isMeasurementFieldType(value.type)
          ? isMeasurementFieldType(value.type)
            ? true
            : value.allowDecimal === true
          : undefined,
      characterLimit: fieldSupportsCharacterLimit(value.type)
        ? resolveCharacterLimit(value.type, value.characterLimit)
        : undefined,
      rangeType: value.type === 'range' ? normalizeRangeType(value.rangeType) : undefined,
      rangeMin: value.rangeMin,
      rangeMax: value.rangeMax,
      rangeStep:
        value.type === 'range' && normalizeRangeType(value.rangeType) === 'number'
          ? (Number(value.rangeStep) > 0 ? Number(value.rangeStep) : DEFAULT_RANGE_STEP)
          : undefined,
      rangeMinDate: value.rangeMinDate,
      rangeMaxDate: value.rangeMaxDate,
      minDate: value.type === 'date' ? value.minDate : undefined,
      maxDate: value.type === 'date' ? value.maxDate : undefined,
      rangePlaceholderFrom:
        value.type === 'range'
          ? (typeof value.rangePlaceholderFrom === 'string'
              ? value.rangePlaceholderFrom
              : DEFAULT_RANGE_PLACEHOLDER_FROM)
          : undefined,
      rangePlaceholderTo:
        value.type === 'range'
          ? (typeof value.rangePlaceholderTo === 'string'
              ? value.rangePlaceholderTo
              : DEFAULT_RANGE_PLACEHOLDER_TO)
          : undefined,
      timeFormat:
        value.type === 'time'
          ? normalizeTimeFieldFormat(value.timeFormat)
          : value.type === 'range' && normalizeRangeType(value.rangeType) === 'time'
            ? normalizeRangeTimeFormat(value.timeFormat)
            : undefined,
      unitMode: isMeasurementFieldType(value.type)
        ? normalizeMeasurementUnitMode(value.unitMode)
        : undefined,
      unit: isMeasurementFieldType(value.type)
        ? normalizeMeasurementUnitCode(value.type, value.unit) ??
          getDefaultUnitCode(value.type)
        : undefined,
      minValue: isMeasurementFieldType(value.type)
        ? (() => {
            const min = Number(value.minValue);
            return Number.isFinite(min) ? min : 0;
          })()
        : undefined,
      maxValue: isMeasurementFieldType(value.type)
        ? (() => {
            const max = Number(value.maxValue);
            return Number.isFinite(max) ? max : undefined;
          })()
        : undefined,
    };

    this.placeholderManuallyEdited = !this.isAutoGeneratedPlaceholder(this._field);
    this.conditionEditor =
      cloneConditionalLogic(value.condition) ?? createEmptyConditionalLogic();
    this.ensureConditionSourceIsValid(false);
    if (getPrimaryActionType(this.conditionEditor) === 'setValue') {
      this.prefetchSetValueRelatedProperties();
    }
  }

  private ensureConditionSourceIsValid(emit: boolean): void {
    if (!this._field) {
      return;
    }

    const sourceId = getPrimaryPredicate(this.conditionEditor).fieldId;
    if (!sourceId) {
      return;
    }

    const isValidSource = this.validConditionSourceFields.some(field => field.id === sourceId);
    if (isValidSource) {
      return;
    }

    this.conditionEditor = {
      ...setPrimaryPredicate(this.conditionEditor, { fieldId: '', value: '' }),
      enabled: false,
    };
    this._field.condition = serializeConditionalLogic(this.conditionEditor);

    if (emit) {
      this.onChange();
    }
  }

  private initializeSelectOptionsState(
    field: FormField,
    preservedModuleSlug = '',
  ): void {
    const dynamicConfig = this.readDynamicConfig(field);

    this.optionsMode = this.resolveOptionsMode(field);

    if (preservedModuleSlug) {
      this.selectedModuleSlug = preservedModuleSlug;
      this.selectedDisplayColumn =
        dynamicConfig?.displayColumn || DYNAMIC_SELECT_LABEL_KEY;
    } else if (dynamicConfig) {
      this.selectedModuleSlug = dynamicConfig.moduleSlug;
      this.selectedDisplayColumn =
        dynamicConfig.displayColumn || DYNAMIC_SELECT_LABEL_KEY;
    } else {
      this.selectedModuleSlug = '';
      this.selectedDisplayColumn = DYNAMIC_SELECT_LABEL_KEY;
    }

    this.dynamicOptionsSearchQuery = '';
    this.restoreModuleDataFromCache();

    if (
      this.optionsMode === 'dynamic' &&
      isMultiSelectionTypeHiddenForModule(this.selectedModuleSlug) &&
      this._field.selectionType === 'multi'
    ) {
      this._field.selectionType = 'single';
    }

    if (this.optionsMode === 'dynamic') {
      this.ensureModulesLoaded(() => {
        if (this.selectedModuleSlug) {
          this.loadModuleData(this.selectedModuleSlug, {
            preserveSelection: true,
            emitUpdate: false,
          });
        }
      });
      return;
    }

    this.availableDynamicOptions = [];

    if (field.type === 'select') {
      const normalized = normalizeStaticSelectFieldOptions(this._field.options);
      if (!this.selectOptionsSemanticallyEqual(this._field.options, normalized)) {
        this._field.options = normalized;
      }
    }
  }

  private restoreModuleDataFromCache(): void {
    if (!this.selectedModuleSlug) {
      this.moduleRecords = [];
      this.moduleColumns = [];
      this.availableDynamicOptions = [];
      return;
    }

    const cached = this.moduleDataBySlug.get(this.selectedModuleSlug);

    if (cached) {
      this.applyModuleDataToLocalState(cached);
      return;
    }

    this.moduleRecords = [];
    this.moduleColumns = [];
    this.availableDynamicOptions = [];
  }

  private applyModuleDataToLocalState(data: ModuleDataCache): void {
    this.moduleRecords = data.records;
    this.moduleColumns = data.columns;
    this.selectedDisplayColumn =
      data.displayLabelKey || DYNAMIC_SELECT_LABEL_KEY;
    this.availableDynamicOptions =
      this.dynamicModuleOptionsService.buildOptionsFromRecords(
        data.records,
        this.selectedDisplayColumn,
        this.resolveDynamicValueKey(),
      );
  }

  /** Configured option value property from optionSource.response.valueKey. */
  private resolveDynamicValueKey(): string {
    const configured = String(
      this._field?.optionSource?.response?.valueKey ?? '',
    ).trim();
    return configured || 'id';
  }

  private resolveOptionsMode(field: FormField): SelectOptionsMode {
    return field.optionSource?.type === 'dynamic' ? 'dynamic' : 'static';
  }

  private ensureModulesLoaded(onLoaded?: () => void): void {
    if (this.modulesLoaded) {
      onLoaded?.();
      return;
    }

    if (onLoaded) {
      this.modulesLoadCallbacks.push(onLoaded);
    }

    if (this.modulesLoadPending) {
      return;
    }

    this.modulesLoadPending = true;
    this.modulesLoading = true;
    this.modulesError = null;
    this.beginApiLoading();

    this.dynamicModuleOptionsService
      .getAvailableModules(this.activeModuleName)
      .subscribe({
        next: modules => {
          this.availableModules = modules;
          this.modulesLoaded = true;
          this.modulesLoading = false;
          this.modulesLoadPending = false;
          this.endApiLoading();
          this.flushModulesLoadCallbacks();
        },
        error: () => {
          this.availableModules = [];
          this.modulesLoaded = false;
          this.modulesLoading = false;
          this.modulesLoadPending = false;
          this.modulesError = 'Failed to load form modules.';
          this.endApiLoading();
          this.flushModulesLoadCallbacks();
        },
      });
  }

  private flushModulesLoadCallbacks(): void {
    const callbacks = [...this.modulesLoadCallbacks];
    this.modulesLoadCallbacks = [];
    callbacks.forEach(callback => callback());
  }

  private loadModuleData(
    moduleSlug: string,
    options: LoadModuleDataOptions = {}
  ): void {
    const { preserveSelection = false, emitUpdate = true } = options;

    const cached = this.moduleDataBySlug.get(moduleSlug);

    if (cached) {
      this.recordsLoading = false;
      this.applyLoadedModuleData(cached, preserveSelection, emitUpdate);
      return;
    }

    if (this.loadingModuleSlug === moduleSlug) {
      return;
    }

    this.loadingModuleSlug = moduleSlug;
    this.recordsLoading = true;
    this.beginApiLoading();

    this.dynamicModuleOptionsService.getModuleData(moduleSlug).subscribe({
      next: moduleData => {
        this.recordsLoading = false;
        this.loadingModuleSlug = null;
        this.endApiLoading();
        this.moduleDataBySlug.set(moduleSlug, moduleData);
        this.applyLoadedModuleData(moduleData, preserveSelection, emitUpdate);
      },
      error: () => {
        this.recordsLoading = false;
        this.loadingModuleSlug = null;
        this.endApiLoading();
        this.availableDynamicOptions = [];
      },
    });
  }

  private beginApiLoading(): void {
    this.apiLoadingCount += 1;

    if (this.apiLoadingCount === 1) {
      this.loadingChange.emit(true);
    }
  }

  private endApiLoading(): void {
    this.apiLoadingCount = Math.max(0, this.apiLoadingCount - 1);

    if (this.apiLoadingCount === 0) {
      this.loadingChange.emit(false);
    }
  }

  private applyLoadedModuleData(
    data: ModuleDataCache,
    preserveSelection: boolean,
    emitUpdate: boolean
  ): void {
    this.applyModuleDataToLocalState(data);

    if (!this._field || !this.selectedModuleSlug) {
      return;
    }

    this._field.optionSource = this.buildDynamicOptionSource();

    // Countries/States/Cities: no Select Options filtering — bake all records.
    if (isDynamicSelectOptionsHiddenForModule(this.selectedModuleSlug)) {
      if (emitUpdate) {
        this._field.options = [...this.availableDynamicOptions];
        this.skipFieldReinitialize = true;
        this.onChange();
        return;
      }

      if (preserveSelection && !(this._field.options?.length)) {
        this._field.options = [...this.availableDynamicOptions];
        this.skipFieldReinitialize = true;
        this.onChange();
      }
      return;
    }

    if (preserveSelection) {
      const before = this._field.options ?? [];
      this.syncSelectedDynamicOptionsWithAvailable();
      const after = this._field.options ?? [];
      if (!this.selectOptionsSemanticallyEqual(before, after)) {
        this.skipFieldReinitialize = true;
        this.onChange();
      }
      return;
    }

    if (emitUpdate) {
      this._field.options = [...this.availableDynamicOptions];
      this.skipFieldReinitialize = true;
      this.onChange();
    }
  }

  /**
   * Keep previously saved selections that still exist in the module,
   * refreshing labels from the current valueKey/labelKey mapping.
   * In-memory options keep `{ label, value }` for UI; save paths strip to IDs.
   */
  private syncSelectedDynamicOptionsWithAvailable(): void {
    if (!this._field) {
      return;
    }

    const availableByValue = new Map(
      this.availableDynamicOptions.map((option) => [String(option.value), option]),
    );

    const next: FieldOption[] = [];
    for (const item of this._field.options || []) {
      const value = this.readOptionValue(item);
      if (value == null || value === '') {
        continue;
      }
      const match = availableByValue.get(String(value));
      if (match) {
        next.push({
          id: typeof match.value === 'number' ? match.value : undefined,
          label: match.label,
          value: match.value,
        });
      }
    }

    this._field.options = next;
  }

  /** Compare select options by value/label only (ignore optional id churn). */
  private selectOptionsSemanticallyEqual(
    left: FormField['options'] | undefined,
    right: FormField['options'] | undefined,
  ): boolean {
    const leftList = left ?? [];
    const rightList = right ?? [];
    if (leftList.length !== rightList.length) {
      return false;
    }

    for (let index = 0; index < leftList.length; index += 1) {
      const leftValue = this.readOptionValue(leftList[index]);
      const rightValue = this.readOptionValue(rightList[index]);
      if (String(leftValue ?? '') !== String(rightValue ?? '')) {
        return false;
      }

      const leftLabel =
        typeof leftList[index] === 'string' || typeof leftList[index] === 'number'
          ? String(leftList[index])
          : normalizeFieldOption(leftList[index])?.label ?? '';
      const rightLabel =
        typeof rightList[index] === 'string' || typeof rightList[index] === 'number'
          ? String(rightList[index])
          : normalizeFieldOption(rightList[index])?.label ?? '';
      if (String(leftLabel ?? '') !== String(rightLabel ?? '')) {
        return false;
      }
    }

    return true;
  }

  private resolveEmittedOptionSource(): OptionSource | undefined {
    if (this.optionsMode === 'dynamic') {
      return this.buildDynamicOptionSource();
    }

    return undefined;
  }

  private buildDynamicOptionSource(): OptionSource | undefined {
    if (!this.selectedModuleSlug) {
      return undefined;
    }

    return {
      type: 'dynamic',
      endpoint: this.selectedModuleSlug,
      response: {
        labelKey: this.selectedDisplayColumn || DYNAMIC_SELECT_LABEL_KEY,
        valueKey: this.resolveDynamicValueKey(),
        dataPath: 'data',
      },
    };
  }

  private readDynamicConfig(
    field: FormField
  ): { moduleSlug: string; displayColumn: string } | null {
    if (field.optionSource?.type !== 'dynamic' || !field.optionSource.endpoint) {
      return null;
    }

    return {
      moduleSlug: field.optionSource.endpoint,
      displayColumn:
        field.optionSource.response?.labelKey || DYNAMIC_SELECT_LABEL_KEY,
    };
  }

  selectModule(slug: string): void {
    if (!this.isFieldEditable || this.isModuleSlugDisabled(slug)) {
      return;
    }

    this.selectedModuleSlug = slug;
    this.onModuleChange(slug);
    this.overlayService.close();
  }

  getSelectedModuleLabel(): string {
    const selected = this.availableModules.find(
      module => this.getModuleSlug(module) === this.selectedModuleSlug
    );

    return selected
      ? this.getModuleLabel(selected)
      : 'Select a module';
  }

}
