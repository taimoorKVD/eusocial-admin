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
  FieldConditionalLogicBundle,
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

export function isFieldConditionalLogicBundle(
  value: unknown
): value is FieldConditionalLogicBundle {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return record['version'] === 2 && Array.isArray(record['rules']);
}

export function isFieldConditionalLogic(value: unknown): value is FieldConditionalLogic {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    isFieldConditionalLogicBundle(value)
  ) {
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
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    isFieldConditionalLogicBundle(value) ||
    isFieldConditionalLogic(value)
  ) {
    return false;
  }

  return 'fieldId' in value;
}

export function createEmptyConditionalLogic(
  options?: { name?: string; enabled?: boolean }
): FieldConditionalLogic {
  return {
    // Missing / undefined defaults to ON (matches Automation + backward compat).
    enabled: options?.enabled !== false,
    name: (options?.name || '').trim() || defaultConditionRuleName(0),
    when: {
      logic: 'and',
      rules: [{ fieldId: '', operator: 'equals', value: '' }],
    },
    actions: [{ type: 'show' }],
  };
}

/** Default tab/payload label for a rule at zero-based index (`Rule 1`, `Rule 2`, …). */
export function defaultConditionRuleName(index: number): string {
  const safeIndex = Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0;
  return `Rule ${safeIndex + 1}`;
}

/** Ensure every rule has a non-empty display name (legacy rules get Rule N). */
export function withConditionRuleNames(
  rules: FieldConditionalLogic[]
): FieldConditionalLogic[] {
  return rules.map((rule, index) => {
    const name = String(rule?.name ?? '').trim() || defaultConditionRuleName(index);
    return { ...rule, name };
  });
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
  const seen = new Set<ConditionActionType>();

  for (const item of raw) {
    let next: ConditionAction | null = null;

    if (typeof item === 'string') {
      next = { type: normalizeActionType(item) };
    } else if (item && typeof item === 'object' && 'type' in item) {
      const type = normalizeActionType((item as ConditionAction).type);
      next =
        type === 'setValue'
          ? {
              type,
              source: normalizeValueSource((item as ConditionAction).source),
            }
          : { type };
    }

    if (!next || seen.has(next.type)) {
      continue;
    }

    // Drop mutually exclusive pairs if both somehow appear in saved data
    // (keep the first occurrence).
    const conflict = CONDITION_ACTION_CONFLICTS[next.type];
    if (conflict && seen.has(conflict)) {
      continue;
    }

    seen.add(next.type);
    actions.push(next);
  }

  return actions.length ? actions : [{ type: 'show' }];
}

export function normalizeConditionalLogic(
  raw?: FieldCondition | null
): FieldConditionalLogic | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  // Multi-rule payload: callers that expect a single rule get the first one.
  // Prefer normalizeFieldConditionRules() when all rules matter.
  if (isFieldConditionalLogicBundle(raw)) {
    const first = raw.rules.find(rule => !!normalizeSingleConditionalLogic(rule));
    return first ? normalizeSingleConditionalLogic(first) : null;
  }

  return normalizeSingleConditionalLogic(raw);
}

function normalizeSingleConditionalLogic(
  raw?: FieldCondition | null
): FieldConditionalLogic | null {
  if (!raw || typeof raw !== 'object' || isFieldConditionalLogicBundle(raw)) {
    return null;
  }

  if (isFieldConditionalLogic(raw)) {
    const name = typeof raw.name === 'string' ? raw.name.trim() : '';
    return {
      // Missing `enabled` (legacy payloads) defaults to ON.
      enabled: raw.enabled !== false,
      when: normalizeGroup(raw.when),
      actions: normalizeActions(raw.actions),
      ...(name ? { name } : {}),
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

/** All independent conditional logic rules stored on a field. */
export function normalizeFieldConditionRules(
  raw?: FieldCondition | null
): FieldConditionalLogic[] {
  if (!raw || typeof raw !== 'object') {
    return [];
  }

  let rules: FieldConditionalLogic[] = [];

  if (isFieldConditionalLogicBundle(raw)) {
    rules = raw.rules
      .map(rule => normalizeSingleConditionalLogic(rule))
      .filter((rule): rule is FieldConditionalLogic => !!rule);
  } else {
    const single = normalizeSingleConditionalLogic(raw);
    rules = single ? [single] : [];
  }

  return withConditionRuleNames(rules);
}

/**
 * Persist one or more rules on `field.condition`.
 * One configured rule stays a plain object (legacy-compatible);
 * two or more use `{ version: 2, rules }`.
 * Each rule always includes the exact display `name`.
 */
export function serializeFieldConditionRules(
  rules: Array<FieldConditionalLogic | null | undefined> | null | undefined
): FieldCondition | undefined {
  // Keep every rule as-is — including empty + disabled.
  // Enabled/disabled must never remove a rule from the list; only Delete does.
  const normalized = withConditionRuleNames(
    (rules ?? []).filter((rule): rule is FieldConditionalLogic => !!rule)
  ).map(
    (rule) => JSON.parse(JSON.stringify(rule)) as FieldConditionalLogic
  );

  if (!normalized.length) {
    return undefined;
  }

  if (normalized.length === 1) {
    return normalized[0];
  }

  return {
    version: 2,
    rules: normalized,
  };
}

export function fieldHasConfiguredConditionRules(
  raw?: FieldCondition | null
): boolean {
  return normalizeFieldConditionRules(raw).some(
    rule => !!rule.enabled && hasConfiguredSource(rule)
  );
}

export function collectFieldConditionSourceFieldIds(
  raw?: FieldCondition | null
): string[] {
  const ids: string[] = [];
  for (const rule of normalizeFieldConditionRules(raw)) {
    ids.push(...collectSourceFieldIds(rule));
  }
  return ids;
}

export function cloneConditionalLogic(
  raw?: FieldCondition | null
): FieldConditionalLogic | undefined {
  const rules = normalizeFieldConditionRules(raw);
  if (!rules.length) {
    return undefined;
  }

  return JSON.parse(JSON.stringify(rules[0])) as FieldConditionalLogic;
}

/** Deep-clone the full condition payload (single rule or multi-rule bundle). */
export function cloneFieldCondition(
  raw?: FieldCondition | null
): FieldCondition | undefined {
  return serializeFieldConditionRules(normalizeFieldConditionRules(raw));
}

/** Field ids referenced only by the WHEN / condition group (not setValue sources). */
export function collectWhenFieldIds(
  logic: FieldConditionalLogic | ConditionGroup | null | undefined
): string[] {
  if (!logic) {
    return [];
  }

  const group: ConditionGroup = 'when' in logic ? logic.when : logic;
  const ids: string[] = [];

  for (const rule of group.rules) {
    if (isConditionGroup(rule)) {
      ids.push(...collectWhenFieldIds(rule));
      continue;
    }

    if (rule.fieldId) {
      ids.push(rule.fieldId);
    }
  }

  return ids;
}

export function collectSourceFieldIds(
  logic: FieldConditionalLogic | ConditionGroup | null | undefined
): string[] {
  if (!logic) {
    return [];
  }

  const ids = collectWhenFieldIds(logic);

  if ('actions' in logic) {
    ids.push(...collectSetValueDependencyFieldIds(logic));
  }

  return ids;
}

export function hasConfiguredSource(logic: FieldConditionalLogic | null | undefined): boolean {
  return collectSourceFieldIds(logic).some(Boolean);
}

/**
 * Persist logic rules (including empty/disabled).
 * Passes through multi-rule bundles intact; single rules stay plain objects.
 */
export function serializeConditionalLogic(
  raw?: FieldCondition | null
): FieldCondition | undefined {
  if (isFieldConditionalLogicBundle(raw)) {
    return serializeFieldConditionRules(normalizeFieldConditionRules(raw));
  }

  const normalized = normalizeSingleConditionalLogic(raw);

  if (!normalized) {
    return undefined;
  }

  return JSON.parse(JSON.stringify(normalized)) as FieldConditionalLogic;
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

/** Mutually exclusive THEN actions (cannot both apply under the same WHEN). */
export const CONDITION_ACTION_CONFLICTS: Readonly<
  Partial<Record<ConditionActionType, ConditionActionType>>
> = {
  show: 'hide',
  hide: 'show',
  require: 'optional',
  optional: 'require',
  enable: 'disable',
  disable: 'enable',
};

export function getSelectedActionTypes(
  logic: FieldConditionalLogic | null | undefined
): ConditionActionType[] {
  const types = (logic?.actions ?? [])
    .map(action => action?.type)
    .filter((type): type is ConditionActionType => ACTION_SET.has(String(type)));
  return types.length ? types : ['show'];
}

export function hasConditionActionType(
  logic: FieldConditionalLogic | null | undefined,
  type: ConditionActionType
): boolean {
  return getSelectedActionTypes(logic).includes(type);
}

export function isConditionActionDisabled(
  logic: FieldConditionalLogic | null | undefined,
  type: ConditionActionType
): boolean {
  if (hasConditionActionType(logic, type)) {
    return false;
  }
  const conflict = CONDITION_ACTION_CONFLICTS[type];
  return !!conflict && hasConditionActionType(logic, conflict);
}

export function getPrimaryActionType(
  logic: FieldConditionalLogic | null | undefined
): ConditionActionType {
  return getSelectedActionTypes(logic)[0] ?? 'show';
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
  const existingSetValue = logic.actions?.find(action => action.type === 'setValue');
  const nextAction: ConditionAction =
    type === 'setValue'
      ? {
          type,
          source: existingSetValue
            ? normalizeValueSource(existingSetValue.source)
            : createDefaultValueSource('relatedData'),
        }
      : { type };

  // Keep other compatible actions; replace/remove conflicts with `type`.
  const conflict = CONDITION_ACTION_CONFLICTS[type];
  const retained = (logic.actions ?? []).filter(
    action => action.type !== type && action.type !== conflict
  );

  return {
    ...logic,
    actions: [nextAction, ...retained],
  };
}

/**
 * Toggle a THEN action on/off while preserving other compatible actions.
 * Removes a mutually exclusive conflict when enabling. Keeps at least one action.
 */
export function toggleConditionAction(
  logic: FieldConditionalLogic,
  type: ConditionActionType
): FieldConditionalLogic {
  const current = [...(logic.actions ?? [])];
  const existingIndex = current.findIndex(action => action.type === type);

  if (existingIndex >= 0) {
    if (current.length <= 1) {
      return { ...logic, actions: current };
    }
    current.splice(existingIndex, 1);
    return { ...logic, actions: current };
  }

  const conflict = CONDITION_ACTION_CONFLICTS[type];
  const withoutConflict = conflict
    ? current.filter(action => action.type !== conflict)
    : current;

  const nextAction: ConditionAction =
    type === 'setValue'
      ? {
          type,
          source:
            getPrimarySetValueSourceFromActions(withoutConflict) ??
            createDefaultValueSource('relatedData'),
        }
      : { type };

  return {
    ...logic,
    actions: [...withoutConflict, nextAction],
  };
}

function getPrimarySetValueSourceFromActions(
  actions: ConditionAction[]
): ValueSource | null {
  const action = actions.find(item => item.type === 'setValue');
  return action ? normalizeValueSource(action.source) : null;
}

export function setPrimarySetValueSource(
  logic: FieldConditionalLogic,
  source: ValueSource
): FieldConditionalLogic {
  const normalized = normalizeValueSource(source);
  const actions = [...(logic.actions ?? [])];
  const index = actions.findIndex(action => action.type === 'setValue');

  if (index >= 0) {
    actions[index] = { type: 'setValue', source: normalized };
    return { ...logic, actions };
  }

  return {
    ...logic,
    actions: [...actions, { type: 'setValue', source: normalized }],
  };
}

export function pruneConditionalLogicForDeletedFields(
  raw: FieldCondition | null | undefined,
  deletedIds: Iterable<string>
): FieldCondition | undefined {
  const rules = normalizeFieldConditionRules(raw);
  if (!rules.length) {
    return undefined;
  }

  const deleted = deletedIds instanceof Set ? deletedIds : new Set(deletedIds);
  if (!deleted.size) {
    return serializeFieldConditionRules(rules);
  }

  const nextRules = rules.map(logic => {
    const referenced = collectSourceFieldIds(logic);
    const lostSource = referenced.some(id => deleted.has(id));
    return {
      ...logic,
      enabled: lostSource ? false : logic.enabled,
      when: pruneGroup(logic.when, deleted),
      actions: pruneActionsForDeletedFields(logic.actions, deleted),
    };
  });

  return serializeFieldConditionRules(nextRules);
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
