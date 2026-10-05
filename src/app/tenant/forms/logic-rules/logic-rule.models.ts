import { ConditionOperator } from '../../../shared/conditional-logic';

export type LogicConditionMatch = 'all' | 'any';

export type LogicComparisonType = 'fixed' | 'field' | 'relatedData';

export type LogicActionType =
  | 'purchaseRequest'
  | 'sendNotification'
  | 'maintenanceRequest';

export interface LogicConditionComparison {
  type: LogicComparisonType;
  value?: unknown;
  fieldId?: string;
  sourceFieldId?: string;
  property?: string;
}

export interface LogicConditionItem {
  id: string;
  fieldId: string;
  operator: ConditionOperator;
  comparison: LogicConditionComparison;
}

export interface LogicRuleAction {
  id: string;
  type: LogicActionType;
}

/**
 * Form-level Logic Rule for Form Templates.
 * Persisted as DynamicFormPayload.conditionalRules.
 * Separate from per-field Conditional Logic (field.condition).
 */
export interface FormLogicRule {
  id: string;
  name: string;
  enabled: boolean;
  conditions: {
    match: LogicConditionMatch;
    items: LogicConditionItem[];
  };
  actions: LogicRuleAction[];
}

export const LOGIC_ACTION_OPTIONS: ReadonlyArray<{
  value: LogicActionType;
  label: string;
}> = [
  { value: 'purchaseRequest', label: 'Purchase Request' },
  { value: 'sendNotification', label: 'Send Notification' },
  { value: 'maintenanceRequest', label: 'Maintenance Request' },
];

export const LOGIC_COMPARISON_OPTIONS: ReadonlyArray<{
  value: LogicComparisonType;
  label: string;
}> = [
  { value: 'fixed', label: 'Fixed Value' },
  { value: 'field', label: 'Form Field' },
  { value: 'relatedData', label: 'Related Data' },
];

export const LOGIC_OPERATOR_LABELS: Partial<Record<ConditionOperator, string>> = {
  equals: 'equals',
  notEquals: 'does not equal',
  contains: 'contains',
  notContains: 'does not contain',
  startsWith: 'starts with',
  endsWith: 'ends with',
  isEmpty: 'is empty',
  isNotEmpty: 'is not empty',
  greaterThan: 'is greater than',
  lessThan: 'is less than',
  greaterThanOrEqual: 'is greater than or equal to',
  lessThanOrEqual: 'is less than or equal to',
  checked: 'is checked',
  unchecked: 'is not checked',
};
