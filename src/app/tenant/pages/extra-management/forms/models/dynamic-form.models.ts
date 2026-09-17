import { FieldCondition } from '../../../../../shared/conditional-logic';
import {
  OptionSource,
  SelectSelectionType,
} from '../../../../form-builder/models/form-field.model';

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
  | 'signature'
  | 'time'
  | 'rating'
  | 'range'
  | 'price'
  | 'length'
  | 'mass'
  | 'volume'
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
  /**
   * Select field only. Defaults to `single` for backward compatibility
   * (same convention as setup-user Form Builder).
   */
  selectionType?: SelectSelectionType;
  /** User-entered value for this field. Multi-select stores an array. */
  value?: string | string[];
  /** Preserved from Form Builder — enables dynamic option editing on reload. */
  optionSource?: OptionSource;
  fieldTypeName?: string;
  isEditable?: boolean;
  isShow?: boolean;
  validations?: Record<string, unknown>;
  condition?: FieldCondition;
  defaultValue?: unknown;
  /** Maximum rating value (default 5). */
  maxRating?: number;
  /**
   * Range field value type. Defaults to `number` when missing.
   */
  rangeType?: 'number' | 'date' | 'time';
  /** Number range absolute minimum bound. */
  rangeMin?: number;
  /** Number range absolute maximum bound. */
  rangeMax?: number;
  /** Number range step increment. */
  rangeStep?: number;
  /** Date range minimum bound (YYYY-MM-DD). */
  rangeMinDate?: string;
  /** Date range maximum bound (YYYY-MM-DD). */
  rangeMaxDate?: string;
  /** Placeholder for the Range From / first input. */
  rangePlaceholderFrom?: string;
  /** Placeholder for the Range To / second input. */
  rangePlaceholderTo?: string;
  /** Time field / Time range display preference. Values are stored as HH:mm (24h). */
  timeFormat?: '12' | '24';
  /** Measurement fields: fixed vs selectable unit. */
  unitMode?: 'fixed' | 'selectable';
  unit?: string;
  minValue?: number;
  maxValue?: number;
  /**
   * Number field / Number range. When true, decimal values are allowed.
   * Missing/undefined is treated as false for backward compatibility.
   */
  allowDecimal?: boolean;
  /**
   * Text / Text Area only. Maximum allowed characters.
   * Missing/undefined uses 255 (text) or 5000 (textarea).
   */
  characterLimit?: number;
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

/** Assign / Report distribution mode stored on the template schema. */
export type AssignReportMode = 'individual' | 'shared';

export const ASSIGN_REPORT_MODE_OPTIONS: { label: string; value: AssignReportMode }[] = [
  { label: 'Individual', value: 'individual' },
  { label: 'Shared', value: 'shared' },
];

export function normalizeAssignReportMode(value: unknown): AssignReportMode {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase();
  return raw === 'shared' ? 'shared' : 'individual';
}

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

const MONTH_NUMBER: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

/**
 * Drop fields that do not apply to the active interval/mode so leftover
 * weekly/monthly "onThe" values cannot override yearly day-of-month schedules.
 */
export function sanitizeFrequencyRecurring(
  recurring: FrequencyRecurringConfig,
): FrequencyRecurringConfig {
  const defaults = createDefaultFrequencyRecurring();
  const every = Number(recurring.every) || 1;
  const repeatCount = Number(recurring.repeatCount) || 1;
  const interval = recurring.interval || defaults.interval;

  switch (interval) {
    case 'day':
      return {
        ...defaults,
        every,
        interval,
        repeatCount,
      };
    case 'week':
      return {
        ...defaults,
        every,
        interval,
        repeatCount,
        daysOfWeek: [...(recurring.daysOfWeek ?? [])],
      };
    case 'month': {
      const monthMode: FrequencyMonthMode =
        recurring.monthMode === 'onThe' ? 'onThe' : 'dayOfMonth';
      if (monthMode === 'dayOfMonth') {
        return {
          ...defaults,
          every,
          interval,
          repeatCount,
          monthMode,
          dayOfMonth: Number(recurring.dayOfMonth) || 1,
        };
      }
      return {
        ...defaults,
        every,
        interval,
        repeatCount,
        monthMode,
        weekOrder: recurring.weekOrder || defaults.weekOrder,
        onTheMonth: recurring.onTheMonth || defaults.onTheMonth,
        daysOfWeek: [...(recurring.daysOfWeek ?? [])],
      };
    }
    case 'year':
      // Yearly UI is day-of-month only (yearMonth + yearDay). Never keep onThe leftovers.
      return {
        ...defaults,
        every,
        interval,
        repeatCount,
        monthMode: 'dayOfMonth',
        yearMonth: recurring.yearMonth || defaults.yearMonth,
        yearDay: Number(recurring.yearDay) || 1,
      };
    default:
      return {
        ...defaults,
        every,
        interval: 'month',
        repeatCount,
      };
  }
}

/** Anchor date for the first occurrence (used by the API for recurring series). */
export function resolveFrequencyDate(
  type: FrequencyType,
  frequencyDate: string | null,
  recurring: FrequencyRecurringConfig | null,
  today: Date = new Date(),
): string | null {
  if (type === 'atOnce') {
    return frequencyDate;
  }
  if (!recurring || recurring.interval !== 'year') {
    return null;
  }

  const month = MONTH_NUMBER[recurring.yearMonth] ?? 1;
  const day = Math.min(Math.max(Number(recurring.yearDay) || 1, 1), 31);
  let year = today.getFullYear();
  const pad = (n: number) => String(n).padStart(2, '0');
  const daysInMonth = new Date(year, month, 0).getDate();
  const safeDay = Math.min(day, daysInMonth);
  const candidate = `${year}-${pad(month)}-${pad(safeDay)}`;
  const todayStr = `${year}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  if (candidate < todayStr) {
    year += 1;
    const nextDays = new Date(year, month, 0).getDate();
    return `${year}-${pad(month)}-${pad(Math.min(day, nextDays))}`;
  }
  return candidate;
}

const FREQUENCY_WEEKDAY_NAME: Record<string, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

const FREQUENCY_MONTH_NAME: Record<string, string> = {
  january: 'January',
  february: 'February',
  march: 'March',
  april: 'April',
  may: 'May',
  june: 'June',
  july: 'July',
  august: 'August',
  september: 'September',
  october: 'October',
  november: 'November',
  december: 'December',
};

const FREQUENCY_WEEK_ORDER_NAME: Record<string, string> = {
  first: 'First',
  second: 'Second',
  third: 'Third',
  fourth: 'Fourth',
  last: 'Last',
};

/** Human-readable summary of the template frequency — mirrors the Frequency step rules. */
export function formatFrequencySummary(
  frequency: DynamicFormPayload['frequency'] | null | undefined,
): string {
  const freq = frequency ?? ({} as DynamicFormPayload['frequency']);
  const type: FrequencyType = freq.type === 'recurring' ? 'recurring' : 'atOnce';

  if (type === 'atOnce') {
    if (freq.date) {
      const parsed = new Date(freq.date);
      const dateText = Number.isNaN(parsed.getTime())
        ? freq.date
        : new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }).format(parsed);
      return `At Once — ${dateText}`;
    }
    return 'At Once';
  }

  const recurring = sanitizeFrequencyRecurring(
    freq.recurring ?? createDefaultFrequencyRecurring(),
  );
  const every = Number(recurring.every) || 1;

  switch (recurring.interval) {
    case 'day':
      return every === 1 ? 'Daily' : `Every ${every} days`;
    case 'week': {
      const days = (recurring.daysOfWeek ?? [])
        .map((day) => FREQUENCY_WEEKDAY_NAME[day] ?? day)
        .filter(Boolean);
      if (!days.length) {
        return every === 1 ? 'Weekly' : `Every ${every} weeks`;
      }
      const dayText = days.join(', ');
      return every === 1 ? `Every ${dayText}` : `Every ${every} weeks on ${dayText}`;
    }
    case 'month':
      if (recurring.monthMode === 'onThe') {
        const order = FREQUENCY_WEEK_ORDER_NAME[recurring.weekOrder] ?? recurring.weekOrder;
        const month = FREQUENCY_MONTH_NAME[recurring.onTheMonth] ?? recurring.onTheMonth;
        const when = `on the ${order} ${month}`;
        return every === 1 ? `Monthly ${when}` : `Every ${every} months ${when}`;
      }
      {
        const day = recurring.dayOfMonth === -1 ? 'last day' : `day ${recurring.dayOfMonth}`;
        return every === 1 ? `Monthly on ${day}` : `Every ${every} months on ${day}`;
      }
    case 'year': {
      const month = FREQUENCY_MONTH_NAME[recurring.yearMonth] ?? recurring.yearMonth;
      const when = `on ${month} ${recurring.yearDay}`;
      return every === 1 ? `Yearly ${when}` : `Every ${every} years ${when}`;
    }
    default:
      return 'Recurring';
  }
}

export interface FormMetaConfig {
  assignJobPosition: string[];
  assignUsers: string[];
  assignMode: AssignReportMode;
  reportJobPosition: string[];
  reportUsers: string[];
  reportMode: AssignReportMode;
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
    mode: AssignReportMode;
  };
  report: {
    jobPosition: number[] | null;
    users: number[] | null;
    mode: AssignReportMode;
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
  { label: 'Signature', value: 'signature' },
  { label: 'Time', value: 'time' },
  { label: 'Rating', value: 'rating' },
  { label: 'Range', value: 'range' },
  { label: 'Price', value: 'price' },
  { label: 'Length / Distance', value: 'length' },
  { label: 'Weight / Mass', value: 'mass' },
  { label: 'Volume / Capacity', value: 'volume' },
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

  const recurring =
    meta.frequencyType === 'recurring'
      ? sanitizeFrequencyRecurring(meta.frequencyRecurring)
      : null;

  return {
    formName: formName.trim(),
    assign: {
      jobPosition: assignJobPositionIds.length ? assignJobPositionIds : null,
      users: assignUserIds.length ? assignUserIds : null,
      mode: normalizeAssignReportMode(meta.assignMode),
    },
    report: {
      jobPosition: reportJobPositionIds.length ? reportJobPositionIds : null,
      users: reportUserIds.length ? reportUserIds : null,
      mode: normalizeAssignReportMode(meta.reportMode),
    },
    frequency: {
      jobPosition: meta.frequencyJobPosition.length
        ? meta.frequencyJobPosition.join(', ')
        : null,
      date: resolveFrequencyDate(meta.frequencyType, meta.frequencyDate, recurring),
      type: meta.frequencyType,
      recurring,
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
