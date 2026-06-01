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
  placeholder: string;
  required: boolean;
  options: string[];

  // ✅ ADD THIS
  value?: any;

  // conditional logic
  condition?: {
    fieldId: string;
    value: any;
  };
}
