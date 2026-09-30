import { FormField } from '../models/form-field.model';

export const FIELD_TEMPLATES: Omit<FormField, 'id'>[] = [
 {
    type: 'text',
    label: 'Text Field',
    placeholder: 'Enter text',
    required: false,
    characterLimit: 255,
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
    allowDecimal: false,
    options: []
  },

  {
    type: 'textarea',
    label: 'Textarea Field',
    placeholder: 'Enter description',
    required: false,
    characterLimit: 5000,
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
    multiple: false,
    maxFiles: 1,
    referenceImages: [],
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
    type: 'time',
    label: 'Time Field',
    placeholder: 'Select time',
    required: false,
    timeFormat: '12',
    options: []
  },

  {
    type: 'date',
    label: 'Date',
    placeholder: 'Select date',
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
    rangeType: 'number',
    rangeStep: 1,
    allowDecimal: false,
    rangePlaceholderFrom: 'From',
    rangePlaceholderTo: 'To',
    options: []
  },

  {
    type: 'price',
    label: 'Price',
    placeholder: 'Enter amount',
    required: false,
    allowDecimal: true,
    unitMode: 'fixed',
    unit: 'USD',
    minValue: 0,
    options: []
  },

  {
    type: 'length',
    label: 'Length / Distance',
    placeholder: 'Enter length',
    required: false,
    allowDecimal: true,
    unitMode: 'fixed',
    unit: 'm',
    minValue: 0,
    options: []
  },

  {
    type: 'mass',
    label: 'Weight / Mass',
    placeholder: 'Enter weight',
    required: false,
    allowDecimal: true,
    unitMode: 'fixed',
    unit: 'kg',
    minValue: 0,
    options: []
  },

  {
    type: 'volume',
    label: 'Volume / Capacity',
    placeholder: 'Enter volume',
    required: false,
    allowDecimal: true,
    unitMode: 'fixed',
    unit: 'L',
    minValue: 0,
    options: []
  },

  {
    type: 'temperature',
    label: 'Temperature',
    placeholder: 'Enter temperature',
    required: false,
    allowDecimal: true,
    unitMode: 'fixed',
    unit: 'C',
    minValue: -273.15,
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
