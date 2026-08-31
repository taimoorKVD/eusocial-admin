import {
  FieldOption,
  FieldType,
  FormField,
  OptionSource,
  SelectSelectionType,
} from '../models/form-field.model';
import { serializeConditionalLogic } from '../../../shared/conditional-logic';
import { resolveCharacterLimit } from '../../../shared/dynamic-form/character-limit.utils';
import {
  DEFAULT_RANGE_STEP,
  normalizeRangeTimeFormat,
  normalizeRangeType,
  sanitizeDateBounds,
  sanitizeRangeBounds,
} from '../../../shared/dynamic-form/range-field.utils';
import { normalizeTimeFieldFormat } from '../../../shared/dynamic-form/time-field.utils';
import {
  getDefaultUnitCode,
  isMeasurementFieldType,
  normalizeMeasurementUnitCode,
  normalizeMeasurementUnitMode,
} from '../../../shared/dynamic-form/measurement-units';
import {
  normalizeCheckboxFieldOptions,
  normalizeStaticSelectFieldOptions,
} from './field-options.utils';
import { normalizeFieldTypeName } from './field-type.utils';
import { readOptionSourceFromField } from './option-source.utils';
import { resolveBuilderLocationKind } from './location-field-dependencies.utils';
import { sanitizeImageFieldConfig } from './image-field.utils';

export function generateFieldId(): string {
  return `fld_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

const PLACEHOLDER_AUTO_GENERATION_TYPES: ReadonlySet<FieldType> = new Set([
  'text',
  'email',
  'number',
  'textarea',
]);

export function supportsPlaceholderAutoGeneration(type: FieldType | undefined): boolean {
  return type ? PLACEHOLDER_AUTO_GENERATION_TYPES.has(type) : false;
}

export function buildPlaceholderFromLabel(label: string | null | undefined): string {
  const trimmedLabel = String(label ?? '').trim();
  return trimmedLabel ? `Enter ${trimmedLabel}` : '';
}

export function toFieldName(label: string | null | undefined): string {
  const normalizedLabel = String(label ?? 'field');
  const fieldName = normalizedLabel
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return fieldName || 'field';
}

function cloneOptions(
  options: Array<string | { label: string; value: string | number }> = []
): Array<string | { label: string; value: string | number }> {
  return options.map(option =>
    typeof option === 'string' ? option : { ...option }
  );
}

export function cloneOptionSourceOptions(
  options?: string[] | FieldOption[]
): string[] | FieldOption[] | undefined {
  if (!options) {
    return undefined;
  }

  if (options.every(option => typeof option === 'string')) {
    return [...options] as string[];
  }

  return (options as FieldOption[]).map(option => ({ ...option }));
}

export function cloneOptionSource(optionSource?: OptionSource): OptionSource | undefined {
  if (!optionSource) {
    return undefined;
  }

  return {
    ...optionSource,
    response: optionSource.response ? { ...optionSource.response } : undefined,
    options: cloneOptionSourceOptions(optionSource.options),
  };
}

function readFieldIdentifier(
  field: Partial<FormField> & Record<string, unknown>
): string {
  return String(
    field.id ?? field['fieldId'] ?? field['field_id'] ?? field['key'] ?? generateFieldId()
  );
}

function readBooleanFlag(
  field: Partial<FormField> & Record<string, unknown>,
  camelKey: keyof FormField,
  snakeKey: string,
  defaultValue: boolean
): boolean {
  const camelValue = field[camelKey];

  if (typeof camelValue === 'boolean') {
    return camelValue;
  }

  if (typeof field[snakeKey] === 'boolean') {
    return field[snakeKey];
  }

  return defaultValue;
}

function readRequired(field: Partial<FormField> & Record<string, unknown>): boolean {
  return readBooleanFlag(field, 'required', 'isRequired', false);
}

function readFieldTypeName(field: Partial<FormField> & Record<string, unknown>): string {
  const fieldType = field['fieldType'];

  if (fieldType && typeof fieldType === 'object') {
    const typeRecord = fieldType as Record<string, unknown>;
    const nestedName = typeRecord['name'] ?? typeRecord['type'];

    if (nestedName) {
      return String(nestedName);
    }
  }

  return String(
    field.fieldTypeName ?? field['field_type_name'] ?? field.type ?? 'text'
  );
}

function isStaticSelectField(
  type: FormField['type'],
  optionSource?: OptionSource
): boolean {
  return (
    type === 'select' &&
    optionSource?.type !== 'dynamic' &&
    optionSource?.type !== 'api'
  );
}

function resolveFieldOptions(
  type: FormField['type'],
  optionSource: OptionSource | undefined,
  options: FormField['options'] | undefined
): FormField['options'] {
  if (type === 'checkbox') {
    return normalizeCheckboxFieldOptions(options);
  }

  if (isStaticSelectField(type, optionSource)) {
    return normalizeStaticSelectFieldOptions(options);
  }

  return cloneOptions(options);
}

export function createFieldFromTemplate(template: Partial<FormField>): FormField {
  return sanitizeField(template);
}

export function sanitizeField(
  field: Partial<FormField> & Record<string, unknown>,
  order?: number
): FormField {
  const label =
    typeof field.label === 'string' && field.label.trim()
      ? field.label
      : 'Untitled Field';

  const fieldTypeName = readFieldTypeName(field);
  const type = normalizeFieldTypeName(fieldTypeName, field.type);
  const optionSource = readOptionSourceFromField(field);
  const rangeType = type === 'range' ? normalizeRangeType(field.rangeType) : undefined;
  const numberBounds =
    type === 'range' && rangeType === 'number'
      ? sanitizeRangeBounds(field.rangeMin, field.rangeMax)
      : {};
  const dateBounds =
    type === 'range' && rangeType === 'date'
      ? sanitizeDateBounds(field.rangeMinDate, field.rangeMaxDate)
      : {};
  const imageConfig =
    type === 'image' ? sanitizeImageFieldConfig(field) : null;

  return {
    id: readFieldIdentifier(field),
    type,
    fieldTypeName,
    label,
    name: toFieldName(label),
    placeholder: field.placeholder || '',
    required: readRequired(field),
    isShow: readBooleanFlag(field, 'isShow', 'is_show', true),
    isReadonly: readBooleanFlag(field, 'isReadonly', 'is_readonly', false),
    isEditable: readBooleanFlag(field, 'isEditable', 'is_editable', true),
    options: resolveFieldOptions(type, optionSource, field.options),
    optionSource: cloneOptionSource(optionSource),
    selectionType:
      type === 'select' ? readSelectionType(field, optionSource) : undefined,
    systemMappingKey: readOptionalString(
      field,
      'systemMappingKey',
      'system_mapping_key',
    ),
    fieldKey: readOptionalString(field, 'fieldKey', 'field_key'),
    value: field.value ?? field.defaultValue ?? null,
    defaultValue: field.defaultValue ?? null,
    validations: field.validations ? { ...field.validations } : {},
    width: field.width ?? 12,
    order: order ?? field.order,
    condition: serializeConditionalLogic(field.condition),
    maxRating: field.maxRating,
    rangeType,
    rangeMin: numberBounds.rangeMin,
    rangeMax: numberBounds.rangeMax,
    rangeStep:
      type === 'range' && rangeType === 'number'
        ? (() => {
            const step = Number(field.rangeStep);
            return Number.isFinite(step) && step > 0 ? step : DEFAULT_RANGE_STEP;
          })()
        : undefined,
    rangeMinDate: dateBounds.rangeMinDate,
    rangeMaxDate: dateBounds.rangeMaxDate,
    rangePlaceholderFrom:
      type === 'range'
        ? (typeof field.rangePlaceholderFrom === 'string'
            ? field.rangePlaceholderFrom
            : undefined)
        : undefined,
    rangePlaceholderTo:
      type === 'range'
        ? (typeof field.rangePlaceholderTo === 'string'
            ? field.rangePlaceholderTo
            : undefined)
        : undefined,
    timeFormat:
      type === 'time'
        ? normalizeTimeFieldFormat(field.timeFormat)
        : type === 'range' && rangeType === 'time'
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
      type === 'number' ||
      (type === 'range' && rangeType === 'number') ||
      isMeasurementFieldType(type)
        ? isMeasurementFieldType(type)
          ? true
          : readBooleanFlag(field, 'allowDecimal', 'allow_decimal', false)
        : undefined,
    characterLimit: resolveCharacterLimit(
      type,
      field.characterLimit ??
        field['character_limit'] ??
        field['maxLength'] ??
        field['max_length'],
    ),
    referenceImages: imageConfig?.referenceImages,
    multiple: imageConfig?.multiple,
    minFiles: imageConfig?.minFiles,
    maxFiles: imageConfig?.maxFiles,
  };
}

function readSelectionType(
  field: Partial<FormField> & Record<string, unknown>,
  optionSource?: OptionSource
): SelectSelectionType {
  const raw = field.selectionType ?? field['selection_type'];
  const normalized = String(raw ?? '')
    .trim()
    .toLowerCase();

  // Location modules must never persist as Multi (legacy schemas included).
  if (
    optionSource?.type === 'dynamic' &&
    resolveBuilderLocationKind(optionSource.endpoint) != null
  ) {
    return 'single';
  }

  if (normalized === 'multi' || normalized === 'multiple') {
    return 'multi';
  }

  return 'single';
}

function readOptionalString(
  field: Partial<FormField> & Record<string, unknown>,
  camelKey: string,
  snakeKey: string,
): string | undefined {
  const camel = field[camelKey];
  if (typeof camel === 'string' && camel.trim()) {
    return camel.trim();
  }

  const snake = field[snakeKey];
  if (typeof snake === 'string' && snake.trim()) {
    return snake.trim();
  }

  return undefined;
}

export function normalizeFieldOrder(schema: Array<Partial<FormField>>): FormField[] {
  return schema
    .filter((field) => !isLegacyParameterField(field))
    .map((field, index) => sanitizeField(field, index + 1));
}

/** Removed Form Builder Parameter type — drop from loaded schemas (DB unchanged). */
function isLegacyParameterField(
  field: Partial<FormField> & Record<string, unknown>,
): boolean {
  const candidates = [
    field.fieldTypeName,
    field.type,
    field['field_type'],
    field['field_type_name'],
  ].map((value) =>
    String(value ?? '')
      .trim()
      .toLowerCase(),
  );
  return candidates.includes('parameter');
}
