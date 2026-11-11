import { ConditionOperator } from '../../../shared/conditional-logic';
import { FormField } from '../../form-builder/models/form-field.model';
import {
  FormLogicRule,
  LogicConditionItem,
  LogicComparisonType,
} from './logic-rule.models';
import {
  filterRelatedPropertiesForLogicField,
  getCompatibleCompareFields,
  getFixedComparisonControlKind,
  getFixedComparisonOptions,
  getOperatorsForFieldType,
  isFixedOptionValueSelected,
  operatorNeedsComparisonValue,
} from './logic-rule.utils';

export type LogicRuleValidationField =
  | 'name'
  | 'condition'
  | 'comparison'
  | 'action'
  | 'general';

export interface LogicRuleValidationIssue {
  /** Index within the rules list being validated (0 for single-rule editor). */
  ruleIndex: number;
  /** Condition row index when the issue is condition-related. */
  conditionIndex?: number;
  field: LogicRuleValidationField;
  message: string;
}

export interface LogicRuleValidationContext {
  schema: FormField[];
  resolveRelatedColumns: (
    sourceFieldId: string,
  ) => Array<{ id: string; label: string }>;
  resolveRelatedRecords: (
    sourceFieldId: string,
  ) => Record<string, unknown>[];
}

function isBlank(value: unknown): boolean {
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

function normalizeNameKey(name: string | undefined | null): string {
  return String(name ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function fieldById(
  schema: FormField[],
  fieldId: string | undefined | null,
): FormField | null {
  const id = String(fieldId ?? '').trim();
  if (!id) {
    return null;
  }
  return schema.find((item) => item.id === id) ?? null;
}

function validateFixedComparisonValue(
  field: FormField | null,
  value: unknown,
  conditionIndex: number,
  ruleIndex: number,
): LogicRuleValidationIssue[] {
  const kind = getFixedComparisonControlKind(field);
  const options = getFixedComparisonOptions(field);

  if (kind === 'options' || kind === 'options-multi' || kind === 'boolean') {
    if (kind === 'options' && options.length === 0) {
      return [
        {
          ruleIndex,
          conditionIndex,
          field: 'comparison',
          message: 'No valid options are available for this answer.',
        },
      ];
    }
    if (isBlank(value)) {
      return [
        {
          ruleIndex,
          conditionIndex,
          field: 'comparison',
          message:
            kind === 'options-multi'
              ? 'Select at least one option.'
              : 'Select a comparison value.',
        },
      ];
    }
    if (kind === 'options-multi') {
      const selected = Array.isArray(value) ? value : [value];
      const allValid = selected.every((item) =>
        options.some((option) => String(option.value) === String(item)),
      );
      if (!allValid) {
        return [
          {
            ruleIndex,
            conditionIndex,
            field: 'comparison',
            message: 'One or more selected options are no longer valid.',
          },
        ];
      }
      return [];
    }
    const ok = options.some((option) =>
      isFixedOptionValueSelected(value, option.value),
    );
    if (!ok && kind === 'boolean') {
      const asString = String(value).trim().toLowerCase();
      if (asString === 'true' || asString === 'false') {
        return [];
      }
    }
    if (!ok) {
      return [
        {
          ruleIndex,
          conditionIndex,
          field: 'comparison',
          message: 'Select a valid option for this answer.',
        },
      ];
    }
    return [];
  }

  if (isBlank(value)) {
    const label =
      kind === 'numeric'
        ? 'number'
        : kind === 'date'
          ? 'date'
          : kind === 'time'
            ? 'time'
            : 'value';
    return [
      {
        ruleIndex,
        conditionIndex,
        field: 'comparison',
        message: `Enter a ${label}.`,
      },
    ];
  }

  return [];
}

function validateConditionComparison(
  condition: LogicConditionItem,
  conditionIndex: number,
  ruleIndex: number,
  ctx: LogicRuleValidationContext,
): LogicRuleValidationIssue[] {
  if (!operatorNeedsComparisonValue(condition.operator)) {
    return [];
  }

  const sourceField = fieldById(ctx.schema, condition.fieldId);
  const type: LogicComparisonType = condition.comparison?.type || 'fixed';

  if (type === 'fixed') {
    return validateFixedComparisonValue(
      sourceField,
      condition.comparison?.value,
      conditionIndex,
      ruleIndex,
    );
  }

  if (type === 'field') {
    const compareId = String(condition.comparison?.fieldId ?? '').trim();
    if (!compareId) {
      return [
        {
          ruleIndex,
          conditionIndex,
          field: 'comparison',
          message: 'Select another answer to compare against.',
        },
      ];
    }
    const compareField = fieldById(ctx.schema, compareId);
    if (!compareField) {
      return [
        {
          ruleIndex,
          conditionIndex,
          field: 'comparison',
          message: 'The selected comparison answer no longer exists.',
        },
      ];
    }
    const compatible = getCompatibleCompareFields(
      ctx.schema,
      sourceField,
      condition.fieldId,
    );
    if (!compatible.some((item) => item.id === compareId)) {
      return [
        {
          ruleIndex,
          conditionIndex,
          field: 'comparison',
          message: 'The selected comparison answer is not compatible.',
        },
      ];
    }
    return [];
  }

  if (type === 'relatedData') {
    const sourceFieldId = String(condition.comparison?.sourceFieldId ?? '').trim();
    const property = String(condition.comparison?.property ?? '').trim();
    if (!sourceFieldId || !property) {
      return [
        {
          ruleIndex,
          conditionIndex,
          field: 'comparison',
          message: 'Select a related item and detail.',
        },
      ];
    }
    if (!fieldById(ctx.schema, sourceFieldId)) {
      return [
        {
          ruleIndex,
          conditionIndex,
          field: 'comparison',
          message: 'The selected related item no longer exists.',
        },
      ];
    }
    const columns = ctx.resolveRelatedColumns(sourceFieldId);
    const records = ctx.resolveRelatedRecords(sourceFieldId);
    if (columns.length) {
      const compatible = filterRelatedPropertiesForLogicField(
        columns,
        records,
        sourceField,
      );
      if (!compatible.some((column) => column.id === property)) {
        return [
          {
            ruleIndex,
            conditionIndex,
            field: 'comparison',
            message: 'The selected related detail is not compatible.',
          },
        ];
      }
    }
    return [];
  }

  return [
    {
      ruleIndex,
      conditionIndex,
      field: 'comparison',
      message: 'Complete the comparison for this condition.',
    },
  ];
}

export function validateLogicCondition(
  condition: LogicConditionItem,
  conditionIndex: number,
  ruleIndex: number,
  ctx: LogicRuleValidationContext,
): LogicRuleValidationIssue[] {
  const issues: LogicRuleValidationIssue[] = [];
  const fieldId = String(condition.fieldId ?? '').trim();

  if (!fieldId) {
    issues.push({
      ruleIndex,
      conditionIndex,
      field: 'condition',
      message: 'Select an answer for this condition.',
    });
    return issues;
  }

  const field = fieldById(ctx.schema, fieldId);
  if (!field) {
    issues.push({
      ruleIndex,
      conditionIndex,
      field: 'condition',
      message: 'The selected answer no longer exists.',
    });
    return issues;
  }

  const allowed = getOperatorsForFieldType(field);
  if (!allowed.includes(condition.operator)) {
    issues.push({
      ruleIndex,
      conditionIndex,
      field: 'condition',
      message: 'Choose an operator that is valid for this answer type.',
    });
  }

  issues.push(
    ...validateConditionComparison(condition, conditionIndex, ruleIndex, ctx),
  );
  return issues;
}

/**
 * Completeness validation for one automation rule.
 * OFF rules skip completeness when requireComplete is false.
 */
export function validateLogicRule(
  rule: FormLogicRule,
  ruleIndex: number,
  ctx: LogicRuleValidationContext,
  options?: { requireComplete?: boolean },
): LogicRuleValidationIssue[] {
  const requireComplete = options?.requireComplete ?? rule.enabled !== false;
  if (!requireComplete) {
    return [];
  }

  const issues: LogicRuleValidationIssue[] = [];
  const items = rule.conditions?.items ?? [];

  if (!items.length) {
    issues.push({
      ruleIndex,
      field: 'condition',
      message: 'Add at least one condition.',
    });
  } else {
    items.forEach((item, index) => {
      issues.push(...validateLogicCondition(item, index, ruleIndex, ctx));
    });
  }

  if (!rule.actions?.length) {
    issues.push({
      ruleIndex,
      field: 'action',
      message: 'Select at least one action.',
    });
  }

  return issues;
}

/** Duplicate names across a form (trim + case-insensitive). */
export function validateLogicRuleNames(
  rules: FormLogicRule[],
): LogicRuleValidationIssue[] {
  const issues: LogicRuleValidationIssue[] = [];
  const seen = new Map<string, number>();

  rules.forEach((rule, index) => {
    const key = normalizeNameKey(rule.name);
    if (!key) {
      return;
    }
    const first = seen.get(key);
    if (first !== undefined) {
      issues.push({
        ruleIndex: index,
        field: 'name',
        message: 'Automation names must be unique.',
      });
      if (
        !issues.some(
          (issue) => issue.ruleIndex === first && issue.field === 'name',
        )
      ) {
        issues.push({
          ruleIndex: first,
          field: 'name',
          message: 'Automation names must be unique.',
        });
      }
    } else {
      seen.set(key, index);
    }
  });

  return issues;
}

/**
 * Validate a list of automations.
 * Enabled rules require completeness; disabled may remain incomplete drafts.
 */
export function validateLogicRules(
  rules: FormLogicRule[],
  ctx: LogicRuleValidationContext,
): LogicRuleValidationIssue[] {
  const issues = [...validateLogicRuleNames(rules)];
  rules.forEach((rule, index) => {
    issues.push(
      ...validateLogicRule(rule, index, ctx, {
        requireComplete: rule.enabled !== false,
      }),
    );
  });
  return issues;
}

export function firstLogicValidationIssue(
  issues: LogicRuleValidationIssue[],
): LogicRuleValidationIssue | null {
  if (!issues.length) {
    return null;
  }
  return [...issues].sort((a, b) => {
    if (a.ruleIndex !== b.ruleIndex) {
      return a.ruleIndex - b.ruleIndex;
    }
    return (a.conditionIndex ?? -1) - (b.conditionIndex ?? -1);
  })[0] ?? null;
}

/**
 * Reset incompatible operators / stale comparisons on a condition row.
 * Returns a new item when changes are needed.
 */
export function sanitizeLogicConditionOperators(
  condition: LogicConditionItem,
  schema: FormField[],
): LogicConditionItem {
  const field = fieldById(schema, condition.fieldId);
  if (!field) {
    return condition;
  }

  const allowed = getOperatorsForFieldType(field);
  let operator: ConditionOperator = condition.operator;
  let comparison = { ...condition.comparison };

  if (!allowed.includes(operator)) {
    operator = allowed[0] ?? 'equals';
    if (!operatorNeedsComparisonValue(operator)) {
      comparison = { type: 'fixed' };
    } else {
      comparison = { type: 'fixed', value: '' };
    }
    return { ...condition, operator, comparison };
  }

  if (!operatorNeedsComparisonValue(operator)) {
    if (comparison.value !== undefined || comparison.fieldId || comparison.property) {
      return {
        ...condition,
        comparison: { type: 'fixed' },
      };
    }
    return condition;
  }

  if (comparison.type === 'fixed') {
    const kind = getFixedComparisonControlKind(field);
    const options = getFixedComparisonOptions(field);
    if (
      (kind === 'options' || kind === 'options-multi' || kind === 'boolean') &&
      !isBlank(comparison.value)
    ) {
      const values = Array.isArray(comparison.value)
        ? comparison.value
        : [comparison.value];
      const valid = values.filter((item) =>
        options.some((option) => String(option.value) === String(item)),
      );
      if (valid.length !== values.length) {
        comparison = {
          ...comparison,
          value: kind === 'options-multi' ? valid : (valid[0] ?? ''),
        };
        return { ...condition, comparison };
      }
    }
  }

  if (comparison.type === 'field') {
    const compareId = String(comparison.fieldId ?? '').trim();
    if (compareId) {
      const compatible = getCompatibleCompareFields(
        schema,
        field,
        condition.fieldId,
      );
      if (!compatible.some((item) => item.id === compareId)) {
        return {
          ...condition,
          comparison: { ...comparison, fieldId: undefined },
        };
      }
    }
  }

  return condition;
}

export function sanitizeLogicRuleOperators(
  rule: FormLogicRule,
  schema: FormField[],
): FormLogicRule {
  const items = (rule.conditions?.items ?? []).map((item) =>
    sanitizeLogicConditionOperators(item, schema),
  );
  return {
    ...rule,
    conditions: {
      ...rule.conditions,
      items,
    },
  };
}
