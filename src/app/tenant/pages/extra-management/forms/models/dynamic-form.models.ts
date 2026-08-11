import { FieldCondition } from '../../../../../shared/conditional-logic';
import { OptionSource } from '../../../../form-builder/models/form-field.model';

export type FieldType =
  | 'text'
  | 'number'
  | 'email'
  | 'password'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'date'
  | 'radio'
  | 'image'
  | 'file'
  | 'parameter'
  | 'signature'
  | 'user-timestamp'
  | 'rating'
  | 'range'
  | 'barcode'
  | 'qr-code';

/** Select option — string label, or label+value (id) for location dependencies. */
export type FormSelectOption =
  | string
  | {
      label: string;
      value: string | number;
    };

export interface FormFieldConfig {
  id: string;
  type: FieldType;
  label: string;
  name: string;
  placeholder?: string;
  required: boolean;
  readonly?: boolean;
  width?: string;
  /** System/default field — created with the section and not deletable. */
  isDefault?: boolean;
  /** Static / dynamic select options (preview / payload). */
  options?: FormSelectOption[];
  /** User-entered value for this field. */
  value?: string;
  /** Preserved from Form Builder — enables dynamic option editing on reload. */
  optionSource?: OptionSource;
  fieldTypeName?: string;
  isEditable?: boolean;
  isShow?: boolean;
  validations?: Record<string, unknown>;
  condition?: FieldCondition;
  defaultValue?: unknown;
  /** Parameter field category: currency, length, weight, volume. */
  parameterCategory?: string;
  /** Parameter field unit (e.g. USD, m, kg). */
  parameterUnit?: string;
  /** Maximum rating value (default 5). */
  maxRating?: number;
  /** Range field minimum / from value. */
  rangeMin?: number;
  /** Range field maximum / to value. */
  rangeMax?: number;
}

export interface FormRow {
  id: string;
  fields: FormFieldConfig[];
}

export interface CustomFormSection {
  id: string;
  name: string;
  type: 'custom';
  rows: FormRow[];
}

export type FormSection = CustomFormSection;

export type FrequencyType = 'atOnce' | 'recurring';
export type FrequencyInterval = 'day' | 'week' | 'month' | 'year';
export type FrequencyMonthMode = 'dayOfMonth' | 'onThe';

export interface FrequencyRecurringConfig {
  every: number;
  interval: FrequencyInterval;
  repeatCount: number;
  daysOfWeek: string[];
  monthMode: FrequencyMonthMode;
  dayOfMonth: number;
  weekOrder: string;
  onTheMonth: string;
  yearMonth: string;
  yearDay: number;
}

export function createDefaultFrequencyRecurring(): FrequencyRecurringConfig {
  return {
    every: 1,
    interval: 'month',
    repeatCount: 1,
    daysOfWeek: [],
    monthMode: 'dayOfMonth',
    dayOfMonth: 1,
    weekOrder: 'first',
    onTheMonth: 'january',
    yearMonth: 'january',
    yearDay: 1,
  };
}

export interface FormMetaConfig {
  assignJobPosition: string[];
  assignUsers: string[];
  reportJobPosition: string[];
  reportUsers: string[];
  frequencyJobPosition: string[];
  frequencyDate: string | null;
  frequencyType: FrequencyType;
  frequencyRecurring: FrequencyRecurringConfig;
}

export interface DynamicFormPayload {
  formName: string;
  assign: {
    jobPosition: number[] | null;
    users: number[] | null;
  };
  report: {
    jobPosition: number[] | null;
    users: number[] | null;
  };
  frequency: {
    jobPosition: string | null;
    date: string | null;
    type: FrequencyType;
    recurring: FrequencyRecurringConfig | null;
  };
  sections: Array<{
    id: string;
    name: string;
    type: 'custom';
    rows: Array<{ fields: Omit<FormFieldConfig, 'id'>[] }>;
  }>;
}

export interface SavedDynamicForm {
  id: string;
  formName: string;
  sectionCount: number;
  sectionTypes: string[];
  createdAt: string;
  payload: DynamicFormPayload;
}

export const FIELD_TYPE_OPTIONS: { label: string; value: FieldType }[] = [
  { label: 'Text', value: 'text' },
  { label: 'Number', value: 'number' },
  { label: 'Email', value: 'email' },
  { label: 'Password', value: 'password' },
  { label: 'Textarea', value: 'textarea' },
  { label: 'Select', value: 'select' },
  { label: 'Checkbox', value: 'checkbox' },
  { label: 'Date', value: 'date' },
  { label: 'Radio', value: 'radio' },
  { label: 'Image', value: 'image' },
  { label: 'File', value: 'file' },
  { label: 'Parameter', value: 'parameter' },
  { label: 'Signature', value: 'signature' },
  { label: 'User Timestamp', value: 'user-timestamp' },
  { label: 'Rating', value: 'rating' },
  { label: 'Range', value: 'range' },
  { label: 'Barcode', value: 'barcode' },
  { label: 'QR Code', value: 'qr-code' },
];

export const WIDTH_OPTIONS = [
  { label: 'Auto', value: 'auto' },
  { label: '25%', value: '25%' },
  { label: '50%', value: '50%' },
  { label: '75%', value: '75%' },
  { label: '100%', value: '100%' },
];

export function createId(prefix = 'id'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createEmptyRow(): FormRow {
  return { id: createId('row'), fields: [] };
}

export function createCustomSection(name: string): CustomFormSection {
  return {
    id: createId('section'),
    name: name.trim(),
    type: 'custom',
    rows: [],
  };
}

export function stripFieldId(field: FormFieldConfig): Omit<FormFieldConfig, 'id'> & {
  id?: string;
  condition?: FieldCondition;
} {
  const {
    optionSource: _optionSource,
    fieldTypeName: _fieldTypeName,
    isEditable: _isEditable,
    isShow: _isShow,
    validations: _validations,
    defaultValue: _defaultValue,
    options,
    condition,
    id,
    ...rest
  } = field;

  const normalizedOptions = options?.map((opt) =>
    typeof opt === 'string' ? opt : String(opt.label ?? opt.value),
  );

  return {
    ...rest,
    ...(id ? { id } : {}),
    ...(condition ? { condition } : {}),
    ...(normalizedOptions ? { options: normalizedOptions } : {}),
  };
}

/** Assignable user / job position option used to resolve names into IDs. */
export interface AssignReportOption {
  id: string | number;
  name: string;
}

export interface AssignReportOptions {
  users?: AssignReportOption[];
  jobPositions?: AssignReportOption[];
}

function resolveSelectedIds(
  names: string[],
  options: AssignReportOption[] = [],
): number[] {
  const ids = new Set<number>();

  for (const name of names) {
    if (!name) continue;

    for (const option of options) {
      if (option.name === name) {
        const id = Number(option.id);
        if (Number.isFinite(id)) {
          ids.add(id);
        }
      }
    }
  }

  return [...ids];
}

export function buildDynamicFormPayload(
  formName: string,
  sections: FormSection[],
  meta: FormMetaConfig,
  options: AssignReportOptions = {},
): DynamicFormPayload {
  const assignJobPositionIds = resolveSelectedIds(meta.assignJobPosition, options.jobPositions);
  const assignUserIds = resolveSelectedIds(meta.assignUsers, options.users);
  const reportJobPositionIds = resolveSelectedIds(meta.reportJobPosition, options.jobPositions);
  const reportUserIds = resolveSelectedIds(meta.reportUsers, options.users);

  return {
    formName: formName.trim(),
    assign: {
      jobPosition: assignJobPositionIds.length ? assignJobPositionIds : null,
      users: assignUserIds.length ? assignUserIds : null,
    },
    report: {
      jobPosition: reportJobPositionIds.length ? reportJobPositionIds : null,
      users: reportUserIds.length ? reportUserIds : null,
    },
    frequency: {
      jobPosition: meta.frequencyJobPosition.length ? meta.frequencyJobPosition.join(', ') : null,
      date: meta.frequencyType === 'atOnce' ? meta.frequencyDate : null,
      type: meta.frequencyType,
      recurring:
        meta.frequencyType === 'recurring' ? { ...meta.frequencyRecurring } : null,
    },
    sections: sections.map((section) => ({
      id: section.id,
      name: section.name,
      type: 'custom' as const,
      rows: section.rows.map((row) => ({
        fields: row.fields.map(stripFieldId),
      })),
    })),
  };
}
