import {
  CONDITION_OPERATOR_LABELS,
  ConditionOperator,
  filterRelatedPropertiesForTargetKind,
  OPERATORS_WITHOUT_VALUE,
  SetValueFieldKind,
} from '../../../shared/conditional-logic';
import { FormField } from '../../form-builder/models/form-field.model';
import { normalizeFieldOption } from '../../form-builder/utils/field-options.utils';
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

export type LogicFixedValueOption = {
  label: string;
  value: string | number;
};

/** UI control kind for Automation Rule "Specific Value" compares. */
export type LogicFixedComparisonControlKind =
  | 'options'
  | 'options-multi'
  | 'boolean'
  | 'numeric'
  | 'date'
  | 'time'
  | 'text';

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
    case 'barcode':
    case 'qr-code':
      return 'text';
    default:
      return 'text';
  }
}

/**
 * Normalize static/dynamic field options for Specific Value compares.
 * Uses option value (not only label) so saved rules restore correctly.
 */
export function getFixedComparisonOptions(
  field: FormField | null | undefined,
): LogicFixedValueOption[] {
  if (!field?.options?.length) {
    return [];
  }

  return field.options
    .map((option, index) => {
      if (typeof option === 'string' || typeof option === 'number') {
        return { label: String(option), value: option };
      }

      const normalized = normalizeFieldOption(option);
      if (!normalized) {
        return null;
      }

      return {
        label: normalized.label,
        value: normalized.value ?? index,
      };
    })
    .filter((option): option is LogicFixedValueOption => !!option);
}

export function getFixedComparisonControlKind(
  field: FormField | null | undefined,
): LogicFixedComparisonControlKind {
  const kind = resolveLogicFieldKind(field);
  const options = getFixedComparisonOptions(field);

  if (kind === 'select' && options.length > 0) {
    if (field?.type === 'select' && field.selectionType === 'multi') {
      return 'options-multi';
    }
    return 'options';
  }

  if (kind === 'boolean') {
    return 'boolean';
  }
  if (kind === 'numeric') {
    return 'numeric';
  }
  if (kind === 'date') {
    return 'date';
  }
  if (kind === 'time') {
    return 'time';
  }
  return 'text';
}

export function logicFieldKindsCompatible(
  sourceKind: LogicFieldKind,
  otherKind: LogicFieldKind,
): boolean {
  if (sourceKind === 'numeric') {
    return otherKind === 'numeric';
  }
  if (sourceKind === 'date') {
    return otherKind === 'date';
  }
  if (sourceKind === 'time') {
    return otherKind === 'time';
  }
  if (sourceKind === 'boolean') {
    return otherKind === 'boolean';
  }
  if (sourceKind === 'select') {
    // Radio/Select should only compare to other option-based fields.
    return otherKind === 'select';
  }
  // Text-like fields may compare to text or select option values.
  return otherKind === 'text' || otherKind === 'select';
}

/**
 * Filter related-data properties using the same kind rules as setValue /
 * Form Field compares (WHEN field is the source of truth).
 */
export function filterRelatedPropertiesForLogicField(
  columns: Array<{ id: string; label: string }>,
  records: Record<string, unknown>[],
  targetField: FormField | null | undefined,
): Array<{ id: string; label: string }> {
  const kind = resolveLogicFieldKind(targetField) as SetValueFieldKind;
  return filterRelatedPropertiesForTargetKind(columns, records, kind);
}

export function isFixedOptionValueSelected(
  stored: unknown,
  optionValue: string | number,
): boolean {
  if (Array.isArray(stored)) {
    return stored.some(
      (item) => String(item) === String(optionValue),
    );
  }
  if (stored === null || stored === undefined || stored === '') {
    return false;
  }
  return String(stored) === String(optionValue);
}

export function fixedOptionLabelForValue(
  field: FormField | null | undefined,
  stored: unknown,
): string {
  if (Array.isArray(stored)) {
    const labels = stored
      .map((item) => {
        const match = getFixedComparisonOptions(field).find(
          (option) => String(option.value) === String(item),
        );
        return match?.label ?? String(item);
      })
      .filter(Boolean);
    return labels.join(', ');
  }

  if (stored === null || stored === undefined || stored === '') {
    return '';
  }

  const match = getFixedComparisonOptions(field).find(
    (option) => String(option.value) === String(stored),
  );
  return match?.label ?? String(stored);
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
      return ['checked', 'unchecked', 'equals', 'notEquals'];
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
    return logicFieldKindsCompatible(kind, resolveLogicFieldKind(field));
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
    return 'Unknown field';
  }
  const field = schema.find((item) => item.id === fieldId);
  const label = field?.label?.trim();
  return label || 'Unknown field';
}

/**
 * Humanize a stored property key when no column label is available.
 * Never returns a raw internal field-id style string to the UI.
 */
export function formatPropertyLabel(
  property: string | undefined | null,
): string {
  if (!property?.trim()) {
    return 'Unknown property';
  }
  if (looksLikeInternalFieldId(property)) {
    return 'Unknown property';
  }
  return property
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function looksLikeInternalFieldId(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  // Builder/module field ids such as fld_1788885525561_swrehc0
  if (/^fld[_-]/i.test(trimmed)) {
    return true;
  }
  if (/[_-]?\d{10,}[_-]?/i.test(trimmed) && /[a-z]/i.test(trimmed)) {
    return true;
  }
  return false;
}

export type LogicPropertyLabelResolver = (
  sourceFieldId: string | undefined,
  property: string | undefined,
) => string | null | undefined;

export function summarizeCondition(
  condition: LogicConditionItem,
  schema: FormField[],
  resolvePropertyLabel?: LogicPropertyLabelResolver,
): string {
  const field = schema.find((item) => item.id === condition.fieldId);
  const fieldLabel = field?.label?.trim() || 'Unknown field';
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
    const resolved =
      resolvePropertyLabel?.(
        comparison.sourceFieldId,
        comparison.property,
      )?.trim() || '';
    const propertyLabel = resolved || formatPropertyLabel(comparison.property);
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
  resolvePropertyLabel?: LogicPropertyLabelResolver,
): string {
  const items = rule.conditions.items.filter((item) => item.fieldId);
  if (!items.length) {
    return 'No conditions configured';
  }
  const joiner = rule.conditions.match === 'any' ? ' OR ' : ' AND ';
  return items
    .map((item) => summarizeCondition(item, schema, resolvePropertyLabel))
    .join(joiner);
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
  resolvePropertyLabel?: LogicPropertyLabelResolver,
): { when: string; then: string } {
  return {
    when: `IF ${summarizeConditions(rule, schema, resolvePropertyLabel)}`,
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
