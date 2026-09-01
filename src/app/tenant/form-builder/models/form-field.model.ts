import { FieldCondition } from '../../../shared/conditional-logic';
import { ImageFile } from './image-file.model';

export type FieldType =
  | 'text'
  | 'email'
  | 'number'
  | 'select'
  | 'textarea'
  | 'checkbox'
  | 'radio'
  | 'image'
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

export type SelectSelectionType = 'single' | 'multi';

/** Range Field value kind selected in Form Builder. */
export type RangeFieldType = 'number' | 'date' | 'time';

export type RangeTimeFormat = '12' | '24';

/** Measurement fields: fixed unit vs user-selectable unit on Form Fill. */
export type MeasurementUnitMode = 'fixed' | 'selectable';

export interface FieldOption {
  id?: number;
  label: string;
  value: string | number;
  isDefault?: boolean;
  sortOrder?: number;
}

export interface OptionSourceResponse {
  labelKey?: string;
  valueKey?: string;
  dataPath?: string;
}

export interface OptionSource {
  type: 'api' | 'static' | string;
  endpoint?: string;
  response?: OptionSourceResponse;
  options?: string[] | FieldOption[];
}

export interface FormField {
  id: string;
  type: FieldType;
  fieldTypeName?: string;
  label: string;
  name?: string;
  placeholder: string;
  required: boolean;
  isShow?: boolean;
  isReadonly?: boolean;
  isEditable?: boolean;
  options: Array<string | FieldOption>;
  optionSource?: OptionSource;
  /** Select field only. Defaults to `single` for backward compatibility. */
  selectionType?: SelectSelectionType;
  /**
   * Backend system mapping key when present on module schema fields
   * (e.g. `vendor_name`). Used for Dynamic Select display resolution.
   */
  systemMappingKey?: string;
  /** Backend field key when present on module schema fields. */
  fieldKey?: string;

  value?: unknown;
  defaultValue?: unknown;
  validations?: Record<string, unknown>;
  width?: number;
  order?: number;

  condition?: FieldCondition;

  /** Maximum rating value (default 5). */
  maxRating?: number;
  /**
   * Range field value type. Defaults to `number` when missing.
   */
  rangeType?: RangeFieldType;
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
  timeFormat?: RangeTimeFormat;
  /**
   * Measurement fields (price / length / mass / volume).
   * `fixed` locks the unit; `selectable` lets the user choose at fill time.
   */
  unitMode?: MeasurementUnitMode;
  /** Fixed unit code, or default unit when selectable. */
  unit?: string;
  /** Measurement minimum numeric value (defaults to 0). */
  minValue?: number;
  /** Measurement maximum numeric value (optional). */
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

  /**
   * Image Upload only. Example / reference images configured in Form Builder.
   * Never submitted as user answers.
   */
  referenceImages?: ImageFile[];
  /** Image Upload only. When true, the end user may upload multiple answer images. */
  multiple?: boolean;
  /** Image Upload only. Minimum answer images required (does not count references). */
  minFiles?: number;
  /** Image Upload only. Maximum answer images allowed. */
  maxFiles?: number;
}
