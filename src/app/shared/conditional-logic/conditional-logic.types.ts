export const CONDITION_OPERATORS = [
  'equals',
  'notEquals',
  'contains',
  'notContains',
  'startsWith',
  'endsWith',
  'isEmpty',
  'isNotEmpty',
  'greaterThan',
  'lessThan',
  'greaterThanOrEqual',
  'lessThanOrEqual',
  'checked',
  'unchecked',
] as const;

export type ConditionOperator = (typeof CONDITION_OPERATORS)[number];

export const CONDITION_ACTIONS = [
  'show',
  'hide',
  'require',
  'optional',
  'enable',
  'disable',
] as const;

export type ConditionActionType = (typeof CONDITION_ACTIONS)[number];

export interface ConditionPredicate {
  fieldId: string;
  operator: ConditionOperator;
  value?: unknown;
}

export interface ConditionGroup {
  logic: 'and' | 'or';
  rules: Array<ConditionPredicate | ConditionGroup>;
}

export interface ConditionAction {
  type: ConditionActionType;
}

/**
 * Persisted per-field conditional logic.
 * `when` is already a group so AND/OR / nested rules can be added later
 * without another schema migration.
 */
export interface FieldConditionalLogic {
  enabled: boolean;
  when: ConditionGroup;
  actions: ConditionAction[];
}

/** Legacy builder shape: implied equals + show. */
export interface LegacyFieldCondition {
  fieldId: string;
  value?: unknown;
}

export type FieldCondition = FieldConditionalLogic | LegacyFieldCondition;

export interface ConditionalFieldEffects {
  visible: boolean;
  required: boolean;
  disabled: boolean;
}

export interface ConditionalLogicFieldLike {
  id: string;
  name?: string;
  type?: string;
  label?: string;
  required?: boolean;
  isShow?: boolean;
  isReadonly?: boolean;
  readonly?: boolean;
  options?: unknown[];
  condition?: FieldCondition | null;
}

export const CONDITION_OPERATOR_LABELS: Record<ConditionOperator, string> = {
  equals: 'Equals',
  notEquals: 'Not Equals',
  contains: 'Contains',
  notContains: 'Does Not Contain',
  startsWith: 'Starts With',
  endsWith: 'Ends With',
  isEmpty: 'Is Empty',
  isNotEmpty: 'Is Not Empty',
  greaterThan: 'Greater Than',
  lessThan: 'Less Than',
  greaterThanOrEqual: 'Greater Than Or Equal',
  lessThanOrEqual: 'Less Than Or Equal',
  checked: 'Checked',
  unchecked: 'Unchecked',
};

export const CONDITION_ACTION_LABELS: Record<ConditionActionType, string> = {
  show: 'Show Field',
  hide: 'Hide Field',
  require: 'Make Required',
  optional: 'Make Optional',
  enable: 'Enable Field',
  disable: 'Disable Field',
};

export const OPERATORS_WITHOUT_VALUE: ReadonlySet<ConditionOperator> = new Set([
  'isEmpty',
  'isNotEmpty',
  'checked',
  'unchecked',
]);
