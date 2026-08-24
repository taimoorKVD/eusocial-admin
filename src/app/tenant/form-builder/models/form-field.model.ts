import { FieldCondition } from '../../../shared/conditional-logic';

export type FieldType =
  | 'text'
  | 'email'
  | 'number'
  | 'select'
  | 'textarea'
  | 'checkbox'
  | 'radio'
  | 'image'
  | 'parameter'
  | 'signature'
  | 'user-timestamp'
  | 'rating'
  | 'range'
  | 'barcode'
  | 'qr-code';

export type SelectSelectionType = 'single' | 'multi';

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

  value?: unknown;
  defaultValue?: unknown;
  validations?: Record<string, unknown>;
  width?: number;
  order?: number;

  condition?: FieldCondition;

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
  /**
   * Number field only. When true, decimal values are allowed.
   * Missing/undefined is treated as false for backward compatibility.
   */
  allowDecimal?: boolean;
  /**
   * Text / Text Area only. Maximum allowed characters.
   * Missing/undefined uses 255 (text) or 5000 (textarea).
   */
  characterLimit?: number;
}
