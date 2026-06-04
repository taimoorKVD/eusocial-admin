export type FieldType =
  | 'text'
  | 'email'
  | 'number'
  | 'select'
  | 'textarea'
  | 'checkbox'
  | 'radio'
  | 'image';

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  name?: string;
  placeholder: string;
  required: boolean;
  options: string[];

  value?: any;
  defaultValue?: any;
  validations?: Record<string, any>;
  width?: number;
  order?: number;

  condition?: {
    fieldId: string;
    value: any;
  };
}
