import {
  CONDITION_ACTIONS,
  CONDITION_OPERATORS,
  ConditionAction,
  ConditionActionType,
  ConditionGroup,
  ConditionOperator,
  ConditionPredicate,
  FieldCondition,
  FieldConditionalLogic,
  LegacyFieldCondition,
  ValueSource,
} from './conditional-logic.types';
import {
  collectSetValueDependencyFieldIds,
  createDefaultValueSource,
  normalizeValueSource,
  pruneActionsForDeletedFields,
} from './conditional-logic.set-value';

const OPERATOR_SET = new Set<string>(CONDITION_OPERATORS);
const ACTION_SET = new Set<string>(CONDITION_ACTIONS);

export function isConditionPredicate(value: unknown): value is ConditionPredicate {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return typeof record['fieldId'] === 'string' && typeof record['operator'] === 'string';
}

export function isConditionGroup(value: unknown): value is ConditionGroup {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (record['logic'] === 'and' || record['logic'] === 'or') && Array.isArray(record['rules']);
}

export function isFieldConditionalLogic(value: unknown): value is FieldConditionalLogic {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record['enabled'] === 'boolean' ||
    isConditionGroup(record['when']) ||
    Array.isArray(record['actions'])
  );
}

export function isLegacyFieldCondition(value: unknown): value is LegacyFieldCondition {
  if (!value || typeof value !== 'object' || Array.isArray(value) || isFieldConditionalLogic(value)) {
    return false;
  }

  return 'fieldId' in value;
}

export function createEmptyConditionalLogic(): FieldConditionalLogic {
  return {
    enabled: false,
    when: {
      logic: 'and',
      rules: [{ fieldId: '', operator: 'equals', value: '' }],
    },
    actions: [{ type: 'show' }],
  };
}

export function normalizeOperator(raw: unknown): ConditionOperator {
  const normalized = String(raw ?? '')
    .trim()
    .replace(/[\s-]+/g, '_')
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .toLowerCase();

  const aliases: Record<string, ConditionOperator> = {
    equals: 'equals',
    eq: 'equals',
    '==': 'equals',
    not_equals: 'notEquals',
    notequals: 'notEquals',
    neq: 'notEquals',
    '!=': 'notEquals',
    contains: 'contains',
    not_contains: 'notContains',
    notcontains: 'notContains',
    does_not_contain: 'notContains',
    starts_with: 'startsWith',
    startswith: 'startsWith',
    ends_with: 'endsWith',
    endswith: 'endsWith',
    is_empty: 'isEmpty',
    isempty: 'isEmpty',
    is_not_empty: 'isNotEmpty',
    isnotempty: 'isNotEmpty',
    greater_than: 'greaterThan',
    greaterthan: 'greaterThan',
    gt: 'greaterThan',
    '>': 'greaterThan',
    less_than: 'lessThan',
    lessthan: 'lessThan',
    lt: 'lessThan',
    '<': 'lessThan',
    greater_than_or_equal: 'greaterThanOrEqual',
    greaterthanorequal: 'greaterThanOrEqual',
    gte: 'greaterThanOrEqual',
    '>=': 'greaterThanOrEqual',
    less_than_or_equal: 'lessThanOrEqual',
    lessthanorequal: 'lessThanOrEqual',
    lte: 'lessThanOrEqual',
    '<=': 'lessThanOrEqual',
    checked: 'checked',
    unchecked: 'unchecked',
  };

  const mapped = aliases[normalized];
  if (mapped && OPERATOR_SET.has(mapped)) {
    return mapped;
  }

  if (OPERATOR_SET.has(String(raw))) {
    return raw as ConditionOperator;
  }

  return 'equals';
}

export function normalizeActionType(raw: unknown): ConditionActionType {
  const normalized = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  const aliases: Record<string, ConditionActionType> = {
    show: 'show',
    show_field: 'show',
    hide: 'hide',
    hide_field: 'hide',
    require: 'require',
    required: 'require',
    make_required: 'require',
    optional: 'optional',
    make_optional: 'optional',
    enable: 'enable',
    enable_field: 'enable',
    disable: 'disable',
    disable_field: 'disable',
    set_value: 'setValue',
    setvalue: 'setValue',
    set: 'setValue',
  };

  const mapped = aliases[normalized];
  if (mapped && ACTION_SET.has(mapped)) {
    return mapped;
  }

  if (ACTION_SET.has(String(raw))) {
    return raw as ConditionActionType;
  }

  return 'show';
}

function normalizePredicate(raw: unknown): ConditionPredicate | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const record = raw as Record<string, unknown>;
  const fieldId = String(record['fieldId'] ?? record['field_id'] ?? '').trim();

  return {
    fieldId,
    operator: normalizeOperator(record['operator'] ?? 'equals'),
    value: record['value'],
  };
}

function normalizeGroup(raw: unknown): ConditionGroup {
  if (!isConditionGroup(raw)) {
    const predicate = normalizePredicate(raw);
    return {
      logic: 'and',
      rules: predicate ? [predicate] : [{ fieldId: '', operator: 'equals', value: '' }],
    };
  }

  const rules = raw.rules
    .map(rule => (isConditionGroup(rule) ? normalizeGroup(rule) : normalizePredicate(rule)))
    .filter((rule): rule is ConditionPredicate | ConditionGroup => rule !== null);

  return {
    logic: raw.logic === 'or' ? 'or' : 'and',
    rules: rules.length ? rules : [{ fieldId: '', operator: 'equals', value: '' }],
  };
}

function normalizeActions(raw: unknown): ConditionAction[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [{ type: 'show' }];
  }

  const actions: ConditionAction[] = [];

  for (const item of raw) {
    if (typeof item === 'string') {
      actions.push({ type: normalizeActionType(item) });
      continue;
    }

    if (item && typeof item === 'object' && 'type' in item) {
      const type = normalizeActionType((item as ConditionAction).type);
      if (type === 'setValue') {
        actions.push({
          type,
          source: normalizeValueSource((item as ConditionAction).source),
        });
      } else {
        actions.push({ type });
      }
    }
  }

  return actions.length ? actions : [{ type: 'show' }];
}

export function normalizeConditionalLogic(
  raw?: FieldCondition | null
): FieldConditionalLogic | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  if (isFieldConditionalLogic(raw)) {
    return {
      enabled: !!raw.enabled,
      when: normalizeGroup(raw.when),
      actions: normalizeActions(raw.actions),
    };
  }

  if (isLegacyFieldCondition(raw)) {
    const fieldId = String(raw.fieldId || '').trim();
    if (!fieldId) {
      return null;
    }

    return {
      enabled: true,
      when: {
        logic: 'and',
        rules: [{ fieldId, operator: 'equals', value: raw.value ?? '' }],
      },
      actions: [{ type: 'show' }],
    };
  }

  return null;
}

export function cloneConditionalLogic(
  raw?: FieldCondition | null
): FieldConditionalLogic | undefined {
  const normalized = normalizeConditionalLogic(raw);
  if (!normalized) {
    return undefined;
  }

  return JSON.parse(JSON.stringify(normalized)) as FieldConditionalLogic;
}

export function collectSourceFieldIds(
  logic: FieldConditionalLogic | ConditionGroup | null | undefined
): string[] {
  if (!logic) {
    return [];
  }

  const group: ConditionGroup = 'when' in logic ? logic.when : logic;
  const ids: string[] = [];

  for (const rule of group.rules) {
    if (isConditionGroup(rule)) {
      ids.push(...collectSourceFieldIds(rule));
      continue;
    }

    if (rule.fieldId) {
      ids.push(rule.fieldId);
    }
  }

  if ('actions' in logic) {
    ids.push(...collectSetValueDependencyFieldIds(logic));
  }

  return ids;
}

export function hasConfiguredSource(logic: FieldConditionalLogic | null | undefined): boolean {
  return collectSourceFieldIds(logic).some(Boolean);
}

/** Persist configured logic; omit empty dummy conditions. */
export function serializeConditionalLogic(
  raw?: FieldCondition | null
): FieldConditionalLogic | undefined {
  const normalized = normalizeConditionalLogic(raw);

  if (!normalized) {
    return undefined;
  }

  if (!normalized.enabled && !hasConfiguredSource(normalized)) {
    return undefined;
  }

  return cloneConditionalLogic(normalized);
}

export function getPrimaryPredicate(
  logic: FieldConditionalLogic | null | undefined
): ConditionPredicate {
  const fallback: ConditionPredicate = { fieldId: '', operator: 'equals', value: '' };
  const first = logic?.when?.rules?.[0];

  if (!first) {
    return fallback;
  }

  if (isConditionGroup(first)) {
    const nested = first.rules[0];
    return isConditionPredicate(nested) ? { ...nested } : fallback;
  }

  return { ...first };
}

export function setPrimaryPredicate(
  logic: FieldConditionalLogic,
  patch: Partial<ConditionPredicate>
): FieldConditionalLogic {
  const current = getPrimaryPredicate(logic);
  const next: ConditionPredicate = {
    fieldId: patch.fieldId ?? current.fieldId,
    operator: patch.operator ?? current.operator,
    value: patch.value !== undefined ? patch.value : current.value,
  };

  return {
    ...logic,
    when: {
      logic: logic.when?.logic === 'or' ? 'or' : 'and',
      rules: [next, ...(logic.when?.rules?.slice(1) ?? [])],
    },
  };
}

export function getPrimaryActionType(
  logic: FieldConditionalLogic | null | undefined
): ConditionActionType {
  return logic?.actions?.[0]?.type ?? 'show';
}

export function getPrimaryAction(
  logic: FieldConditionalLogic | null | undefined
): ConditionAction {
  return logic?.actions?.[0] ?? { type: 'show' };
}

export function setPrimaryActionType(
  logic: FieldConditionalLogic,
  type: ConditionActionType
): FieldConditionalLogic {
  const current = getPrimaryAction(logic);
  const nextAction: ConditionAction =
    type === 'setValue'
      ? {
          type,
          source:
            current.type === 'setValue'
              ? normalizeValueSource(current.source)
              : createDefaultValueSource('relatedData'),
        }
      : { type };

  return {
    ...logic,
    actions: [nextAction, ...(logic.actions?.slice(1) ?? [])],
  };
}

export function setPrimarySetValueSource(
  logic: FieldConditionalLogic,
  source: ValueSource
): FieldConditionalLogic {
  return {
    ...logic,
    actions: [
      { type: 'setValue', source: normalizeValueSource(source) },
      ...(logic.actions?.slice(1) ?? []),
    ],
  };
}

export function pruneConditionalLogicForDeletedFields(
  raw: FieldCondition | null | undefined,
  deletedIds: Iterable<string>
): FieldConditionalLogic | undefined {
  const logic = normalizeConditionalLogic(raw);
  if (!logic) {
    return undefined;
  }

  const deleted = deletedIds instanceof Set ? deletedIds : new Set(deletedIds);
  if (!deleted.size) {
    return cloneConditionalLogic(logic);
  }

  const referenced = collectSourceFieldIds(logic);
  const lostSource = referenced.some(id => deleted.has(id));

  const next: FieldConditionalLogic = {
    ...logic,
    enabled: lostSource ? false : logic.enabled,
    when: pruneGroup(logic.when, deleted),
    actions: pruneActionsForDeletedFields(logic.actions, deleted),
  };

  return serializeConditionalLogic(next);
}

function pruneGroup(group: ConditionGroup, deletedIds: Set<string>): ConditionGroup {
  return {
    logic: group.logic === 'or' ? 'or' : 'and',
    rules: group.rules.map(rule => {
      if (isConditionGroup(rule)) {
        return pruneGroup(rule, deletedIds);
      }

      if (deletedIds.has(rule.fieldId)) {
        return { ...rule, fieldId: '', value: '' };
      }

      return { ...rule };
    }),
  };
}
