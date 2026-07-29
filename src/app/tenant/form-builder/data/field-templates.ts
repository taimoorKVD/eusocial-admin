import { FormField } from '../models/form-field.model';

export const FIELD_TEMPLATES: Omit<FormField, 'id'>[] = [
 {
    type: 'text',
    label: 'Text Field',
    placeholder: 'Enter text',
    required: false,
    options: []
  },

  {
    type: 'email',
    label: 'Email Field',
    placeholder: 'Enter email',
    required: false,
    options: []
  },

  {
    type: 'number',
    label: 'Number Field',
    placeholder: 'Enter number',
    required: false,
    options: []
  },

  {
    type: 'textarea',
    label: 'Textarea Field',
    placeholder: 'Enter description',
    required: false,
    options: []
  },

  {
    type: 'select',
    label: 'Select Field',
    placeholder: '',
    required: false,
    options: ['Option 1', 'Option 2']
  },

  {
    type: 'radio',
    label: 'Radio Field',
    placeholder: '',
    required: false,
    options: ['Option 1', 'Option 2']
  },

  {
    type: 'checkbox',
    label: 'Checkbox Field',
    placeholder: '',
    required: false,
    options: ['Option 1', 'Option 2']
  },

  {
    type: 'image',
    label: 'Image Upload',
    placeholder: '',
    required: false,
    options: []
  },

  {
    type: 'parameter',
    label: 'Parameter',
    placeholder: 'Enter value',
    required: false,
    options: []
  },

  {
    type: 'signature',
    label: 'Signature',
    placeholder: '',
    required: false,
    options: []
  },

  {
    type: 'user-timestamp',
    label: 'User Timestamp',
    placeholder: '',
    required: false,
    options: []
  },

  {
    type: 'rating',
    label: 'Rating',
    placeholder: '',
    required: false,
    options: []
  },

  {
    type: 'range',
    label: 'Range',
    placeholder: '',
    required: false,
    options: []
  },

  {
    type: 'barcode',
    label: 'Barcode',
    placeholder: '',
    required: false,
    options: []
  },

  {
    type: 'qr-code',
    label: 'QR Code / Scan',
    placeholder: '',
    required: false,
    options: []
  }
];
