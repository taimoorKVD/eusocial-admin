export type FieldType =
  | 'text'
  | 'email'
  | 'number'
  | 'select'
  | 'textarea'
  | 'checkbox'
  | 'radio'
  | 'image';

export interface FieldOption {
  label: string;
  value: string | number;
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
  options: string[];
  optionSource?: OptionSource;

  value?: unknown;
  defaultValue?: unknown;
  validations?: Record<string, unknown>;
  width?: number;
  order?: number;

  condition?: {
    fieldId: string;
    value: unknown;
  };
}
