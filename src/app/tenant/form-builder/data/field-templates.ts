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
  }
];
