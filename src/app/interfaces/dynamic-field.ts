import { FieldCondition } from '../shared/conditional-logic';
import type {
  RangeFieldType,
  RangeTimeFormat,
} from '../tenant/form-builder/models/form-field.model';
import type { ImageFile } from '../tenant/form-builder/models/image-file.model';

export type DynamicFieldType =
  | 'text'
  | 'email'
  | 'number'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'radio'
  | 'date'
  | 'image'
  | 'signature'
  | 'time'
  | 'rating'
  | 'range'
  | 'barcode'
  | 'qr-code';

export interface DynamicFieldOption {
  label: string;
  value: string | number;
}

export interface DynamicFieldOptionSource {
  type: 'api' | 'static' | 'dynamic';
  endpoint?: string;
  response?: {
    labelKey: string;
    valueKey: string;
    dataPath: string;
  };
}

export type DynamicSelectSelectionType = 'single' | 'multi';

export interface DynamicField {
  id: string;
  name: string;
  type: DynamicFieldType;
  label: string;
  value?: unknown;
  defaultValue?: unknown;
  required?: boolean;
  placeholder?: string;
  width?: number;
  order?: number;
  radio?: any;
  isShow?: boolean;
  isReadonly?: boolean;
  options?: (string | DynamicFieldOption)[];
  optionSource?: DynamicFieldOptionSource;
  /** Select field only. Defaults to `single` when missing. */
  selectionType?: DynamicSelectSelectionType;
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
  /** Range field configuration. */
  rangeType?: RangeFieldType;
  rangeMin?: number;
  rangeMax?: number;
  rangeStep?: number;
  rangeMinDate?: string;
  rangeMaxDate?: string;
  rangePlaceholderFrom?: string;
  rangePlaceholderTo?: string;
  timeFormat?: RangeTimeFormat;
  condition?: FieldCondition;

  /**
   * Image Upload only. Example / reference images from Form Builder.
   * Not part of the FormControl value.
   */
  referenceImages?: ImageFile[];
  /** Image Upload only. */
  multiple?: boolean;
  /** Image Upload only. */
  minFiles?: number;
  /** Image Upload only. */
  maxFiles?: number;

  /** Rating field only. Maximum stars (3, 5, 7, or 10). Defaults to 5. */
  maxRating?: number;
}

export type DynamicFormValue = Record<string, unknown>;

export type { ImageFile };
