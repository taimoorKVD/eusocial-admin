export type DynamicFieldType =
  | 'text'
  | 'email'
  | 'number'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'radio'
  | 'date'
  | 'image';

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
  options?: (string | DynamicFieldOption)[];
  optionSource?: DynamicFieldOptionSource;
}

export type DynamicFormValue = Record<string, unknown>;
