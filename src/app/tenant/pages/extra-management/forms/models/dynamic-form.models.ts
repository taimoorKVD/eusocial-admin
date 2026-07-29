export type SectionType =
  | 'custom'
  | 'responseForm'
  | 'dataEntry'
  | 'checklistForm'
  | 'visualForm';

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
  condition?: { fieldId: string; value: unknown };
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

export interface ResponseFormSection {
  id: string;
  type: 'responseForm';
  rows: FormRow[];
}

export interface DataEntrySection {
  id: string;
  type: 'dataEntry';
  rows: FormRow[];
}

export interface ChecklistFormSection {
  id: string;
  type: 'checklistForm';
  rows: FormRow[];
}

export interface VisualFormFile {
  name: string;
  size: number;
}

export interface VisualFormConfiguration {
  files: VisualFormFile[];
  instructions: string;
}

export interface VisualFormSection {
  id: string;
  type: 'visualForm';
  configuration: VisualFormConfiguration;
  /** User-added fields beyond the mandatory upload + description defaults. */
  rows: FormRow[];
}

export type FormSection =
  | CustomFormSection
  | ResponseFormSection
  | DataEntrySection
  | ChecklistFormSection
  | VisualFormSection;

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
    jobPosition: string | null;
    users: string | null;
  };
  report: {
    jobPosition: string | null;
    users: string | null;
  };
  frequency: {
    jobPosition: string | null;
    date: string | null;
    type: FrequencyType;
    recurring: FrequencyRecurringConfig | null;
  };
  sections: Array<
    | {
        id: string;
        name: string;
        type: 'custom';
        rows: Array<{ fields: Omit<FormFieldConfig, 'id'>[] }>;
      }
    | {
        type: 'responseForm';
        rows: Array<{ fields: Omit<FormFieldConfig, 'id'>[] }>;
      }
    | {
        type: 'dataEntry';
        rows: Array<{ fields: Omit<FormFieldConfig, 'id'>[] }>;
      }
    | {
        type: 'checklistForm';
        rows: Array<{ fields: Omit<FormFieldConfig, 'id'>[] }>;
      }
    | {
        type: 'visualForm';
        configuration: VisualFormConfiguration;
        rows: Array<{ fields: Omit<FormFieldConfig, 'id'>[] }>;
      }
  >;
}

export interface SavedDynamicForm {
  id: string;
  formName: string;
  sectionCount: number;
  sectionTypes: SectionType[];
  createdAt: string;
  payload: DynamicFormPayload;
}

export const SECTION_OPTIONS: { label: string; value: SectionType }[] = [
  // { label: 'Response Form', value: 'responseForm' },
  { label: 'Data Entry', value: 'dataEntry' },
  { label: 'Checklist Form', value: 'checklistForm' },
  { label: 'Visual Form', value: 'visualForm' },
];

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

function createDefaultField(
  partial: Omit<FormFieldConfig, 'id' | 'isDefault'> & { isDefault?: boolean },
): FormFieldConfig {
  return {
    id: createId('field'),
    isDefault: true,
    ...partial,
  };
}

export function createResponseFormDefaultFields(): FormFieldConfig[] {
  return [
    createDefaultField({
      type: 'text',
      label: 'Description',
      name: 'description',
      placeholder: 'Lorem Ipsum',
      required: true,
      width: '50%',
    }),
  ];
}

export function createDataEntryDefaultFields(): FormFieldConfig[] {
  return [
    createDefaultField({
      type: 'select',
      label: 'Item',
      name: 'item',
      placeholder: 'Select item',
      required: true,
      width: '22%',
    }),
    createDefaultField({
      type: 'checkbox',
      label: 'Include Par',
      name: 'include_par',
      required: false,
      width: '18%',
    }),
    createDefaultField({
      type: 'select',
      label: 'User Response',
      name: 'user_response',
      required: true,
      width: '22%',
      options: ['Current Quantity'],
    }),
    createDefaultField({
      type: 'select',
      label: 'Action',
      name: 'action',
      required: true,
      width: '16%',
      options: ['Order'],
    }),
  ];
}

export function createChecklistFormDefaultFields(): FormFieldConfig[] {
  return [
    createDefaultField({
      type: 'text',
      label: 'Description',
      name: 'description',
      placeholder: 'Lorem Ipsum',
      required: true,
      width: '40%',
    }),
    createDefaultField({
      type: 'text',
      label: 'Response',
      name: 'response_yes',
      placeholder: 'Yes',
      required: true,
      width: '25%',
    }),
    createDefaultField({
      type: 'text',
      label: 'Response',
      name: 'response_no',
      placeholder: 'No',
      required: true,
      width: '25%',
    }),
  ];
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

export function createResponseFormRow(): FormRow {
  return { id: createId('row'), fields: createResponseFormDefaultFields() };
}

export function createDataEntryRow(): FormRow {
  return { id: createId('row'), fields: createDataEntryDefaultFields() };
}

export function createChecklistFormRow(): FormRow {
  return { id: createId('row'), fields: createChecklistFormDefaultFields() };
}

export function createResponseFormSection(): ResponseFormSection {
  return {
    id: createId('section'),
    type: 'responseForm',
    rows: [createResponseFormRow()],
  };
}

export function createDataEntrySection(): DataEntrySection {
  return {
    id: createId('section'),
    type: 'dataEntry',
    rows: [createDataEntryRow()],
  };
}

export function createChecklistFormSection(): ChecklistFormSection {
  return {
    id: createId('section'),
    type: 'checklistForm',
    rows: [createChecklistFormRow()],
  };
}

export function createVisualFormSection(): VisualFormSection {
  return {
    id: createId('section'),
    type: 'visualForm',
    configuration: {
      files: [],
      instructions: '',
    },
    rows: [createEmptyRow()],
  };
}

export function createSection(type: SectionType): FormSection {
  switch (type) {
    case 'custom':
      return createCustomSection('Untitled Section');
    case 'responseForm':
      return createResponseFormSection();
    case 'dataEntry':
      return createDataEntrySection();
    case 'checklistForm':
      return createChecklistFormSection();
    case 'visualForm':
      return createVisualFormSection();
  }
}

export function stripFieldId(field: FormFieldConfig): Omit<FormFieldConfig, 'id'> {
  const {
    id: _id,
    optionSource: _optionSource,
    fieldTypeName: _fieldTypeName,
    isEditable: _isEditable,
    isShow: _isShow,
    validations: _validations,
    condition: _condition,
    defaultValue: _defaultValue,
    options,
    ...rest
  } = field;

  const normalizedOptions = options?.map((opt) =>
    typeof opt === 'string' ? opt : String(opt.label ?? opt.value),
  );

  return {
    ...rest,
    ...(normalizedOptions ? { options: normalizedOptions } : {}),
  };
}

export function buildDynamicFormPayload(
  formName: string,
  sections: FormSection[],
  meta: FormMetaConfig,
): DynamicFormPayload {
  return {
    formName: formName.trim(),
    assign: {
      jobPosition: meta.assignJobPosition.length ? meta.assignJobPosition.join(', ') : null,
      users: meta.assignUsers.length ? meta.assignUsers.join(', ') : null,
    },
    report: {
      jobPosition: meta.reportJobPosition.length ? meta.reportJobPosition.join(', ') : null,
      users: meta.reportUsers.length ? meta.reportUsers.join(', ') : null,
    },
    frequency: {
      jobPosition: meta.frequencyJobPosition.length ? meta.frequencyJobPosition.join(', ') : null,
      date: meta.frequencyType === 'atOnce' ? meta.frequencyDate : null,
      type: meta.frequencyType,
      recurring:
        meta.frequencyType === 'recurring' ? { ...meta.frequencyRecurring } : null,
    },
    sections: sections.map((section) => {
      if (section.type === 'custom') {
        return {
          id: section.id,
          name: section.name,
          type: 'custom' as const,
          rows: section.rows.map((row) => ({
            fields: row.fields.map(stripFieldId),
          })),
        };
      }

      if (section.type === 'visualForm') {
        return {
          type: 'visualForm' as const,
          configuration: { ...section.configuration },
          rows: section.rows.map((row) => ({
            fields: row.fields.map(stripFieldId),
          })),
        };
      }

      return {
        type: section.type,
        rows: section.rows.map((row) => ({
          fields: row.fields.map(stripFieldId),
        })),
      };
    }),
  };
}
