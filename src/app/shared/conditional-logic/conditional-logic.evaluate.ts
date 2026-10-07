import {
  ConditionGroup,
  ConditionOperator,
  ConditionPredicate,
  ConditionalFieldEffects,
  ConditionalLogicFieldLike,
  FieldCondition,
  OPERATORS_WITHOUT_VALUE,
} from './conditional-logic.types';
import {
  collectSourceFieldIds,
  isConditionGroup,
  normalizeConditionalLogic,
} from './conditional-logic.normalize';

export function operatorRequiresValue(operator: ConditionOperator): boolean {
  return !OPERATORS_WITHOUT_VALUE.has(operator);
}

/**
 * Measurement / price FormControls store `{ value, unit }` (also amount/quantity).
 * Condition rules store primitives (e.g. `"6"`). Unwrap so comparisons use the amount.
 */
function unwrapComparableValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }

  const record = value as Record<string, unknown>;
  if (
    Object.prototype.hasOwnProperty.call(record, 'value') ||
    Object.prototype.hasOwnProperty.call(record, 'amount') ||
    Object.prototype.hasOwnProperty.call(record, 'quantity')
  ) {
    return unwrapComparableValue(
      record['value'] ?? record['amount'] ?? record['quantity'],
    );
  }

  return value;
}

export function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }

  if (typeof value === 'string') {
    return value.trim() === '';
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  if (typeof value === 'boolean') {
    return false;
  }

  if (typeof value === 'object') {
    const unwrapped = unwrapComparableValue(value);
    if (unwrapped !== value) {
      return isEmptyValue(unwrapped);
    }
  }

  return false;
}

function stringifyValue(value: unknown): string {
  const comparable = unwrapComparableValue(value);
  if (comparable === null || comparable === undefined) {
    return '';
  }

  return String(comparable);
}

function toNumber(value: unknown): number | null {
  const comparable = unwrapComparableValue(value);

  if (typeof comparable === 'number' && Number.isFinite(comparable)) {
    return comparable;
  }

  if (typeof comparable === 'boolean') {
    return comparable ? 1 : 0;
  }

  const parsed = Number(stringifyValue(comparable).trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function isTruthyToken(value: unknown): boolean {
  const normalized = stringifyValue(value).trim().toLowerCase();
  return normalized === 'true' || normalized === 'yes' || normalized === '1' || normalized === 'on' || normalized === 'checked';
}

function isFalsyToken(value: unknown): boolean {
  const normalized = stringifyValue(value).trim().toLowerCase();
  return normalized === 'false' || normalized === 'no' || normalized === '0' || normalized === 'off' || normalized === 'unchecked';
}

export function isCheckedValue(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (Array.isArray(value)) {
    return value.some(item => {
      if (typeof item === 'boolean') {
        return item;
      }
      return !isEmptyValue(item) && !isFalsyToken(item);
    });
  }

  if (isTruthyToken(value)) {
    return true;
  }

  if (isFalsyToken(value) || isEmptyValue(value)) {
    return false;
  }

  return false;
}

function valuesEqual(actual: unknown, expected: unknown): boolean {
  if (Array.isArray(actual)) {
    if (Array.isArray(expected)) {
      if (actual.length !== expected.length) {
        return false;
      }

      return expected.every(item =>
        actual.some(actualItem => stringifyValue(actualItem) === stringifyValue(item))
      );
    }

    return actual.some(item => stringifyValue(item) === stringifyValue(expected));
  }

  if (typeof actual === 'boolean') {
    if (typeof expected === 'boolean') {
      return actual === expected;
    }

    return actual ? isTruthyToken(expected) : isFalsyToken(expected) || isEmptyValue(expected);
  }

  return stringifyValue(actual) === stringifyValue(expected);
}

function valueContains(actual: unknown, expected: unknown): boolean {
  const needle = stringifyValue(expected).toLowerCase();
  if (!needle) {
    return false;
  }

  if (Array.isArray(actual)) {
    return actual.some(item => stringifyValue(item).toLowerCase().includes(needle));
  }

  return stringifyValue(actual).toLowerCase().includes(needle);
}

export function evaluatePredicate(
  predicate: ConditionPredicate,
  valuesByFieldId: Record<string, unknown>
): boolean {
  const actual = valuesByFieldId[predicate.fieldId];
  const expected = predicate.value;

  switch (predicate.operator) {
    case 'isEmpty':
      return isEmptyValue(actual);
    case 'isNotEmpty':
      return !isEmptyValue(actual);
    case 'checked':
      return isCheckedValue(actual);
    case 'unchecked':
      return !isCheckedValue(actual);
    case 'equals':
      return valuesEqual(actual, expected);
    case 'notEquals':
      return !valuesEqual(actual, expected);
    case 'contains':
      return valueContains(actual, expected);
    case 'notContains':
      return !valueContains(actual, expected);
    case 'startsWith':
      return stringifyValue(actual).toLowerCase().startsWith(stringifyValue(expected).toLowerCase());
    case 'endsWith':
      return stringifyValue(actual).toLowerCase().endsWith(stringifyValue(expected).toLowerCase());
    case 'greaterThan': {
      const left = toNumber(actual);
      const right = toNumber(expected);
      return left !== null && right !== null && left > right;
    }
    case 'lessThan': {
      const left = toNumber(actual);
      const right = toNumber(expected);
      return left !== null && right !== null && left < right;
    }
    case 'greaterThanOrEqual': {
      const left = toNumber(actual);
      const right = toNumber(expected);
      return left !== null && right !== null && left >= right;
    }
    case 'lessThanOrEqual': {
      const left = toNumber(actual);
      const right = toNumber(expected);
      return left !== null && right !== null && left <= right;
    }
    default:
      return false;
  }
}

export function evaluateConditionGroup(
  group: ConditionGroup,
  valuesByFieldId: Record<string, unknown>
): boolean {
  if (!group.rules.length) {
    return false;
  }

  const results = group.rules.map(rule =>
    isConditionGroup(rule)
      ? evaluateConditionGroup(rule, valuesByFieldId)
      : evaluatePredicate(rule, valuesByFieldId)
  );

  return group.logic === 'or' ? results.some(Boolean) : results.every(Boolean);
}

export function resolveConditionalEffects(
  field: ConditionalLogicFieldLike,
  valuesByFieldId: Record<string, unknown>
): ConditionalFieldEffects {
  const schemaVisible = field.isShow !== false;
  const schemaRequired = !!field.required;
  const schemaDisabled = field.isReadonly === true || field.readonly === true;
  const logic = normalizeConditionalLogic(field.condition);

  if (!logic?.enabled || !collectSourceFieldIds(logic).some(Boolean)) {
    return {
      visible: schemaVisible,
      required: schemaRequired,
      disabled: schemaDisabled,
    };
  }

  const matched = evaluateConditionGroup(logic.when, valuesByFieldId);

  let visible = schemaVisible;
  let required = schemaRequired;
  let disabled = schemaDisabled;

  for (const action of logic.actions) {
    switch (action.type) {
      case 'show':
        visible = matched;
        break;
      case 'hide':
        visible = !matched;
        break;
      case 'require':
        required = matched ? true : schemaRequired;
        break;
      case 'optional':
        required = matched ? false : schemaRequired;
        break;
      case 'enable':
        disabled = matched ? false : true;
        break;
      case 'disable':
        disabled = matched ? true : schemaDisabled;
        break;
      case 'setValue':
        // Value application is handled by the form runtime (emitEvent: false).
        break;
    }
  }

  return { visible, required, disabled };
}

export function resolveAllConditionalEffects(
  fields: ConditionalLogicFieldLike[],
  valuesByFieldId: Record<string, unknown>
): Record<string, ConditionalFieldEffects> {
  const effects: Record<string, ConditionalFieldEffects> = {};

  for (const field of fields) {
    effects[field.id] = resolveConditionalEffects(field, valuesByFieldId);
  }

  return effects;
}

export function hasEnabledVisibilityCondition(
  field: ConditionalLogicFieldLike
): boolean {
  const logic = normalizeConditionalLogic(field.condition);
  return (
    !!logic?.enabled &&
    collectSourceFieldIds(logic).some(Boolean) &&
    logic.actions.some(action => action.type === 'show' || action.type === 'hide')
  );
}

/** Fields that must stay in the runtime renderer so Show/Hide can execute. */
export function shouldIncludeFieldInRuntimeForm(
  field: ConditionalLogicFieldLike & { label?: string }
): boolean {
  if (hasEnabledVisibilityCondition(field)) {
    return true;
  }

  return field.isShow !== false;
}

export function resolveCollectionConditionalEffects(
  fields: Array<ConditionalLogicFieldLike & { value?: unknown }>
): Record<string, ConditionalFieldEffects> {
  const valuesByFieldId: Record<string, unknown> = {};

  for (const field of fields) {
    valuesByFieldId[field.id] = field.value;
  }

  return resolveAllConditionalEffects(fields, valuesByFieldId);
}

export function conditionalEffectsEqual(
  left: Record<string, ConditionalFieldEffects>,
  right: Record<string, ConditionalFieldEffects>
): boolean {
  const leftIds = Object.keys(left);
  const rightIds = Object.keys(right);

  if (leftIds.length !== rightIds.length) {
    return false;
  }

  return leftIds.every(id => {
    const a = left[id];
    const b = right[id];
    return (
      !!b &&
      a.visible === b.visible &&
      a.required === b.required &&
      a.disabled === b.disabled
    );
  });
}

export function buildValuesByFieldId(
  fields: Array<{ id: string; name?: string }>,
  valuesByName: Record<string, unknown>
): Record<string, unknown> {
  const valuesByFieldId: Record<string, unknown> = {};

  for (const field of fields) {
    const key = field.name || field.id;
    valuesByFieldId[field.id] = valuesByName[key];
  }

  return valuesByFieldId;
}

export function wouldCreateCircularDependency(
  dependentFieldId: string,
  sourceFieldId: string,
  schema: Array<{ id: string; condition?: FieldCondition | null }>
): boolean {
  if (!sourceFieldId || sourceFieldId === dependentFieldId) {
    return true;
  }

  const fieldsById = new Map(schema.map(field => [field.id, field]));
  const visited = new Set<string>();
  const stack = [sourceFieldId];

  while (stack.length) {
    const currentId = stack.pop() as string;

    if (currentId === dependentFieldId) {
      return true;
    }

    if (visited.has(currentId)) {
      continue;
    }

    visited.add(currentId);

    const current = fieldsById.get(currentId);
    const logic = normalizeConditionalLogic(current?.condition);
    if (!logic) {
      continue;
    }

    for (const nextId of collectSourceFieldIds(logic)) {
      if (nextId) {
        stack.push(nextId);
      }
    }
  }

  return false;
}

export function getValidConditionalSourceFields<T extends ConditionalLogicFieldLike>(
  schema: T[],
  currentFieldId: string
): T[] {
  return schema.filter(
    field =>
      field.id !== currentFieldId &&
      !wouldCreateCircularDependency(currentFieldId, field.id, schema)
  );
}
