import {
  ConditionAction,
  ConditionalLogicFieldLike,
  EXPRESSION_OPS,
  ExpressionOp,
  ExpressionValueSource,
  FieldConditionalLogic,
  SET_VALUE_COMPATIBLE_TYPES,
  VALUE_SOURCE_KINDS,
  ValueSource,
  ValueSourceKind,
} from './conditional-logic.types';

const VALUE_SOURCE_KIND_SET = new Set<string>(VALUE_SOURCE_KINDS);
const EXPRESSION_OP_SET = new Set<string>(EXPRESSION_OPS);

function isBlankValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === 'string') {
    return value.trim() === '';
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  return false;
}

export function supportsSetValueFieldType(type: string | undefined | null): boolean {
  return !!type && SET_VALUE_COMPATIBLE_TYPES.has(type);
}

/** Value-shape kinds used for setValue source compatibility (mirrors Logic Rules). */
export type SetValueFieldKind =
  | 'numeric'
  | 'text'
  | 'boolean'
  | 'select'
  | 'date'
  | 'time'
  | 'other';

export function resolveSetValueFieldKind(
  field: { type?: string; rangeType?: string } | null | undefined
): SetValueFieldKind {
  if (!field?.type) {
    return 'other';
  }

  switch (field.type) {
    case 'number':
    case 'price':
    case 'length':
    case 'mass':
    case 'volume':
    case 'temperature':
    case 'rating':
      return 'numeric';
    case 'range':
      return field.rangeType === 'date'
        ? 'date'
        : field.rangeType === 'time'
          ? 'time'
          : 'numeric';
    case 'checkbox':
      return 'boolean';
    case 'select':
    case 'radio':
      return 'select';
    case 'date':
      return 'date';
    case 'time':
      return 'time';
    case 'text':
    case 'email':
    case 'textarea':
    case 'barcode':
    case 'qr-code':
      return 'text';
    default:
      return 'other';
  }
}

export function isCompatibleSetValueSourceField(
  targetField: { type?: string; rangeType?: string } | null | undefined,
  sourceField: { type?: string; rangeType?: string } | null | undefined
): boolean {
  const targetKind = resolveSetValueFieldKind(targetField);
  const sourceKind = resolveSetValueFieldKind(sourceField);

  if (targetKind === 'numeric') {
    return sourceKind === 'numeric';
  }
  if (targetKind === 'date') {
    return sourceKind === 'date';
  }
  if (targetKind === 'time') {
    return sourceKind === 'time';
  }
  if (targetKind === 'boolean') {
    return sourceKind === 'boolean';
  }
  if (targetKind === 'select') {
    return sourceKind === 'select' || sourceKind === 'text';
  }
  if (targetKind === 'text') {
    return sourceKind === 'text' || sourceKind === 'select';
  }
  return false;
}

export function isNumericLikePropertyValue(value: unknown): boolean {
  if (typeof value === 'number') {
    return Number.isFinite(value);
  }
  if (typeof value === 'boolean') {
    return true;
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    return isNumericLikePropertyValue(
      record['value'] ?? record['amount'] ?? record['quantity']
    );
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return false;
    }
    return Number.isFinite(Number(trimmed));
  }
  return false;
}

export function filterRelatedPropertiesForTargetKind(
  columns: Array<{ id: string; label: string }>,
  records: Record<string, unknown>[],
  targetKind: SetValueFieldKind
): Array<{ id: string; label: string }> {
  if (!columns.length) {
    return [];
  }

  if (targetKind !== 'numeric' && targetKind !== 'date' && targetKind !== 'time') {
    return columns;
  }

  return columns.filter(column => {
    const id = String(column.id ?? '').trim();
    if (!id || id === 'id' || id === '_id') {
      return false;
    }

    if (!records.length) {
      // Without samples, keep non-id columns rather than blocking configuration.
      return true;
    }

    const sampleValues = records
      .map(record => record[id])
      .filter(value => value !== undefined && value !== null && value !== '');

    if (!sampleValues.length) {
      return false;
    }

    if (targetKind === 'numeric') {
      return sampleValues.some(isNumericLikePropertyValue);
    }

    if (targetKind === 'date') {
      return sampleValues.some(value => {
        const text = String(value);
        return /^\d{4}-\d{2}-\d{2}/.test(text) || !Number.isNaN(Date.parse(text));
      });
    }

    // time
    return sampleValues.some(value => {
      const text = String(value).trim();
      return /^\d{1,2}:\d{2}/.test(text);
    });
  });
}

export function normalizeRelatedEndpointKey(endpoint: string | null | undefined): string {
  return String(endpoint ?? '')
    .trim()
    .toLowerCase()
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .replace(/_/g, '-');
}

export function extractRelatedRecordsFromResponse(
  response: unknown
): Record<string, unknown>[] {
  if (Array.isArray(response)) {
    return response.filter(
      (item): item is Record<string, unknown> =>
        !!item && typeof item === 'object' && !Array.isArray(item)
    );
  }

  if (!response || typeof response !== 'object') {
    return [];
  }

  const record = response as Record<string, unknown>;
  for (const key of ['data', 'results', 'items']) {
    const nested = record[key];
    if (Array.isArray(nested)) {
      return nested.filter(
        (item): item is Record<string, unknown> =>
          !!item && typeof item === 'object' && !Array.isArray(item)
      );
    }
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      const nestedRecord = nested as Record<string, unknown>;
      for (const nestedKey of ['data', 'results', 'items']) {
        const deeper = nestedRecord[nestedKey];
        if (Array.isArray(deeper)) {
          return deeper.filter(
            (item): item is Record<string, unknown> =>
              !!item && typeof item === 'object' && !Array.isArray(item)
          );
        }
      }
    }
  }

  return [];
}

export function createEmptyFixedValueSource(): ValueSource {
  return { kind: 'fixed', value: '' };
}

export function createEmptyFieldValueSource(): ValueSource {
  return { kind: 'field', fieldId: '' };
}

export function createEmptyRelatedDataValueSource(): ValueSource {
  return { kind: 'relatedData', sourceFieldId: '', property: '' };
}

export function createEmptyExpressionValueSource(): ValueSource {
  return {
    kind: 'expression',
    op: 'multiply',
    left: createEmptyRelatedDataValueSource(),
    right: createEmptyFieldValueSource(),
  };
}

export function createDefaultValueSource(kind: ValueSourceKind = 'fixed'): ValueSource {
  switch (kind) {
    case 'field':
      return createEmptyFieldValueSource();
    case 'relatedData':
      return createEmptyRelatedDataValueSource();
    case 'expression':
      return createEmptyExpressionValueSource();
    case 'fixed':
    default:
      return createEmptyFixedValueSource();
  }
}

export function normalizeExpressionOp(raw: unknown): ExpressionOp {
  const normalized = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  const aliases: Record<string, ExpressionOp> = {
    multiply: 'multiply',
    mul: 'multiply',
    times: 'multiply',
    '*': 'multiply',
    '×': 'multiply',
    add: 'add',
    plus: 'add',
    '+': 'add',
    subtract: 'subtract',
    sub: 'subtract',
    minus: 'subtract',
    '-': 'subtract',
    '−': 'subtract',
    divide: 'divide',
    div: 'divide',
    '/': 'divide',
    '÷': 'divide',
  };

  const mapped = aliases[normalized];
  if (mapped && EXPRESSION_OP_SET.has(mapped)) {
    return mapped;
  }

  if (EXPRESSION_OP_SET.has(String(raw))) {
    return raw as ExpressionOp;
  }

  return 'multiply';
}

export function normalizeValueSourceKind(raw: unknown): ValueSourceKind {
  const normalized = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  const aliases: Record<string, ValueSourceKind> = {
    fixed: 'fixed',
    fixed_value: 'fixed',
    value: 'fixed',
    field: 'field',
    form_field: 'field',
    related_data: 'relatedData',
    relateddata: 'relatedData',
    related: 'relatedData',
    expression: 'expression',
    calculation: 'expression',
    calc: 'expression',
  };

  const mapped = aliases[normalized];
  if (mapped && VALUE_SOURCE_KIND_SET.has(mapped)) {
    return mapped;
  }

  if (VALUE_SOURCE_KIND_SET.has(String(raw))) {
    return raw as ValueSourceKind;
  }

  return 'fixed';
}

/** Operand sources inside an expression (no nested expressions). */
export function normalizeOperandValueSource(raw: unknown): ValueSource {
  const source = normalizeValueSource(raw);
  if (source.kind === 'expression') {
    return createEmptyFixedValueSource();
  }
  return source;
}

export function normalizeValueSource(raw: unknown): ValueSource {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return createEmptyFixedValueSource();
  }

  const record = raw as Record<string, unknown>;
  const kind = normalizeValueSourceKind(record['kind'] ?? record['type']);

  switch (kind) {
    case 'field':
      return {
        kind: 'field',
        fieldId: String(record['fieldId'] ?? record['field_id'] ?? '').trim(),
      };
    case 'relatedData':
      return {
        kind: 'relatedData',
        sourceFieldId: String(
          record['sourceFieldId'] ?? record['source_field_id'] ?? ''
        ).trim(),
        property: String(record['property'] ?? record['propertyKey'] ?? '').trim(),
      };
    case 'expression':
      return {
        kind: 'expression',
        op: normalizeExpressionOp(record['op'] ?? record['operator']),
        left: normalizeOperandValueSource(record['left']),
        right: normalizeOperandValueSource(record['right']),
      };
    case 'fixed':
    default:
      return {
        kind: 'fixed',
        value: record['value'],
      };
  }
}

export function getPrimarySetValueSource(
  logic: FieldConditionalLogic | null | undefined
): ValueSource | null {
  const action = logic?.actions?.find(item => item.type === 'setValue');
  if (!action) {
    return null;
  }
  return normalizeValueSource(action.source);
}

export function collectValueSourceFieldIds(source: ValueSource | null | undefined): string[] {
  if (!source) {
    return [];
  }

  switch (source.kind) {
    case 'field':
      return source.fieldId ? [source.fieldId] : [];
    case 'relatedData':
      return source.sourceFieldId ? [source.sourceFieldId] : [];
    case 'expression':
      return [
        ...collectValueSourceFieldIds(source.left),
        ...collectValueSourceFieldIds(source.right),
      ];
    case 'fixed':
    default:
      return [];
  }
}

export function collectSetValueDependencyFieldIds(
  logic: FieldConditionalLogic | null | undefined
): string[] {
  if (!logic?.actions?.length) {
    return [];
  }

  const ids: string[] = [];
  for (const action of logic.actions) {
    if (action.type !== 'setValue') {
      continue;
    }
    ids.push(...collectValueSourceFieldIds(normalizeValueSource(action.source)));
  }
  return ids;
}

export function hasSetValueAction(
  logic: FieldConditionalLogic | null | undefined
): boolean {
  return !!logic?.actions?.some(action => action.type === 'setValue');
}

export function pruneValueSourceForDeletedFields(
  source: ValueSource,
  deletedIds: Set<string>
): ValueSource {
  switch (source.kind) {
    case 'field':
      if (source.fieldId && deletedIds.has(source.fieldId)) {
        return { ...source, fieldId: '' };
      }
      return source;
    case 'relatedData':
      if (source.sourceFieldId && deletedIds.has(source.sourceFieldId)) {
        return { ...source, sourceFieldId: '', property: '' };
      }
      return source;
    case 'expression':
      return {
        ...source,
        left: pruneValueSourceForDeletedFields(source.left, deletedIds),
        right: pruneValueSourceForDeletedFields(source.right, deletedIds),
      };
    case 'fixed':
    default:
      return source;
  }
}

export function pruneActionsForDeletedFields(
  actions: ConditionAction[],
  deletedIds: Set<string>
): ConditionAction[] {
  return actions.map(action => {
    if (action.type !== 'setValue') {
      return action;
    }
    return {
      type: 'setValue',
      source: pruneValueSourceForDeletedFields(
        normalizeValueSource(action.source),
        deletedIds
      ),
    };
  });
}

export interface RelatedRecordLookup {
  /** Module endpoint/slug keyed cache of records. */
  recordsByEndpoint: Map<string, Record<string, unknown>[]>;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const nested = record['value'] ?? record['amount'] ?? record['quantity'];
    return toFiniteNumber(nested);
  }

  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }

  const parsed = Number(String(value ?? '').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function readRecordProperty(
  record: Record<string, unknown>,
  property: string
): unknown {
  if (!property) {
    return undefined;
  }

  if (property in record) {
    return record[property];
  }

  const snakeKey = property.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  if (snakeKey in record) {
    return record[snakeKey];
  }

  const lower = property.toLowerCase();
  for (const [key, value] of Object.entries(record)) {
    if (key.toLowerCase() === lower) {
      return value;
    }
  }

  return undefined;
}

function findRelatedRecord(
  sourceField: ConditionalLogicFieldLike | undefined,
  selectedValue: unknown,
  lookup: RelatedRecordLookup
): Record<string, unknown> | null {
  if (!sourceField || isBlankValue(selectedValue)) {
    return null;
  }

  const endpoint = String(sourceField.optionSource?.endpoint ?? '').trim();
  if (!endpoint) {
    return null;
  }

  const normalizedEndpoint = normalizeRelatedEndpointKey(endpoint);
  const records =
    lookup.recordsByEndpoint.get(endpoint) ??
    lookup.recordsByEndpoint.get(normalizedEndpoint) ??
    [];

  if (!records.length) {
    return null;
  }

  const valueKey =
    String(sourceField.optionSource?.response?.valueKey ?? 'id').trim() || 'id';
  const labelKey =
    String(sourceField.optionSource?.response?.labelKey ?? 'name').trim() || 'name';
  const selectedTokens = Array.isArray(selectedValue)
    ? selectedValue.map(item => String(item))
    : [String(selectedValue)];

  for (const record of records) {
    const raw = readRecordProperty(record, valueKey);
    const fallbackId = record['id'] ?? record['_id'];
    const candidate = raw ?? fallbackId;
    if (candidate == null) {
      continue;
    }
    if (selectedTokens.some(token => String(candidate) === token)) {
      return record;
    }
  }

  // Fallback: match against display label when valueKey lookup misses.
  for (const record of records) {
    const label = readRecordProperty(record, labelKey) ?? record['name'] ?? record['title'];
    if (label == null) {
      continue;
    }
    if (selectedTokens.some(token => String(label) === token)) {
      return record;
    }
  }

  return null;
}

function evaluateExpression(
  source: ExpressionValueSource,
  valuesByFieldId: Record<string, unknown>,
  fieldsById: Map<string, ConditionalLogicFieldLike>,
  lookup: RelatedRecordLookup
): unknown {
  const left = resolveValueSource(source.left, valuesByFieldId, fieldsById, lookup);
  const right = resolveValueSource(source.right, valuesByFieldId, fieldsById, lookup);
  const leftNum = toFiniteNumber(left);
  const rightNum = toFiniteNumber(right);

  if (leftNum === null || rightNum === null) {
    return null;
  }

  switch (source.op) {
    case 'add':
      return leftNum + rightNum;
    case 'subtract':
      return leftNum - rightNum;
    case 'divide':
      return rightNum === 0 ? null : leftNum / rightNum;
    case 'multiply':
    default:
      return leftNum * rightNum;
  }
}

export function resolveValueSource(
  source: ValueSource | null | undefined,
  valuesByFieldId: Record<string, unknown>,
  fieldsById: Map<string, ConditionalLogicFieldLike>,
  lookup: RelatedRecordLookup
): unknown {
  if (!source) {
    return null;
  }

  const normalized = normalizeValueSource(source);

  switch (normalized.kind) {
    case 'fixed':
      return normalized.value ?? null;
    case 'field': {
      if (!normalized.fieldId) {
        return null;
      }
      return valuesByFieldId[normalized.fieldId] ?? null;
    }
    case 'relatedData': {
      if (!normalized.sourceFieldId || !normalized.property) {
        return null;
      }
      const sourceField = fieldsById.get(normalized.sourceFieldId);
      const selectedValue = valuesByFieldId[normalized.sourceFieldId];
      const record = findRelatedRecord(sourceField, selectedValue, lookup);
      if (!record) {
        return null;
      }
      return readRecordProperty(record, normalized.property);
    }
    case 'expression':
      return evaluateExpression(normalized, valuesByFieldId, fieldsById, lookup);
    default:
      return null;
  }
}

function getOptionValues(field: ConditionalLogicFieldLike): Array<string | number> {
  if (!Array.isArray(field.options)) {
    return [];
  }

  return field.options
    .map((option, index) => {
      if (typeof option === 'string' || typeof option === 'number') {
        return option;
      }
      if (option && typeof option === 'object') {
        const value = (option as { value?: unknown }).value;
        if (typeof value === 'string' || typeof value === 'number') {
          return value;
        }
      }
      return index;
    })
    .filter((value): value is string | number => value !== undefined && value !== null);
}

function matchOptionValue(
  field: ConditionalLogicFieldLike,
  raw: unknown
): string | number | null {
  const options = getOptionValues(field);
  if (!options.length || raw === null || raw === undefined) {
    return null;
  }

  const token = String(raw);
  const match = options.find(option => String(option) === token);
  return match !== undefined ? match : null;
}

/**
 * Coerce a resolved source value into the shape expected by the target field.
 * Returns `undefined` when the value cannot be applied safely.
 */
export function coerceSetValueForField(
  field: ConditionalLogicFieldLike,
  raw: unknown
): unknown | undefined {
  if (!supportsSetValueFieldType(field.type)) {
    return undefined;
  }

  if (raw === undefined) {
    return undefined;
  }

  const type = field.type || 'text';

  switch (type) {
    case 'number': {
      if (raw === null || raw === '') {
        return null;
      }
      const numeric = toFiniteNumber(raw);
      return numeric;
    }
    case 'price':
    case 'length':
    case 'mass':
    case 'volume':
    case 'temperature': {
      const numeric = raw === null || raw === '' ? null : toFiniteNumber(raw);
      if (numeric === null && raw !== null && raw !== '') {
        return undefined;
      }
      return {
        value: numeric,
        unit: field.unit ?? null,
      };
    }
    case 'select': {
      const multi = field.selectionType === 'multi';
      if (multi) {
        const tokens = Array.isArray(raw) ? raw : raw === null || raw === '' ? [] : [raw];
        const matched = tokens
          .map(token => matchOptionValue(field, token))
          .filter((token): token is string | number => token !== null);
        return matched;
      }
      if (raw === null || raw === '') {
        return '';
      }
      const matched = matchOptionValue(field, Array.isArray(raw) ? raw[0] : raw);
      return matched === null ? undefined : matched;
    }
    case 'radio': {
      if (raw === null || raw === '') {
        return '';
      }
      const matched = matchOptionValue(field, Array.isArray(raw) ? raw[0] : raw);
      return matched === null ? undefined : matched;
    }
    case 'date':
    case 'time':
    case 'text':
    case 'email':
    case 'textarea':
    case 'barcode':
    case 'qr-code':
    default: {
      if (raw === null) {
        return '';
      }
      if (typeof raw === 'object') {
        const numeric = toFiniteNumber(raw);
        if (numeric !== null) {
          return String(numeric);
        }
        return undefined;
      }
      return String(raw);
    }
  }
}

export function setValuesEqual(left: unknown, right: unknown): boolean {
  if (left === right) {
    return true;
  }

  if (left == null && right == null) {
    return true;
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    const leftArr = Array.isArray(left) ? left : [];
    const rightArr = Array.isArray(right) ? right : [];
    if (leftArr.length !== rightArr.length) {
      return false;
    }
    return leftArr.every((item, index) => String(item) === String(rightArr[index]));
  }

  if (
    left &&
    right &&
    typeof left === 'object' &&
    typeof right === 'object' &&
    !Array.isArray(left) &&
    !Array.isArray(right)
  ) {
    const leftRecord = left as Record<string, unknown>;
    const rightRecord = right as Record<string, unknown>;
    const leftValue = leftRecord['value'] ?? leftRecord['amount'];
    const rightValue = rightRecord['value'] ?? rightRecord['amount'];
    const leftUnit = leftRecord['unit'] ?? leftRecord['currency'];
    const rightUnit = rightRecord['unit'] ?? rightRecord['currency'];
    return String(leftValue ?? '') === String(rightValue ?? '') &&
      String(leftUnit ?? '') === String(rightUnit ?? '');
  }

  return String(left) === String(right);
}

export function resolveSetValueFromAction(
  field: ConditionalLogicFieldLike,
  action: ConditionAction | null | undefined,
  valuesByFieldId: Record<string, unknown>,
  fieldsById: Map<string, ConditionalLogicFieldLike>,
  lookup: RelatedRecordLookup
): unknown | undefined {
  if (!action || action.type !== 'setValue') {
    return undefined;
  }

  const resolved = resolveValueSource(
    normalizeValueSource(action.source),
    valuesByFieldId,
    fieldsById,
    lookup
  );

  // Missing/unresolvable sources → skip apply (do not clear the target).
  if (resolved === undefined || resolved === null) {
    return undefined;
  }

  const coerced = coerceSetValueForField(field, resolved);
  if (coerced === undefined || coerced === null) {
    return undefined;
  }

  return coerced;
}
