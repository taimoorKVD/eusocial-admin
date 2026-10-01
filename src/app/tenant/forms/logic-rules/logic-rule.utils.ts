import {
  CONDITION_OPERATOR_LABELS,
  ConditionOperator,
  OPERATORS_WITHOUT_VALUE,
} from '../../../shared/conditional-logic';
import { FormField } from '../../form-builder/models/form-field.model';
import { normalizeOptionSource } from '../../form-builder/utils/option-source.utils';
import {
  FormLogicRule,
  LogicActionType,
  LogicComparisonType,
  LogicConditionItem,
  LogicConditionMatch,
  LOGIC_ACTION_OPTIONS,
  LOGIC_OPERATOR_LABELS,
  LogicRuleAction,
} from './logic-rule.models';

export function createLogicRuleId(): string {
  return `logic_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createEmptyLogicCondition(): LogicConditionItem {
  return {
    id: createLogicRuleId(),
    fieldId: '',
    operator: 'equals',
    comparison: { type: 'fixed', value: '' },
  };
}

export function createEmptyLogicAction(
  type: LogicActionType = 'purchaseRequest',
): LogicRuleAction {
  return { id: createLogicRuleId(), type };
}

export function createEmptyLogicRule(name = ''): FormLogicRule {
  return {
    id: createLogicRuleId(),
    name,
    enabled: true,
    conditions: {
      match: 'all',
      items: [createEmptyLogicCondition()],
    },
    actions: [createEmptyLogicAction()],
  };
}

export function normalizeLogicRules(raw: unknown): FormLogicRule[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((item) => normalizeLogicRule(item))
    .filter((rule): rule is FormLogicRule => rule != null);
}

function normalizeLogicRule(raw: unknown): FormLogicRule | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const conditionsRaw = record['conditions'];
  const conditionsObj =
    conditionsRaw && typeof conditionsRaw === 'object'
      ? (conditionsRaw as Record<string, unknown>)
      : {};

  const match: LogicConditionMatch =
    conditionsObj['match'] === 'any' || conditionsObj['logic'] === 'or'
      ? 'any'
      : 'all';

  const itemsRaw = Array.isArray(conditionsObj['items'])
    ? conditionsObj['items']
    : Array.isArray(conditionsObj['rules'])
      ? conditionsObj['rules']
      : [];

  const items = itemsRaw
    .map((item) => normalizeLogicCondition(item))
    .filter((item): item is LogicConditionItem => item != null);

  const actionsRaw = Array.isArray(record['actions']) ? record['actions'] : [];
  const actions = actionsRaw
    .map((action) => normalizeLogicAction(action))
    .filter((action): action is LogicRuleAction => action != null);

  return {
    id: String(record['id'] ?? createLogicRuleId()),
    name: String(record['name'] ?? '').trim() || 'Untitled Rule',
    enabled: record['enabled'] !== false,
    conditions: {
      match,
      items: items.length ? items : [createEmptyLogicCondition()],
    },
    actions: actions.length ? actions : [createEmptyLogicAction()],
  };
}

function normalizeLogicCondition(raw: unknown): LogicConditionItem | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const comparisonRaw = record['comparison'];
  const comparisonObj =
    comparisonRaw && typeof comparisonRaw === 'object'
      ? (comparisonRaw as Record<string, unknown>)
      : {};

  const type = normalizeComparisonType(
    comparisonObj['type'] ?? record['comparisonType'],
  );

  return {
    id: String(record['id'] ?? createLogicRuleId()),
    fieldId: String(record['fieldId'] ?? ''),
    operator: normalizeOperator(record['operator']),
    comparison: {
      type,
      value: comparisonObj['value'] ?? record['value'],
      fieldId: comparisonObj['fieldId']
        ? String(comparisonObj['fieldId'])
        : undefined,
      sourceFieldId: comparisonObj['sourceFieldId']
        ? String(comparisonObj['sourceFieldId'])
        : undefined,
      property: comparisonObj['property']
        ? String(comparisonObj['property'])
        : undefined,
    },
  };
}

function normalizeLogicAction(raw: unknown): LogicRuleAction | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const type = normalizeActionType(record['type']);
  if (!type) {
    return null;
  }
  return {
    id: String(record['id'] ?? createLogicRuleId()),
    type,
  };
}

function normalizeComparisonType(raw: unknown): LogicComparisonType {
  const value = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (value === 'field' || value === 'formfield') {
    return 'field';
  }
  if (value === 'relateddata' || value === 'related_data') {
    return 'relatedData';
  }
  return 'fixed';
}

function normalizeActionType(raw: unknown): LogicActionType | null {
  const value = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
  if (value === 'purchaserequest') {
    return 'purchaseRequest';
  }
  if (value === 'sendnotification' || value === 'notification') {
    return 'sendNotification';
  }
  if (value === 'maintenancerequest') {
    return 'maintenanceRequest';
  }
  return null;
}

function normalizeOperator(raw: unknown): ConditionOperator {
  const value = String(raw ?? '')
    .trim()
    .replace(/[\s_-]+/g, '')
    .toLowerCase();

  const aliases: Record<string, ConditionOperator> = {
    equals: 'equals',
    eq: 'equals',
    notequals: 'notEquals',
    ne: 'notEquals',
    contains: 'contains',
    notcontains: 'notContains',
    startswith: 'startsWith',
    endswith: 'endsWith',
    isempty: 'isEmpty',
    isnotempty: 'isNotEmpty',
    greaterthan: 'greaterThan',
    gt: 'greaterThan',
    lessthan: 'lessThan',
    lt: 'lessThan',
    greaterthanorequal: 'greaterThanOrEqual',
    gte: 'greaterThanOrEqual',
    lessthanorequal: 'lessThanOrEqual',
    lte: 'lessThanOrEqual',
    checked: 'checked',
    ischecked: 'checked',
    unchecked: 'unchecked',
    isnotchecked: 'unchecked',
  };

  return aliases[value] ?? 'equals';
}

export function isLogicEligibleField(field: FormField): boolean {
  const type = field.type;
  if (
    type === 'image' ||
    type === 'signature' ||
    type === 'barcode' ||
    type === 'qr-code'
  ) {
    return false;
  }
  return field.isShow !== false;
}

export function getLogicEligibleFields(schema: FormField[]): FormField[] {
  return schema.filter(isLogicEligibleField);
}

export type LogicFieldKind =
  | 'numeric'
  | 'text'
  | 'boolean'
  | 'select'
  | 'date'
  | 'time'
  | 'other';

export function resolveLogicFieldKind(
  field: FormField | null | undefined,
): LogicFieldKind {
  if (!field) {
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
    default:
      return 'text';
  }
}

export function getOperatorsForFieldType(
  field: FormField | null | undefined,
): ConditionOperator[] {
  const kind = resolveLogicFieldKind(field);
  switch (kind) {
    case 'numeric':
      return [
        'equals',
        'notEquals',
        'greaterThan',
        'greaterThanOrEqual',
        'lessThan',
        'lessThanOrEqual',
      ];
    case 'boolean':
      return ['checked', 'unchecked'];
    case 'select':
      return ['equals', 'notEquals', 'isEmpty', 'isNotEmpty'];
    case 'date':
    case 'time':
      return [
        'equals',
        'notEquals',
        'greaterThan',
        'lessThan',
        'isEmpty',
        'isNotEmpty',
      ];
    case 'text':
    default:
      return [
        'equals',
        'notEquals',
        'contains',
        'notContains',
        'startsWith',
        'endsWith',
        'isEmpty',
        'isNotEmpty',
      ];
  }
}

export function getOperatorLabel(
  operator: ConditionOperator,
  field?: FormField | null,
): string {
  const kind = resolveLogicFieldKind(field);
  if (kind === 'date' || kind === 'time') {
    if (operator === 'greaterThan') {
      return 'is after';
    }
    if (operator === 'lessThan') {
      return 'is before';
    }
  }
  return (
    LOGIC_OPERATOR_LABELS[operator] ??
    CONDITION_OPERATOR_LABELS[operator] ??
    operator
  );
}

export function operatorNeedsComparisonValue(
  operator: ConditionOperator,
): boolean {
  return !OPERATORS_WITHOUT_VALUE.has(operator);
}

export function getCompatibleCompareFields(
  schema: FormField[],
  sourceField: FormField | null | undefined,
  excludeFieldId?: string,
): FormField[] {
  const kind = resolveLogicFieldKind(sourceField);
  return getLogicEligibleFields(schema).filter((field) => {
    if (excludeFieldId && field.id === excludeFieldId) {
      return false;
    }
    if (sourceField && field.id === sourceField.id) {
      return false;
    }
    const otherKind = resolveLogicFieldKind(field);
    if (kind === 'numeric') {
      return otherKind === 'numeric';
    }
    if (kind === 'date') {
      return otherKind === 'date';
    }
    if (kind === 'time') {
      return otherKind === 'time';
    }
    if (kind === 'boolean') {
      return otherKind === 'boolean';
    }
    if (kind === 'select') {
      return otherKind === 'select' || otherKind === 'text';
    }
    return otherKind === 'text' || otherKind === 'select';
  });
}

export function isDynamicSourceField(field: FormField): boolean {
  const source = normalizeOptionSource(field.optionSource);
  return (
    field.type === 'select' && source?.type === 'dynamic' && !!source.endpoint
  );
}

export function getDynamicSourceFields(schema: FormField[]): FormField[] {
  return schema.filter(isDynamicSourceField);
}

export function getDynamicSourceEndpoint(field: FormField): string {
  const source = normalizeOptionSource(field.optionSource);
  return source?.endpoint?.trim() || '';
}

export function getActionLabel(type: LogicActionType): string {
  return (
    LOGIC_ACTION_OPTIONS.find((option) => option.value === type)?.label ?? type
  );
}

export function findFieldLabel(
  schema: FormField[],
  fieldId: string | undefined | null,
): string {
  if (!fieldId) {
    return 'Field';
  }
  const field = schema.find((item) => item.id === fieldId);
  return field?.label?.trim() || 'Field';
}

export function formatPropertyLabel(
  property: string | undefined | null,
): string {
  if (!property) {
    return 'Property';
  }
  return property
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export function summarizeCondition(
  condition: LogicConditionItem,
  schema: FormField[],
): string {
  const field = schema.find((item) => item.id === condition.fieldId);
  const fieldLabel = field?.label?.trim() || 'Field';
  const operatorLabel = getOperatorLabel(condition.operator, field);

  if (!operatorNeedsComparisonValue(condition.operator)) {
    return `${fieldLabel} ${operatorLabel}`;
  }

  const comparison = condition.comparison;
  if (comparison.type === 'field') {
    return `${fieldLabel} ${operatorLabel} ${findFieldLabel(schema, comparison.fieldId)}`;
  }

  if (comparison.type === 'relatedData') {
    const sourceLabel = findFieldLabel(schema, comparison.sourceFieldId);
    const propertyLabel = formatPropertyLabel(comparison.property);
    return `${fieldLabel} ${operatorLabel} ${sourceLabel} → ${propertyLabel}`;
  }

  const value =
    comparison.value === null || comparison.value === undefined
      ? '…'
      : String(comparison.value).trim() || '…';
  return `${fieldLabel} ${operatorLabel} ${value}`;
}

export function summarizeConditions(
  rule: FormLogicRule,
  schema: FormField[],
): string {
  const items = rule.conditions.items.filter((item) => item.fieldId);
  if (!items.length) {
    return 'No conditions configured';
  }
  const joiner = rule.conditions.match === 'any' ? ' OR ' : ' AND ';
  return items.map((item) => summarizeCondition(item, schema)).join(joiner);
}

export function summarizeActions(rule: FormLogicRule): string {
  if (!rule.actions.length) {
    return 'No actions configured';
  }
  return rule.actions.map((action) => getActionLabel(action.type)).join(' + ');
}

export function summarizeRuleCard(
  rule: FormLogicRule,
  schema: FormField[],
): { when: string; then: string } {
  return {
    when: `IF ${summarizeConditions(rule, schema)}`,
    then: `THEN ${summarizeActions(rule)}`,
  };
}

export function collectLogicRuleFieldIds(rule: FormLogicRule): string[] {
  const ids = new Set<string>();
  for (const item of rule.conditions.items) {
    if (item.fieldId) {
      ids.add(item.fieldId);
    }
    if (item.comparison.fieldId) {
      ids.add(item.comparison.fieldId);
    }
    if (item.comparison.sourceFieldId) {
      ids.add(item.comparison.sourceFieldId);
    }
  }
  return [...ids];
}

export function findLogicRulesUsingField(
  rules: FormLogicRule[],
  fieldId: string,
): FormLogicRule[] {
  if (!fieldId) {
    return [];
  }
  return rules.filter((rule) =>
    collectLogicRuleFieldIds(rule).includes(fieldId),
  );
}

export function pruneLogicRulesForDeletedFields(
  rules: FormLogicRule[],
  deletedFieldIds: string[],
): FormLogicRule[] {
  if (!deletedFieldIds.length || !rules.length) {
    return rules;
  }
  const deleted = new Set(deletedFieldIds);
  return rules.filter((rule) => {
    const refs = collectLogicRuleFieldIds(rule);
    return !refs.some((id) => deleted.has(id));
  });
}

export function cloneLogicRule(rule: FormLogicRule): FormLogicRule {
  return JSON.parse(JSON.stringify(rule)) as FormLogicRule;
}
