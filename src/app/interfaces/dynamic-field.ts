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

export interface DynamicField {
  id: string;
  name: string;
  type: DynamicFieldType;
  label: string;
  value?: unknown;
  required?: boolean;
  placeholder?: string;
  width?: number;
  order?: number;
  isShow?: boolean;
  options?: (string | DynamicFieldOption)[];
}

export type DynamicFormValue = Record<string, unknown>;
