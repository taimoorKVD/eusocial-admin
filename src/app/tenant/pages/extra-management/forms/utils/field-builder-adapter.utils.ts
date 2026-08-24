import { cloneConditionalLogic, serializeConditionalLogic } from '../../../../../shared/conditional-logic';
import {
  getDefaultCharacterLimit,
  resolveCharacterLimit,
  supportsCharacterLimit,
} from '../../../../../shared/dynamic-form/character-limit.utils';
import { FormField, FieldOption } from '../../../../form-builder/models/form-field.model';
import {
  cloneOptionSource,
  createFieldFromTemplate,
  toFieldName,
} from '../../../../form-builder/utils/form-field.factory';
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
  // { label: 'Date Picker', value: 'date' },
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
    case 'date':
    case 'file':
      return 'text';
    case 'image':
      return 'image';
    case 'parameter':
    case 'signature':
    case 'user-timestamp':
    case 'rating':
    case 'range':
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
    isReadonly: field.readonly === true,
    isEditable: field.isDefault ? false : field.isEditable !== false,
    isShow: field.isShow !== false,
    options: builderOptions,
    optionSource: cloneOptionSource(field.optionSource),
    width: widthToGridUnits(field.width),
    value: field.value,
    defaultValue: field.defaultValue ?? field.value ?? '',
    validations: field.validations ? { ...field.validations } : {},
    condition: cloneConditionalLogic(field.condition),
    parameterCategory: field.parameterCategory,
    parameterUnit: field.parameterUnit,
    maxRating: field.maxRating,
    rangeMin: field.rangeMin,
    rangeMax: field.rangeMax,
    allowDecimal: field.allowDecimal === true,
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
  const optionLabels = (field.options ?? [])
    .map((opt) => (typeof opt === 'string' ? opt : String(opt.label ?? opt.value)))
    .filter((opt) => opt.trim().length > 0);

  return {
    id: options.preserveId !== false && field.id ? field.id : createId('field'),
    type,
    label: (field.label || 'Untitled Field').trim(),
    name: toFieldName(field.label || field.name || 'field'),
    placeholder: field.placeholder?.trim() || undefined,
    required: !!field.required,
    readonly: field.isReadonly || undefined,
    options: optionLabels.length ? optionLabels : undefined,
    width: mapBuilderWidthToPercent(field.width),
    isDefault: false,
    value: field.value != null ? String(field.value) : undefined,
    optionSource: cloneOptionSource(field.optionSource),
    fieldTypeName: field.fieldTypeName ?? type,
    isEditable: field.isEditable,
    isShow: field.isShow,
    validations: field.validations ? { ...field.validations } : undefined,
    condition: serializeConditionalLogic(field.condition),
    defaultValue: field.defaultValue,
    parameterCategory: field.parameterCategory,
    parameterUnit: field.parameterUnit,
    maxRating: field.maxRating,
    rangeMin: field.rangeMin,
    rangeMax: field.rangeMax,
    allowDecimal: field.type === 'number' ? field.allowDecimal === true : undefined,
    characterLimit: supportsCharacterLimit(type)
      ? (resolveCharacterLimit(type, field.characterLimit) ??
        getDefaultCharacterLimit(type))
      : undefined,
  };
}

function mapConfigOptionsToBuilder(
  field: FormFieldConfig,
): Array<string | FieldOption> {
  const rawOptions = field.options ?? [];

  if (field.optionSource?.type === 'dynamic') {
    return rawOptions.map((opt) =>
      typeof opt === 'string'
        ? { label: opt, value: opt }
        : { label: String(opt.label), value: opt.value },
    );
  }

  return rawOptions.map((opt) =>
    typeof opt === 'string'
      ? { label: opt, value: opt }
      : { label: String(opt.label), value: opt.value },
  );
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
    'parameter',
    'signature',
    'user-timestamp',
    'rating',
    'range',
    'barcode',
    'qr-code',
  ];

  if (allowed.includes(candidate as FieldType)) {
    return candidate as FieldType;
  }

  if (field.type === 'image') return 'image';
  if (allowed.includes(field.type as FieldType)) {
    return field.type as FieldType;
  }

  return 'text';
}

/** Convert FormField 12-col width to a CSS percentage used by section layout. */
export function mapBuilderWidthToPercent(width?: number): string {
  if (width == null || width <= 0) {
    return '25%';
  }
  const clamped = Math.min(12, Math.max(1, Math.round(width)));
  return `${Math.round((clamped / 12) * 100)}%`;
}

/** Approximate grid units (out of 12) for a FormFieldConfig width string. */
export function widthToGridUnits(width?: string): number {
  if (!width || width === 'auto') return 3;
  if (width.endsWith('%')) {
    const pct = parseFloat(width);
    if (Number.isFinite(pct) && pct > 0) {
      return Math.min(12, Math.max(1, Math.round((pct / 100) * 12)));
    }
  }
  return 3;
}

export function rowUsedGridUnits(fields: FormFieldConfig[]): number {
  return fields.reduce((sum, field) => sum + widthToGridUnits(field.width), 0);
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
