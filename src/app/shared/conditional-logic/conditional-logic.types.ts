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
  'setValue',
] as const;

export type ConditionActionType = (typeof CONDITION_ACTIONS)[number];

export const VALUE_SOURCE_KINDS = [
  'fixed',
  'field',
  'relatedData',
  'expression',
] as const;

export type ValueSourceKind = (typeof VALUE_SOURCE_KINDS)[number];

export const EXPRESSION_OPS = [
  'multiply',
  'add',
  'subtract',
  'divide',
] as const;

export type ExpressionOp = (typeof EXPRESSION_OPS)[number];

export interface FixedValueSource {
  kind: 'fixed';
  value?: unknown;
}

export interface FieldValueSource {
  kind: 'field';
  fieldId: string;
}

export interface RelatedDataValueSource {
  kind: 'relatedData';
  sourceFieldId: string;
  property: string;
}

export interface ExpressionValueSource {
  kind: 'expression';
  op: ExpressionOp;
  left: ValueSource;
  right: ValueSource;
}

export type ValueSource =
  | FixedValueSource
  | FieldValueSource
  | RelatedDataValueSource
  | ExpressionValueSource;

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
  /** Present when `type === 'setValue'`. */
  source?: ValueSource;
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
  selectionType?: 'single' | 'multi' | string;
  unitMode?: string;
  unit?: string;
  optionSource?: {
    type?: string;
    endpoint?: string;
    response?: {
      labelKey?: string;
      valueKey?: string;
      dataPath?: string;
    };
  } | null;
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
  setValue: 'Set Value',
};

export const VALUE_SOURCE_KIND_LABELS: Record<ValueSourceKind, string> = {
  fixed: 'Fixed Value',
  field: 'Form Field',
  relatedData: 'Related Data',
  expression: 'Calculation',
};

export const EXPRESSION_OP_LABELS: Record<ExpressionOp, string> = {
  multiply: 'Multiply (×)',
  add: 'Add (+)',
  subtract: 'Subtract (−)',
  divide: 'Divide (÷)',
};

export const OPERATORS_WITHOUT_VALUE: ReadonlySet<ConditionOperator> = new Set([
  'isEmpty',
  'isNotEmpty',
  'checked',
  'unchecked',
]);

/** Field types that can receive an automatic setValue result. */
export const SET_VALUE_COMPATIBLE_TYPES: ReadonlySet<string> = new Set([
  'text',
  'email',
  'textarea',
  'number',
  'price',
  'length',
  'mass',
  'volume',
  'temperature',
  'date',
  'time',
  'select',
  'radio',
  'barcode',
  'qr-code',
]);
