import { FieldCondition } from '../../../../../shared/conditional-logic';
import {
  OptionSource,
  SelectSelectionType,
} from '../../../../form-builder/models/form-field.model';
import { FormLogicRule } from '../../../../forms/logic-rules/logic-rule.models';
import { normalizeLogicRules } from '../../../../forms/logic-rules/logic-rule.utils';

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
  | 'temperature'
  | 'barcode'
  | 'qr-code';

/** Select option — label, record value/id, or label+value for location dependencies. */
export type FormSelectOption =
  | string
  | number
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
  /** Single Date field minimum bound (YYYY-MM-DD). */
  minDate?: string;
  /** Single Date field maximum bound (YYYY-MM-DD). */
  maxDate?: string;
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
  { label: 'One response', value: 'individual' },
  { label: 'All assigned', value: 'shared' },
];

export function normalizeAssignReportMode(value: unknown): AssignReportMode {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase();
  return raw === 'shared' ? 'shared' : 'individual';
}

/**
 * User-facing Assignment Mode label. Internal values stay `individual` / `shared`.
 * Returns `emptyLabel` when the value is blank (callers may pass `''` or `'—'`).
 */
export function formatAssignReportModeLabel(
  value: unknown,
  emptyLabel = '',
): string {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (!raw) {
    return emptyLabel;
  }
  if (raw === 'shared') {
    return 'All assigned';
  }
  if (raw === 'individual') {
    return 'One response';
  }
  return ASSIGN_REPORT_MODE_OPTIONS.find((option) => option.value === raw)?.label
    ?? raw.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
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
  /**
   * Single assignment time (`HH:mm` 24h). Kept for backward compatibility;
   * recurring schedules use `times` (length = repeatCount).
   */
  time: string | null;
  /**
   * Per-occurrence assignment times for recurring schedules (`HH:mm` 24h).
   * Length should match `repeatCount`.
   */
  times: string[];
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
    time: null,
    times: [],
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

/** 12h parts as returned by the edit-template API (`timesParts`). */
export interface FrequencyTimeParts {
  hour?: string | number | null;
  minute?: string | number | null;
  period?: string | null;
}

/**
 * Resolve recurring schedule slots (`HH:mm` 24h) from edit API shapes:
 * `times`, `timesAmPm`, and/or `timesParts` (recurring or frequency root).
 */
export function resolveFrequencyScheduleTimes(
  recurring: FrequencyRecurringConfig | null | undefined,
  frequency?: {
    times?: string[] | null;
    timesAmPm?: string[] | null;
    timesParts?: FrequencyTimeParts[] | null;
  } | null,
): string[] {
  const source = (recurring ?? {}) as FrequencyRecurringConfig & {
    timesAmPm?: string[] | null;
    timesParts?: FrequencyTimeParts[] | null;
  };
  const repeatCount = Math.max(1, Number(source.repeatCount) || 1);

  const fromTimes = normalizeFrequencyTimes(source.times, repeatCount);
  if (fromTimes.some((slot) => !!slot)) {
    return fromTimes;
  }

  const fromFrequencyTimes = normalizeFrequencyTimes(frequency?.times, repeatCount);
  if (fromFrequencyTimes.some((slot) => !!slot)) {
    return fromFrequencyTimes;
  }

  const amPmSources = [source.timesAmPm, frequency?.timesAmPm];
  for (const amPm of amPmSources) {
    if (!Array.isArray(amPm) || !amPm.length) {
      continue;
    }
    const converted = normalizeFrequencyTimes(
      amPm.map((slot) => {
        if (typeof slot !== 'string' || !slot.trim()) {
          return '';
        }
        const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(slot.trim());
        if (!match) {
          return slot.trim();
        }
        const hour12 = Number(match[1]);
        const minute = Number(match[2]);
        const period = match[3].toUpperCase() === 'PM' ? 'PM' : 'AM';
        let hours24 = hour12 % 12;
        if (period === 'PM') {
          hours24 += 12;
        }
        if (
          !Number.isInteger(hour12) ||
          hour12 < 1 ||
          hour12 > 12 ||
          !Number.isInteger(minute) ||
          minute < 0 ||
          minute > 59
        ) {
          return '';
        }
        return `${String(hours24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      }),
      repeatCount,
    );
    if (converted.some((slot) => !!slot)) {
      return converted;
    }
  }

  const partsSources = [source.timesParts, frequency?.timesParts];
  for (const parts of partsSources) {
    if (!Array.isArray(parts) || !parts.length) {
      continue;
    }
    const converted = normalizeFrequencyTimes(
      parts.map((part) => {
        const hour12 = Number(part?.hour);
        const minute = Number(part?.minute);
        const periodRaw = String(part?.period ?? '')
          .trim()
          .toUpperCase();
        const period = periodRaw === 'PM' ? 'PM' : periodRaw === 'AM' ? 'AM' : null;
        if (
          !period ||
          !Number.isInteger(hour12) ||
          hour12 < 1 ||
          hour12 > 12 ||
          !Number.isInteger(minute) ||
          minute < 0 ||
          minute > 59
        ) {
          return '';
        }
        let hours24 = hour12 % 12;
        if (period === 'PM') {
          hours24 += 12;
        }
        return `${String(hours24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      }),
      repeatCount,
    );
    if (converted.some((slot) => !!slot)) {
      return converted;
    }
  }

  const legacyTime =
    typeof source.time === 'string' && source.time.trim() ? source.time.trim() : null;
  return normalizeFrequencyTimes(legacyTime ? [legacyTime] : [], repeatCount);
}

/**
 * Drop fields that do not apply to the active interval/mode so leftover
 * weekly/monthly "onThe" values cannot override yearly day-of-month schedules.
 * Also strips scheduling fields that belong only to other intervals.
 */
export function sanitizeFrequencyRecurring(
  recurring: FrequencyRecurringConfig,
): FrequencyRecurringConfig {
  const defaults = createDefaultFrequencyRecurring();
  const every = Number(recurring.every) || 1;
  const repeatCount = Math.max(1, Number(recurring.repeatCount) || 1);
  const interval = recurring.interval || defaults.interval;
  const normalizedTimes = resolveFrequencyScheduleTimes(recurring);

  switch (interval) {
    case 'day':
      return {
        ...defaults,
        every,
        interval,
        repeatCount,
        time: null,
        times: normalizedTimes,
      };
    case 'week':
      return {
        ...defaults,
        every,
        interval,
        repeatCount,
        daysOfWeek: [...(recurring.daysOfWeek ?? [])],
        time: null,
        times: normalizedTimes,
      };
    case 'month':
      // Monthly UI is On Day only — never keep leftover "On the" values.
      return {
        ...defaults,
        every,
        interval,
        repeatCount,
        monthMode: 'dayOfMonth',
        dayOfMonth: Number(recurring.dayOfMonth) || 1,
        time: null,
        times: normalizedTimes,
      };
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
        time: null,
        times: normalizedTimes,
      };
    default:
      return {
        ...defaults,
        every,
        interval: 'month',
        repeatCount,
        time: null,
        times: normalizedTimes,
      };
  }
}

/** Resize / pad recurring time slots to match `repeatCount`. */
export function normalizeFrequencyTimes(
  times: string[] | null | undefined,
  repeatCount: number,
): string[] {
  const count = Math.max(1, Number(repeatCount) || 1);
  const source = Array.isArray(times) ? times : [];
  const next: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const raw = source[i];
    next.push(typeof raw === 'string' ? raw.trim() : '');
  }
  return next;
}

const WEEKDAY_TO_JS: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function parseYmdLocal(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  ) {
    return null;
  }
  return date;
}

function formatYmdLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/** Resolve day-of-month for a given calendar month (`-1` = last day). */
function resolveDayInMonth(year: number, monthIndex: number, dayOfMonth: number): number | null {
  const last = daysInMonth(year, monthIndex);
  if (dayOfMonth === -1) {
    return last;
  }
  if (!Number.isFinite(dayOfMonth) || dayOfMonth < 1) {
    return null;
  }
  return Math.min(Math.floor(dayOfMonth), last);
}

/**
 * First weekly occurrence on/after `start` for the selected weekdays.
 * `every` weeks is measured from the week that contains `start` (week index 0).
 */
function firstWeeklyOccurrence(
  start: Date,
  every: number,
  daysOfWeek: string[],
): Date | null {
  const selected = new Set(
    daysOfWeek
      .map((day) => WEEKDAY_TO_JS[day])
      .filter((day): day is number => day !== undefined),
  );
  if (!selected.size) {
    return null;
  }

  const interval = Math.max(1, Number(every) || 1);
  const startDay = startOfLocalDay(start);
  // Monday-based week index relative to the start date's week.
  const startWeekMonday = new Date(startDay);
  const startJsDay = startWeekMonday.getDay();
  const mondayOffset = startJsDay === 0 ? -6 : 1 - startJsDay;
  startWeekMonday.setDate(startWeekMonday.getDate() + mondayOffset);

  for (let offset = 0; offset < 366 * 4; offset += 1) {
    const candidate = new Date(startDay);
    candidate.setDate(startDay.getDate() + offset);
    if (!selected.has(candidate.getDay())) {
      continue;
    }

    const candidateMonday = new Date(candidate);
    const jsDay = candidateMonday.getDay();
    const toMonday = jsDay === 0 ? -6 : 1 - jsDay;
    candidateMonday.setDate(candidateMonday.getDate() + toMonday);

    const weekDiff = Math.round(
      (candidateMonday.getTime() - startWeekMonday.getTime()) / (7 * 24 * 60 * 60 * 1000),
    );
    if (weekDiff < 0 || weekDiff % interval !== 0) {
      continue;
    }

    return candidate;
  }

  return null;
}

/** First monthly On-Day occurrence on/after `start`. */
function firstMonthlyOccurrence(
  start: Date,
  every: number,
  dayOfMonth: number,
): Date | null {
  const interval = Math.max(1, Number(every) || 1);
  const startDay = startOfLocalDay(start);
  let year = startDay.getFullYear();
  let month = startDay.getMonth();

  for (let step = 0; step < 480; step += 1) {
    const day = resolveDayInMonth(year, month, dayOfMonth);
    if (day != null) {
      const candidate = new Date(year, month, day);
      if (candidate >= startDay) {
        // Month index 0 is the start month; only months on the interval fire.
        const monthDiff =
          (year - startDay.getFullYear()) * 12 + (month - startDay.getMonth());
        if (monthDiff >= 0 && monthDiff % interval === 0) {
          return candidate;
        }
      }
    }
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }

  return null;
}

/**
 * First daily occurrence boundary: start + (every * repeatCount) days.
 * Example: start Oct 2, every 4, repeat 1 → Oct 6.
 */
function firstDailyOccurrence(
  start: Date,
  every: number,
  repeatCount: number,
): Date {
  const interval = Math.max(1, Number(every) || 1);
  const times = Math.max(1, Number(repeatCount) || 1);
  const result = startOfLocalDay(start);
  result.setDate(result.getDate() + interval * times);
  return result;
}

/**
 * Advance a first occurrence by additional repeat cycles (repeatCount - 1).
 */
function advanceByRepeatCycles(
  first: Date,
  every: number,
  repeatCount: number,
  unit: 'week' | 'month',
): Date {
  const interval = Math.max(1, Number(every) || 1);
  const extra = Math.max(0, (Math.max(1, Number(repeatCount) || 1) - 1) * interval);
  const result = new Date(first.getFullYear(), first.getMonth(), first.getDate());
  if (unit === 'week') {
    result.setDate(result.getDate() + extra * 7);
  } else {
    result.setMonth(result.getMonth() + extra);
  }
  return result;
}

/**
 * Minimum valid Schedule End Date for day / week / month / year recurring.
 * Returns null when start/config is incomplete (e.g. weekly with no days).
 */
export function resolveMinimumFrequencyEndDate(
  startDate: string | null | undefined,
  recurring: FrequencyRecurringConfig | null | undefined,
): string | null {
  const start = parseYmdLocal(startDate ?? null);
  if (!start || !recurring) {
    return null;
  }

  const every = Math.max(1, Number(recurring.every) || 1);
  const repeatCount = Math.max(1, Number(recurring.repeatCount) || 1);
  let boundary: Date | null = null;

  switch (recurring.interval) {
    case 'day':
      boundary = firstDailyOccurrence(start, every, repeatCount);
      break;
    case 'week': {
      const first = firstWeeklyOccurrence(start, every, recurring.daysOfWeek ?? []);
      boundary = first
        ? advanceByRepeatCycles(first, every, repeatCount, 'week')
        : null;
      break;
    }
    case 'month': {
      const first = firstMonthlyOccurrence(
        start,
        every,
        Number(recurring.dayOfMonth) || 1,
      );
      boundary = first
        ? advanceByRepeatCycles(first, every, repeatCount, 'month')
        : null;
      break;
    }
    case 'year': {
      // Year-based window: minimum End Year = Start Year + repeat interval.
      const startYear = start.getFullYear();
      const minEndYear = startYear + every;
      return `${minEndYear}-01-01`;
    }
    default:
      return formatYmdLocal(start);
  }

  return boundary ? formatYmdLocal(boundary) : null;
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
    case 'month': {
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
  /** At Once assignment time (`HH:mm` 24h). */
  frequencyTime: string | null;
  /** Recurring (day/week/month/year) series start date (`Y-m-d`). */
  frequencyStartDate: string | null;
  /** Recurring (day/week/month/year) series end date (`Y-m-d`). */
  frequencyEndDate: string | null;
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
    /** At Once time (`HH:mm` 24h); null for recurring. */
    time: string | null;
    /** Series start (`Y-m-d`) for day/week/month/year recurring; null otherwise. */
    startDate: string | null;
    /** Series end (`Y-m-d`) for day/week/month/year recurring; null otherwise. */
    endDate: string | null;
    type: FrequencyType;
    recurring: FrequencyRecurringConfig | null;
  };
  sections: Array<{
    id: string;
    name: string;
    type: 'custom';
    rows: Array<{ fields: Omit<FormFieldConfig, 'id'>[] }>;
  }>;
  /**
   * Form-level Logic Rules (automation intent). Separate from per-field
   * Conditional Logic stored on each field's `condition`.
   */
  conditionalRules?: FormLogicRule[];
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
  { label: 'Temperature', value: 'temperature' },
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
  optionSource?: FormFieldConfig['optionSource'];
  defaultValue?: unknown;
} {
  const {
    fieldTypeName: _fieldTypeName,
    isEditable: _isEditable,
    isShow: _isShow,
    validations: _validations,
    value: _previewValue,
    defaultValue,
    options,
    condition,
    optionSource,
    id,
    ...rest
  } = field;

  const normalizedOptions =
    optionSource?.type === 'dynamic'
      ? options?.length
        ? options.map((opt) =>
            typeof opt === 'string' || typeof opt === 'number' ? opt : opt.value,
          )
        : undefined
      : options?.map((opt) =>
          typeof opt === 'string' || typeof opt === 'number'
            ? opt
            : String(opt.label ?? opt.value),
        );

  const hasDefaultValue =
    defaultValue !== undefined &&
    defaultValue !== null &&
    !(typeof defaultValue === 'string' && defaultValue === '') &&
    !(Array.isArray(defaultValue) && defaultValue.length === 0);

  return {
    ...rest,
    ...(id ? { id } : {}),
    ...(condition ? { condition } : {}),
    ...(optionSource ? { optionSource } : {}),
    ...(normalizedOptions ? { options: normalizedOptions } : {}),
    ...(hasDefaultValue ? { defaultValue } : {}),
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
  conditionalRules: FormLogicRule[] = [],
): DynamicFormPayload {
  const assignJobPositionIds = resolveSelectedIds(meta.assignJobPosition, options.jobPositions);
  const assignUserIds = resolveSelectedIds(meta.assignUsers, options.users);
  const reportJobPositionIds = resolveSelectedIds(meta.reportJobPosition, options.jobPositions);
  const reportUserIds = resolveSelectedIds(meta.reportUsers, options.users);

  const recurring =
    meta.frequencyType === 'recurring'
      ? sanitizeFrequencyRecurring(meta.frequencyRecurring)
      : null;

  const hasScheduleWindow =
    meta.frequencyType === 'recurring' &&
    !!recurring &&
    (recurring.interval === 'day' ||
      recurring.interval === 'week' ||
      recurring.interval === 'month' ||
      recurring.interval === 'year');

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
      time:
        meta.frequencyType === 'atOnce' && meta.frequencyTime?.trim()
          ? meta.frequencyTime.trim()
          : null,
      startDate: hasScheduleWindow ? meta.frequencyStartDate?.trim() || null : null,
      endDate: hasScheduleWindow ? meta.frequencyEndDate?.trim() || null : null,
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
    conditionalRules: normalizeLogicRules(conditionalRules),
  };
}
