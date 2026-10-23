import { cloneConditionalLogic, serializeConditionalLogic } from '../../../../../shared/conditional-logic';
import {
  getDefaultCharacterLimit,
  resolveCharacterLimit,
  supportsCharacterLimit,
} from '../../../../../shared/dynamic-form/character-limit.utils';
import {
  DEFAULT_RANGE_STEP,
  normalizeRangeTimeFormat,
  normalizeRangeType,
} from '../../../../../shared/dynamic-form/range-field.utils';
import { normalizeTimeFieldFormat } from '../../../../../shared/dynamic-form/time-field.utils';
import {
  getDefaultUnitCode,
  isMeasurementFieldType,
  normalizeMeasurementUnitCode,
  normalizeMeasurementUnitMode,
} from '../../../../../shared/dynamic-form/measurement-units';
import { FormField, FieldOption } from '../../../../form-builder/models/form-field.model';
import {
  cloneOptionSource,
  createFieldFromTemplate,
  toFieldName,
} from '../../../../form-builder/utils/form-field.factory';
import { isCurrentUserDefaultValue } from '../../../../form-builder/utils/field-default-value.utils';
import {
  isMultiSelectionTypeHiddenForModule,
  resolveBuilderLocationKind,
} from '../../../../form-builder/utils/location-field-dependencies.utils';
import { FieldType, FormFieldConfig, createId } from '../models/dynamic-form.models';

/** Builder type picker options (maps to FormField + FormFieldConfig). */
const BUILDER_TYPES: Array<{ label: string; value: FormField['type'] | FieldType }> = [
  { label: 'Text', value: 'text' },
  { label: 'Number', value: 'number' },
  // { label: 'Email', value: 'email' },
  // { label: 'Password', value: 'password' },
  { label: 'Textarea', value: 'textarea' },
  { label: 'Select Box', value: 'select' },
  { label: 'Checkbox', value: 'checkbox' },
  { label: 'Radio Button', value: 'radio' },
  { label: 'Date', value: 'date' },
  { label: 'Image', value: 'image' },
  { label: 'File Upload', value: 'file' },
];

export const FIELD_BUILDER_TYPE_OPTIONS = BUILDER_TYPES;

export interface MapBuilderFieldToConfigOptions {
  preserveId?: boolean;
  selectedType?: string;
}

/** Types that FieldSettings / FormField understand natively. */
function toFormFieldType(type: string): FormField['type'] {
  switch (type) {
    case 'password':
    case 'file':
      return 'text';
    case 'image':
      return 'image';
    case 'signature':
    case 'time':
    case 'date':
    case 'rating':
    case 'range':
    case 'price':
    case 'length':
    case 'mass':
    case 'volume':
    case 'temperature':
    case 'barcode':
    case 'qr-code':
    case 'number':
    case 'email':
    case 'textarea':
    case 'select':
    case 'checkbox':
    case 'radio':
    case 'text':
      return type;
    case 'user-timestamp':
      return 'time';
    // Legacy Parameter field — no longer supported in the builder.
    case 'parameter':
      return 'text';
    default:
      return 'text';
  }
}

export function createDraftBuilderField(
  selectedType: string = 'text',
): FormField {
  const formFieldType = toFormFieldType(selectedType);
  return createFieldFromTemplate({
    type: formFieldType,
    fieldTypeName: selectedType,
    label: '',
    placeholder: '',
    required: false,
    options:
      formFieldType === 'select' || formFieldType === 'radio' || formFieldType === 'checkbox'
        ? []
        : [],
  });
}

export function mapConfigFieldToBuilder(field: FormFieldConfig): FormField {
  const formFieldType = toFormFieldType(field.fieldTypeName ?? field.type);
  const builderOptions = mapConfigOptionsToBuilder(field);

  return {
    id: field.id,
    type: formFieldType,
    fieldTypeName: field.fieldTypeName ?? field.type,
    label: field.label,
    name: field.name,
    placeholder: field.placeholder ?? '',
    required: field.required,
    isReadonly: field.readonly === true || (field as { isReadonly?: boolean }).isReadonly === true,
    isEditable: field.isDefault ? false : field.isEditable !== false,
    isShow: field.isShow !== false,
    options: builderOptions,
    optionSource: cloneOptionSource(field.optionSource),
    selectionType:
      formFieldType === 'select' ? resolveConfigSelectionType(field) : undefined,
    width: widthToGridUnits(field.width),
    value: field.value,
    defaultValue: field.defaultValue ?? field.value ?? '',
    validations: field.validations ? { ...field.validations } : {},
    condition: cloneConditionalLogic(field.condition),
    maxRating: field.maxRating,
    rangeType: formFieldType === 'range' ? normalizeRangeType(field.rangeType) : undefined,
    rangeMin: field.rangeMin,
    rangeMax: field.rangeMax,
    rangeStep: field.rangeStep,
    rangeMinDate: field.rangeMinDate,
    rangeMaxDate: field.rangeMaxDate,
    minDate: formFieldType === 'date' ? field.minDate : undefined,
    maxDate: formFieldType === 'date' ? field.maxDate : undefined,
    rangePlaceholderFrom: field.rangePlaceholderFrom,
    rangePlaceholderTo: field.rangePlaceholderTo,
    timeFormat:
      formFieldType === 'time'
        ? normalizeTimeFieldFormat(field.timeFormat)
        : formFieldType === 'range' && normalizeRangeType(field.rangeType) === 'time'
          ? normalizeRangeTimeFormat(field.timeFormat)
          : undefined,
    unitMode: isMeasurementFieldType(formFieldType)
      ? normalizeMeasurementUnitMode(field.unitMode)
      : undefined,
    unit: isMeasurementFieldType(formFieldType)
      ? normalizeMeasurementUnitCode(formFieldType, field.unit) ??
        getDefaultUnitCode(formFieldType)
      : undefined,
    minValue: isMeasurementFieldType(formFieldType)
      ? (() => {
          const min = Number(field.minValue);
          return Number.isFinite(min) ? min : 0;
        })()
      : undefined,
    maxValue: isMeasurementFieldType(formFieldType)
      ? (() => {
          const max = Number(field.maxValue);
          return Number.isFinite(max) ? max : undefined;
        })()
      : undefined,
    allowDecimal:
      isMeasurementFieldType(formFieldType) ? true : field.allowDecimal === true,
    characterLimit: supportsCharacterLimit(formFieldType)
      ? resolveCharacterLimit(formFieldType, field.characterLimit)
      : undefined,
  };
}

export function mapBuilderFieldToConfig(
  field: FormField,
  options: MapBuilderFieldToConfigOptions = {},
): FormFieldConfig {
  const type = resolveConfigType(field, options.selectedType);
  const isDynamic = field.optionSource?.type === 'dynamic';
  const mappedOptions = isDynamic
    ? mapDynamicOptionsForTemplateDisplay(field.options)
    : (field.options ?? [])
        .map((opt) =>
          typeof opt === 'string' || typeof opt === 'number'
            ? String(opt)
            : String(opt.label ?? opt.value),
        )
        .filter((opt) => opt.trim().length > 0);

  return {
    id: options.preserveId !== false && field.id ? field.id : createId('field'),
    type,
    label: (field.label || 'Untitled Field').trim(),
    name: toFieldName(field.label || field.name || 'field'),
    placeholder: field.placeholder?.trim() || undefined,
    required: !!field.required,
    readonly: field.isReadonly || undefined,
    options: mappedOptions.length ? mappedOptions : undefined,
    width: mapBuilderWidthToPercent(field.width),
    isDefault: false,
    value: resolveConfigPreviewValue(field),
    optionSource: cloneOptionSource(field.optionSource),
    selectionType: type === 'select' ? resolveBuilderSelectionType(field) : undefined,
    fieldTypeName: field.fieldTypeName ?? type,
    isEditable: field.isEditable,
    isShow: field.isShow,
    validations: field.validations ? { ...field.validations } : undefined,
    condition: serializeConditionalLogic(field.condition),
    defaultValue: field.defaultValue,
    maxRating: field.maxRating,
    rangeType: type === 'range' ? normalizeRangeType(field.rangeType) : undefined,
    rangeMin: field.rangeMin,
    rangeMax: field.rangeMax,
    rangeStep:
      type === 'range' && normalizeRangeType(field.rangeType) === 'number'
        ? (Number(field.rangeStep) > 0 ? Number(field.rangeStep) : DEFAULT_RANGE_STEP)
        : undefined,
    rangeMinDate: field.rangeMinDate,
    rangeMaxDate: field.rangeMaxDate,
    minDate: type === 'date' ? field.minDate : undefined,
    maxDate: type === 'date' ? field.maxDate : undefined,
    rangePlaceholderFrom: field.rangePlaceholderFrom,
    rangePlaceholderTo: field.rangePlaceholderTo,
    timeFormat:
      type === 'time'
        ? normalizeTimeFieldFormat(field.timeFormat)
        : type === 'range' && normalizeRangeType(field.rangeType) === 'time'
          ? normalizeRangeTimeFormat(field.timeFormat)
          : undefined,
    unitMode: isMeasurementFieldType(type)
      ? normalizeMeasurementUnitMode(field.unitMode)
      : undefined,
    unit: isMeasurementFieldType(type)
      ? normalizeMeasurementUnitCode(type, field.unit) ?? getDefaultUnitCode(type)
      : undefined,
    minValue: isMeasurementFieldType(type)
      ? (() => {
          const min = Number(field.minValue);
          return Number.isFinite(min) ? min : 0;
        })()
      : undefined,
    maxValue: isMeasurementFieldType(type)
      ? (() => {
          const max = Number(field.maxValue);
          return Number.isFinite(max) ? max : undefined;
        })()
      : undefined,
    allowDecimal:
      field.type === 'number' ||
      (field.type === 'range' && normalizeRangeType(field.rangeType) === 'number') ||
      isMeasurementFieldType(type)
        ? isMeasurementFieldType(type)
          ? true
          : field.allowDecimal === true
        : undefined,
    characterLimit: supportsCharacterLimit(type)
      ? (resolveCharacterLimit(type, field.characterLimit) ??
        getDefaultCharacterLimit(type))
      : undefined,
  };
}

function mapConfigOptionsToBuilder(
  field: FormFieldConfig,
): Array<string | number | FieldOption> {
  const rawOptions = field.options ?? [];

  if (field.optionSource?.type === 'dynamic') {
    // Prefer label+value objects when already hydrated; bare IDs are resolved in Field Settings.
    return rawOptions.map((opt) => {
      if (typeof opt === 'string' || typeof opt === 'number') {
        return opt;
      }
      return { label: String(opt.label), value: opt.value };
    });
  }

  return rawOptions.map((opt) =>
    typeof opt === 'string' || typeof opt === 'number'
      ? opt
      : { label: String(opt.label), value: opt.value },
  );
}

/**
 * Form Template canvas needs labels for display. Keep `{ label, value }` when present;
 * bare IDs are hydrated after load. Payload save still strips to valueKey IDs.
 */
function mapDynamicOptionsForTemplateDisplay(
  options: FormField['options'] | undefined,
): Array<string | number | { label: string; value: string | number }> {
  const mapped: Array<string | number | { label: string; value: string | number }> = [];

  for (const opt of options ?? []) {
    if (typeof opt === 'string' || typeof opt === 'number') {
      mapped.push(opt);
      continue;
    }

    if (opt?.value == null || opt.value === '') {
      continue;
    }

    mapped.push({
      label: String(opt.label ?? opt.value),
      value: opt.value,
    });
  }

  return mapped;
}

function resolveConfigType(field: FormField, selectedType?: string): FieldType {
  const candidate = (selectedType || field.fieldTypeName || field.type || 'text').toLowerCase();

  const allowed: FieldType[] = [
    'text',
    'number',
    'email',
    'password',
    'textarea',
    'select',
    'checkbox',
    'date',
    'radio',
    'image',
    'file',
    'signature',
    'time',
    'rating',
    'range',
    'price',
    'length',
    'mass',
    'volume',
    'temperature',
    'barcode',
    'qr-code',
  ];

  // Migrate legacy User Timestamp schemas to Time.
  if (candidate === 'user-timestamp') {
    return 'time';
  }

  // Legacy Parameter field is no longer available.
  if (candidate === 'parameter') {
    return 'text';
  }

  if (allowed.includes(candidate as FieldType)) {
    return candidate as FieldType;
  }

  if (field.type === 'image') return 'image';
  if (allowed.includes(field.type as FieldType)) {
    return field.type as FieldType;
  }

  return 'text';
}

/** Match setup-user defaults: missing/unknown → single; location modules forced single. */
function resolveBuilderSelectionType(field: FormField): 'single' | 'multi' {
  if (
    field.optionSource?.type === 'dynamic' &&
    (resolveBuilderLocationKind(field.optionSource.endpoint) != null ||
      isMultiSelectionTypeHiddenForModule(field.optionSource.endpoint))
  ) {
    return 'single';
  }

  return field.selectionType === 'multi' ? 'multi' : 'single';
}

function resolveConfigSelectionType(field: FormFieldConfig): 'single' | 'multi' {
  if (
    field.optionSource?.type === 'dynamic' &&
    (resolveBuilderLocationKind(field.optionSource.endpoint) != null ||
      isMultiSelectionTypeHiddenForModule(field.optionSource.endpoint))
  ) {
    return 'single';
  }

  const raw = String(field.selectionType ?? '').trim().toLowerCase();
  if (raw === 'multi' || raw === 'multiple') {
    return 'multi';
  }

  return 'single';
}

function normalizeConfigFieldValue(
  value: unknown,
): string | string[] | undefined {
  if (value == null) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }

  return String(value);
}

/** Canvas preview prefers runtime value, then configured defaultValue. */
function resolveConfigPreviewValue(field: FormField): string | string[] | undefined {
  if (field.value != null && field.value !== '') {
    return normalizeConfigFieldValue(field.value);
  }

  const configured = field.defaultValue;
  if (configured == null || configured === '') {
    return undefined;
  }

  // Keep Current User token out of the canvas as a raw sentinel string.
  if (isCurrentUserDefaultValue(configured)) {
    return 'Current logged-in user';
  }

  if (typeof configured === 'string' || typeof configured === 'number') {
    return String(configured);
  }

  if (Array.isArray(configured)) {
    return configured.map((item) =>
      isCurrentUserDefaultValue(item) ? 'Current logged-in user' : String(item),
    );
  }

  // Range / measurement objects — section preview already JSON-parses string values.
  return JSON.stringify(configured);
}

/** Form Template Width-in-row presets (12-column grid). */
export const ROW_WIDTH_UNITS = {
  third: 4,
  half: 6,
  full: 12,
} as const;

export type RowWidthPreset = keyof typeof ROW_WIDTH_UNITS;

export const ROW_CAPACITY_UNITS = 12;

/** Snap any 12-col width to the nearest Width-in-row preset. */
export function normalizeBuilderWidthUnits(width?: number | null): number {
  const raw = width == null || width <= 0 ? ROW_WIDTH_UNITS.full : Math.round(width);
  if (raw <= 4) {
    return ROW_WIDTH_UNITS.third;
  }
  if (raw <= 6) {
    return ROW_WIDTH_UNITS.half;
  }
  return ROW_WIDTH_UNITS.full;
}

export function builderWidthToPreset(width?: number | null): RowWidthPreset {
  const units = normalizeBuilderWidthUnits(width);
  if (units === ROW_WIDTH_UNITS.third) {
    return 'third';
  }
  if (units === ROW_WIDTH_UNITS.half) {
    return 'half';
  }
  return 'full';
}

export function presetToBuilderWidth(preset: RowWidthPreset): number {
  return ROW_WIDTH_UNITS[preset];
}

/** Convert FormField 12-col width to a CSS percentage used by section layout. */
export function mapBuilderWidthToPercent(width?: number): string {
  const units = normalizeBuilderWidthUnits(width);
  return `${Math.round((units / ROW_CAPACITY_UNITS) * 100)}%`;
}

/** Approximate grid units (out of 12) for a FormFieldConfig width string. */
export function widthToGridUnits(width?: string): number {
  if (!width || width === 'auto') {
    return ROW_WIDTH_UNITS.full;
  }
  if (width.endsWith('%')) {
    const pct = parseFloat(width);
    if (Number.isFinite(pct) && pct > 0) {
      return normalizeBuilderWidthUnits(Math.round((pct / 100) * ROW_CAPACITY_UNITS));
    }
  }
  return ROW_WIDTH_UNITS.full;
}

export function rowUsedGridUnits(
  fields: Array<Pick<FormFieldConfig, 'width'> | Pick<FormField, 'width'>>,
): number {
  return fields.reduce((sum, field) => {
    if (typeof (field as FormField).width === 'number') {
      return sum + normalizeBuilderWidthUnits((field as FormField).width);
    }
    return sum + widthToGridUnits((field as FormFieldConfig).width);
  }, 0);
}

export function rowRemainingGridUnits(
  fields: Array<Pick<FormFieldConfig, 'width'> | Pick<FormField, 'width'>>,
): number {
  return Math.max(0, ROW_CAPACITY_UNITS - rowUsedGridUnits(fields));
}

/** True when the row still has room for at least a 1/3 column. */
export function rowHasAvailableColumnSpace(
  fields: Array<Pick<FormFieldConfig, 'width'> | Pick<FormField, 'width'>>,
): boolean {
  return fields.length > 0 && rowRemainingGridUnits(fields) >= ROW_WIDTH_UNITS.third;
}

/** Largest preset that fits in the remaining row capacity. */
export function largestFittingBuilderWidth(remainingUnits: number): number {
  if (remainingUnits >= ROW_WIDTH_UNITS.full) {
    return ROW_WIDTH_UNITS.full;
  }
  if (remainingUnits >= ROW_WIDTH_UNITS.half) {
    return ROW_WIDTH_UNITS.half;
  }
  if (remainingUnits >= ROW_WIDTH_UNITS.third) {
    return ROW_WIDTH_UNITS.third;
  }
  return 0;
}

/**
 * Presets allowed for `fieldId` given its siblings in the same row.
 * Current width is always allowed so the control can stay selected.
 */
export function availableRowWidthPresetsForField(
  rowFields: Array<Pick<FormField, 'id' | 'width'>>,
  fieldId: string,
): RowWidthPreset[] {
  const others = rowFields.filter((field) => field.id !== fieldId);
  const usedByOthers = rowUsedGridUnits(others);
  const remainingForField = Math.max(0, ROW_CAPACITY_UNITS - usedByOthers);
  const current = rowFields.find((field) => field.id === fieldId);
  const currentPreset = builderWidthToPreset(current?.width);

  const allowed: RowWidthPreset[] = [];
  (['third', 'half', 'full'] as RowWidthPreset[]).forEach((preset) => {
    if (
      preset === currentPreset ||
      ROW_WIDTH_UNITS[preset] <= remainingForField
    ) {
      allowed.push(preset);
    }
  });
  return allowed;
}

export function resolveItemDisplayName(record: Record<string, unknown>): string {
  const preferredKeys = ['name', 'title', 'item_name', 'itemName', 'label'];
  for (const key of preferredKeys) {
    const value = record[key];
    if (value != null && String(value).trim()) {
      return String(value).trim();
    }
  }

  for (const [key, value] of Object.entries(record)) {
    if (key === 'id' || key.endsWith('_at') || key === 'createdAt' || key === 'updatedAt') {
      continue;
    }
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return record['id'] != null ? `Item #${record['id']}` : 'Untitled item';
}
