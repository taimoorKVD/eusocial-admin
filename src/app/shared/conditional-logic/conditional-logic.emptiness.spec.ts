import {
  evaluatePredicate,
  isEmptyValue,
} from './conditional-logic.evaluate';
import { getOperatorsForConditionSourceField } from './conditional-logic.validate';
import { ConditionOperator } from './conditional-logic.types';

const UNIVERSAL: ConditionOperator[] = ['isEmpty', 'isNotEmpty'];

const FIELD_TYPES: Array<{ type: string; rangeType?: string; label: string }> = [
  { type: 'text', label: 'Text' },
  { type: 'email', label: 'Email' },
  { type: 'textarea', label: 'Textarea' },
  { type: 'number', label: 'Number' },
  { type: 'price', label: 'Price' },
  { type: 'temperature', label: 'Temperature' },
  { type: 'length', label: 'Length' },
  { type: 'mass', label: 'Mass' },
  { type: 'volume', label: 'Volume' },
  { type: 'rating', label: 'Rating' },
  { type: 'date', label: 'Date' },
  { type: 'time', label: 'Time' },
  { type: 'select', label: 'Select' },
  { type: 'radio', label: 'Radio' },
  { type: 'checkbox', label: 'Checkbox' },
  { type: 'image', label: 'Image' },
  { type: 'signature', label: 'Signature' },
  { type: 'barcode', label: 'Barcode' },
  { type: 'qr-code', label: 'QR Code' },
  { type: 'range', rangeType: 'number', label: 'Range (number)' },
  { type: 'range', rangeType: 'date', label: 'Range (date)' },
  { type: 'range', rangeType: 'time', label: 'Range (time)' },
];

describe('universal isEmpty / isNotEmpty operators', () => {
  describe('getOperatorsForConditionSourceField', () => {
    it('exposes isEmpty and isNotEmpty for every supported source field type', () => {
      for (const field of FIELD_TYPES) {
        const operators = getOperatorsForConditionSourceField(field);
        for (const op of UNIVERSAL) {
          expect(operators)
            .withContext(`${field.label} missing ${op}`)
            .toContain(op);
        }
      }
    });

    it('preserves field-specific operators for numeric, boolean, select, and text', () => {
      expect(getOperatorsForConditionSourceField({ type: 'number' })).toEqual([
        'equals',
        'notEquals',
        'greaterThan',
        'greaterThanOrEqual',
        'lessThan',
        'lessThanOrEqual',
        'isEmpty',
        'isNotEmpty',
      ]);

      expect(getOperatorsForConditionSourceField({ type: 'checkbox' })).toEqual([
        'checked',
        'unchecked',
        'equals',
        'notEquals',
        'isEmpty',
        'isNotEmpty',
      ]);

      expect(getOperatorsForConditionSourceField({ type: 'select' })).toEqual([
        'equals',
        'notEquals',
        'isEmpty',
        'isNotEmpty',
      ]);

      expect(getOperatorsForConditionSourceField({ type: 'text' })).toEqual([
        'equals',
        'notEquals',
        'contains',
        'notContains',
        'startsWith',
        'endsWith',
        'isEmpty',
        'isNotEmpty',
      ]);

      expect(getOperatorsForConditionSourceField({ type: 'date' })).toEqual([
        'equals',
        'notEquals',
        'greaterThan',
        'lessThan',
        'isEmpty',
        'isNotEmpty',
      ]);
    });

    it('does not duplicate emptiness operators', () => {
      const operators = getOperatorsForConditionSourceField({ type: 'email' });
      expect(operators.filter((op) => op === 'isEmpty').length).toBe(1);
      expect(operators.filter((op) => op === 'isNotEmpty').length).toBe(1);
    });
  });

  describe('isEmptyValue', () => {
    it('treats null, undefined, and whitespace-only strings as empty', () => {
      expect(isEmptyValue(null)).toBeTrue();
      expect(isEmptyValue(undefined)).toBeTrue();
      expect(isEmptyValue('')).toBeTrue();
      expect(isEmptyValue('   ')).toBeTrue();
    });

    it('treats non-empty text and email values as not empty', () => {
      expect(isEmptyValue('hello')).toBeFalse();
      expect(isEmptyValue('user@example.com')).toBeFalse();
    });

    it('treats numeric zero as not empty', () => {
      expect(isEmptyValue(0)).toBeFalse();
      expect(isEmptyValue(0.0)).toBeFalse();
    });

    it('treats boolean false as not empty (unchecked checkbox)', () => {
      expect(isEmptyValue(false)).toBeFalse();
      expect(isEmptyValue(true)).toBeFalse();
    });

    it('evaluates measurement objects by their amount', () => {
      expect(isEmptyValue({ value: '', unit: 'kg' })).toBeTrue();
      expect(isEmptyValue({ amount: null, unit: 'kg' })).toBeTrue();
      expect(isEmptyValue({ quantity: '  ', unit: 'L' })).toBeTrue();
      expect(isEmptyValue({ value: 0, unit: 'kg' })).toBeFalse();
      expect(isEmptyValue({ value: 6, unit: 'kg' })).toBeFalse();
      expect(isEmptyValue(JSON.stringify({ value: '', unit: 'kg' }))).toBeTrue();
      expect(isEmptyValue(JSON.stringify({ value: 3, unit: 'kg' }))).toBeFalse();
    });

    it('treats empty and selected dropdown values correctly', () => {
      expect(isEmptyValue([])).toBeTrue();
      expect(isEmptyValue('')).toBeTrue();
      expect(isEmptyValue('option-a')).toBeFalse();
      expect(isEmptyValue(['option-a'])).toBeFalse();
    });

    it('treats date and time values correctly', () => {
      expect(isEmptyValue('')).toBeTrue();
      expect(isEmptyValue('2024-01-15')).toBeFalse();
      expect(isEmptyValue('14:30')).toBeFalse();
      expect(isEmptyValue(new Date('2024-01-15'))).toBeFalse();
    });

    it('treats file / image / signature values correctly', () => {
      expect(isEmptyValue(null)).toBeTrue();
      expect(isEmptyValue([])).toBeTrue();
      expect(
        isEmptyValue({
          url: '',
          fileName: 'x.png',
          mimeType: 'image/png',
          size: 0,
          purpose: 'answer',
        }),
      ).toBeTrue();
      expect(
        isEmptyValue({
          url: 'https://cdn.example/a.png',
          fileName: 'a.png',
          mimeType: 'image/png',
          size: 12,
          purpose: 'answer',
        }),
      ).toBeFalse();
      expect(
        isEmptyValue([
          {
            url: 'https://cdn.example/a.png',
            fileName: 'a.png',
            mimeType: 'image/png',
            size: 12,
            purpose: 'answer',
          },
        ]),
      ).toBeFalse();
      expect(
        isEmptyValue({
          path: 'uploads/sig.png',
          fileName: 'sig.png',
          mimeType: 'image/png',
          size: 20,
          purpose: 'answer',
        }),
      ).toBeFalse();
    });
  });

  describe('evaluatePredicate engine', () => {
    const fieldId = 'source';

    function run(
      operator: ConditionOperator,
      actual: unknown,
    ): boolean {
      return evaluatePredicate(
        { fieldId, operator, value: '' },
        { [fieldId]: actual },
      );
    }

    it('evaluates isEmpty / isNotEmpty for text and email', () => {
      expect(run('isEmpty', '')).toBeTrue();
      expect(run('isNotEmpty', '')).toBeFalse();
      expect(run('isEmpty', 'note')).toBeFalse();
      expect(run('isNotEmpty', 'note')).toBeTrue();
      expect(run('isEmpty', 'user@example.com')).toBeFalse();
      expect(run('isNotEmpty', 'user@example.com')).toBeTrue();
    });

    it('evaluates numeric zero as not empty', () => {
      expect(run('isEmpty', 0)).toBeFalse();
      expect(run('isNotEmpty', 0)).toBeTrue();
      expect(run('isEmpty', { value: 0, unit: 'C' })).toBeFalse();
      expect(run('isNotEmpty', { value: 0, unit: 'C' })).toBeTrue();
      expect(run('isEmpty', { value: '', unit: 'C' })).toBeTrue();
      expect(run('isNotEmpty', { value: '', unit: 'C' })).toBeFalse();
    });

    it('evaluates checkbox false as not empty', () => {
      expect(run('isEmpty', false)).toBeFalse();
      expect(run('isNotEmpty', false)).toBeTrue();
      expect(run('isEmpty', true)).toBeFalse();
      expect(run('isNotEmpty', true)).toBeTrue();
      expect(run('isEmpty', null)).toBeTrue();
      expect(run('isNotEmpty', null)).toBeFalse();
    });

    it('evaluates select, date, and media through the engine', () => {
      expect(run('isEmpty', [])).toBeTrue();
      expect(run('isNotEmpty', ['a'])).toBeTrue();
      expect(run('isEmpty', '2024-06-01')).toBeFalse();
      expect(run('isNotEmpty', '09:00')).toBeTrue();
      expect(run('isEmpty', null)).toBeTrue();
      expect(
        run('isNotEmpty', {
          url: 'https://cdn.example/sig.png',
          fileName: 'sig.png',
          mimeType: 'image/png',
          size: 10,
          purpose: 'answer',
        }),
      ).toBeTrue();
    });

    it('leaves equals / contains / checked behavior unchanged', () => {
      expect(
        evaluatePredicate(
          { fieldId, operator: 'equals', value: 'abc' },
          { [fieldId]: 'abc' },
        ),
      ).toBeTrue();
      expect(
        evaluatePredicate(
          { fieldId, operator: 'contains', value: 'bc' },
          { [fieldId]: 'abc' },
        ),
      ).toBeTrue();
      expect(
        evaluatePredicate(
          { fieldId, operator: 'checked', value: '' },
          { [fieldId]: false },
        ),
      ).toBeFalse();
      expect(
        evaluatePredicate(
          { fieldId, operator: 'unchecked', value: '' },
          { [fieldId]: false },
        ),
      ).toBeTrue();
      expect(
        evaluatePredicate(
          { fieldId, operator: 'greaterThan', value: 5 },
          { [fieldId]: 6 },
        ),
      ).toBeTrue();
    });
  });
});
