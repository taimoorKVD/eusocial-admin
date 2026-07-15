export type SectionType = 'dataEntry' | 'checklistForm' | 'visualForm';

export type FieldType =
  | 'text'
  | 'number'
  | 'email'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'date'
  | 'radio';

export interface FormFieldConfig {
  id: string;
  type: FieldType;
  label: string;
  name: string;
  placeholder?: string;
  required: boolean;
  readonly?: boolean;
  width?: string;
}

export interface FormRow {
  id: string;
  fields: FormFieldConfig[];
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
}

export type FormSection = DataEntrySection | ChecklistFormSection | VisualFormSection;

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
  { label: 'Visual Form', value: 'visualForm' },
  { label: 'Data Entry', value: 'dataEntry' },
  { label: 'Checklist Form', value: 'checklistForm' },
];

export const FIELD_TYPE_OPTIONS: { label: string; value: FieldType }[] = [
  { label: 'Text', value: 'text' },
  { label: 'Number', value: 'number' },
  { label: 'Email', value: 'email' },
  { label: 'Textarea', value: 'textarea' },
  { label: 'Select', value: 'select' },
  { label: 'Checkbox', value: 'checkbox' },
  { label: 'Date', value: 'date' },
  { label: 'Radio', value: 'radio' },
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

export function createDataEntrySection(): DataEntrySection {
  return {
    id: createId('section'),
    type: 'dataEntry',
    rows: [createEmptyRow()],
  };
}

export function createChecklistFormSection(): ChecklistFormSection {
  return {
    id: createId('section'),
    type: 'checklistForm',
    rows: [createEmptyRow()],
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
  };
}

export function createSection(type: SectionType): FormSection {
  switch (type) {
    case 'dataEntry':
      return createDataEntrySection();
    case 'checklistForm':
      return createChecklistFormSection();
    case 'visualForm':
      return createVisualFormSection();
  }
}

export function stripFieldId(field: FormFieldConfig): Omit<FormFieldConfig, 'id'> {
  const { id: _id, ...rest } = field;
  return rest;
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
      if (section.type === 'visualForm') {
        return {
          type: 'visualForm' as const,
          configuration: { ...section.configuration },
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
