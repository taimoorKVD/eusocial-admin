import {
  ConditionOperator,
  FieldConditionalLogic,
  ValueSource,
} from './conditional-logic.types';
import {
  getPrimaryPredicate,
  hasConfiguredSource,
} from './conditional-logic.normalize';
import { operatorRequiresValue } from './conditional-logic.evaluate';
import {
  getPrimarySetValueSource,
  hasSetValueAction,
  isCompatibleSetValueSourceField,
  resolveSetValueFieldKind,
  supportsSetValueFieldType,
} from './conditional-logic.set-value';

export type ConditionRuleValidationField =
  | 'source'
  | 'operator'
  | 'value'
  | 'setValue'
  | 'name'
  | 'general';

export interface ConditionRuleValidationIssue {
  ruleIndex: number;
  field: ConditionRuleValidationField;
  message: string;
}

export interface ConditionRuleValidationContext {
  /** Field that owns the conditional logic (THEN target). */
  targetField: { id: string; type?: string; rangeType?: string } | null | undefined;
  /** All form fields available as WHEN / setValue sources. */
  schema: ReadonlyArray<{
    id: string;
    type?: string;
    rangeType?: string;
    label?: string;
    options?: ReadonlyArray<string | number | { label?: string; value?: unknown }>;
  }>;
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

function normalizeRuleNameKey(name: string | undefined | null): string {
  return String(name ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/** Emptiness operators available for every supported WHEN source field type. */
const UNIVERSAL_EMPTINESS_OPERATORS: readonly ConditionOperator[] = [
  'isEmpty',
  'isNotEmpty',
];

function withUniversalEmptinessOperators(
  operators: readonly ConditionOperator[],
): ConditionOperator[] {
  const typeSpecific = operators.filter(
    (operator): operator is ConditionOperator =>
      operator !== 'isEmpty' && operator !== 'isNotEmpty',
  );
  return [...typeSpecific, ...UNIVERSAL_EMPTINESS_OPERATORS];
}

/**
 * Operators allowed for a WHEN source field type.
 * Type-specific operators stay restricted; `isEmpty` / `isNotEmpty` are universal.
 */
export function getOperatorsForConditionSourceField(
  field: { type?: string; rangeType?: string } | null | undefined
): ConditionOperator[] {
  const kind = resolveSetValueFieldKind(field);
  switch (kind) {
    case 'numeric':
      return withUniversalEmptinessOperators([
        'equals',
        'notEquals',
        'greaterThan',
        'greaterThanOrEqual',
        'lessThan',
        'lessThanOrEqual',
      ]);
    case 'boolean':
      return withUniversalEmptinessOperators([
        'checked',
        'unchecked',
        'equals',
        'notEquals',
      ]);
    case 'select':
      return withUniversalEmptinessOperators(['equals', 'notEquals']);
    case 'date':
    case 'time':
      return withUniversalEmptinessOperators([
        'equals',
        'notEquals',
        'greaterThan',
        'lessThan',
      ]);
    case 'text':
    default:
      // text/email/textarea + other supported types (image, file, signature, …)
      return withUniversalEmptinessOperators([
        'equals',
        'notEquals',
        'contains',
        'notContains',
        'startsWith',
        'endsWith',
      ]);
  }
}

function fieldOptions(
  field: ConditionRuleValidationContext['schema'][number] | null | undefined
): Array<{ value: unknown }> {
  if (!field?.options?.length) {
    return [];
  }
  return field.options
    .map((option) => {
      if (option !== null && typeof option === 'object') {
        return { value: (option as { value?: unknown }).value };
      }
      return { value: option };
    })
    .filter((option) => option.value !== undefined && option.value !== null);
}

function isValueAllowedForSourceField(
  field: ConditionRuleValidationContext['schema'][number] | null | undefined,
  value: unknown
): boolean {
  const options = fieldOptions(field);
  if (!options.length) {
    return !isBlank(value);
  }
  if (Array.isArray(value)) {
    if (!value.length) {
      return false;
    }
    return value.every((item) =>
      options.some((option) => String(option.value) === String(item))
    );
  }
  return options.some((option) => String(option.value) === String(value));
}

function validateValueSource(
  source: ValueSource | null | undefined,
  ctx: ConditionRuleValidationContext,
  ruleIndex: number
): ConditionRuleValidationIssue[] {
  if (!source) {
    return [
      {
        ruleIndex,
        field: 'setValue',
        message: 'Choose a valid value source for Set its value.',
      },
    ];
  }

  switch (source.kind) {
    case 'fixed':
      if (isBlank(source.value)) {
        return [
          {
            ruleIndex,
            field: 'setValue',
            message: 'Enter a fixed value for Set its value.',
          },
        ];
      }
      return [];
    case 'field': {
      const fieldId = String(source.fieldId ?? '').trim();
      if (!fieldId) {
        return [
          {
            ruleIndex,
            field: 'setValue',
            message: 'Select a form field for Set its value.',
          },
        ];
      }
      const sourceField = ctx.schema.find((item) => item.id === fieldId);
      if (!sourceField) {
        return [
          {
            ruleIndex,
            field: 'setValue',
            message: 'The selected Set its value field no longer exists.',
          },
        ];
      }
      if (
        ctx.targetField &&
        !isCompatibleSetValueSourceField(ctx.targetField, sourceField)
      ) {
        return [
          {
            ruleIndex,
            field: 'setValue',
            message: 'The selected field is not compatible with this field type.',
          },
        ];
      }
      return [];
    }
    case 'relatedData': {
      const sourceFieldId = String(source.sourceFieldId ?? '').trim();
      const property = String(source.property ?? '').trim();
      if (!sourceFieldId || !property) {
        return [
          {
            ruleIndex,
            field: 'setValue',
            message: 'Select a related source and property for Set its value.',
          },
        ];
      }
      if (!ctx.schema.some((item) => item.id === sourceFieldId)) {
        return [
          {
            ruleIndex,
            field: 'setValue',
            message: 'The selected related source field no longer exists.',
          },
        ];
      }
      return [];
    }
    case 'expression': {
      const leftIssues = validateValueSource(source.left, ctx, ruleIndex).map(
        (issue) => ({
          ...issue,
          message: issue.message.replace(
            'Set its value',
            'the left side of the calculation'
          ),
        })
      );
      const rightIssues = validateValueSource(source.right, ctx, ruleIndex).map(
        (issue) => ({
          ...issue,
          message: issue.message.replace(
            'Set its value',
            'the right side of the calculation'
          ),
        })
      );
      return [...leftIssues, ...rightIssues];
    }
    default:
      return [
        {
          ruleIndex,
          field: 'setValue',
          message: 'Choose a valid value source for Set its value.',
        },
      ];
  }
}

/**
 * Completeness validation for a single rule.
 * Pass `requireComplete: false` for OFF draft rules (structure only / names).
 */
export function validateConditionRule(
  rule: FieldConditionalLogic,
  ruleIndex: number,
  ctx: ConditionRuleValidationContext,
  options?: { requireComplete?: boolean }
): ConditionRuleValidationIssue[] {
  const requireComplete = options?.requireComplete ?? rule.enabled !== false;
  if (!requireComplete) {
    return [];
  }

  const issues: ConditionRuleValidationIssue[] = [];
  const predicate = getPrimaryPredicate(rule);
  const sourceId = String(predicate.fieldId ?? '').trim();

  if (!sourceId) {
    issues.push({
      ruleIndex,
      field: 'source',
      message: 'Select a field to watch.',
    });
    return issues;
  }

  const sourceField = ctx.schema.find((item) => item.id === sourceId) ?? null;
  if (!sourceField) {
    issues.push({
      ruleIndex,
      field: 'source',
      message: 'The selected source field no longer exists.',
    });
    return issues;
  }

  const allowedOperators = getOperatorsForConditionSourceField(sourceField);
  const operator = predicate.operator;
  if (!allowedOperators.includes(operator)) {
    issues.push({
      ruleIndex,
      field: 'operator',
      message: 'Choose an operator that is valid for this field type.',
    });
  }

  if (operatorRequiresValue(operator)) {
    if (isBlank(predicate.value)) {
      issues.push({
        ruleIndex,
        field: 'value',
        message: 'Enter a comparison value.',
      });
    } else if (!isValueAllowedForSourceField(sourceField, predicate.value)) {
      issues.push({
        ruleIndex,
        field: 'value',
        message: 'Choose a valid comparison value for this field.',
      });
    }
  }

  if (!rule.actions?.length) {
    issues.push({
      ruleIndex,
      field: 'general',
      message: 'Select at least one action.',
    });
  }

  if (hasSetValueAction(rule)) {
    if (!supportsSetValueFieldType(ctx.targetField?.type)) {
      issues.push({
        ruleIndex,
        field: 'setValue',
        message: 'Set its value is not available for this field type.',
      });
    } else {
      issues.push(
        ...validateValueSource(getPrimarySetValueSource(rule), ctx, ruleIndex)
      );
    }
  }

  return issues;
}

/** Duplicate names (trim + case-insensitive) across all rules. */
export function validateConditionRuleNames(
  rules: FieldConditionalLogic[]
): ConditionRuleValidationIssue[] {
  const issues: ConditionRuleValidationIssue[] = [];
  const seen = new Map<string, number>();

  rules.forEach((rule, index) => {
    const key = normalizeRuleNameKey(rule.name);
    if (!key) {
      return;
    }
    const firstIndex = seen.get(key);
    if (firstIndex !== undefined) {
      issues.push({
        ruleIndex: index,
        field: 'name',
        message: 'Rule names must be unique.',
      });
      if (
        !issues.some(
          (issue) => issue.ruleIndex === firstIndex && issue.field === 'name'
        )
      ) {
        issues.push({
          ruleIndex: firstIndex,
          field: 'name',
          message: 'Rule names must be unique.',
        });
      }
    } else {
      seen.set(key, index);
    }
  });

  return issues;
}

/**
 * Validate a Conditional Logic draft:
 * - All rules: unique names
 * - Enabled rules: full completeness
 * - Disabled rules: allowed as incomplete drafts
 */
export function validateConditionRules(
  rules: FieldConditionalLogic[],
  ctx: ConditionRuleValidationContext
): ConditionRuleValidationIssue[] {
  const issues = [...validateConditionRuleNames(rules)];

  rules.forEach((rule, index) => {
    issues.push(
      ...validateConditionRule(rule, index, ctx, {
        requireComplete: rule.enabled !== false,
      })
    );
  });

  return issues;
}

export function firstConditionValidationIssue(
  issues: ConditionRuleValidationIssue[]
): ConditionRuleValidationIssue | null {
  if (!issues.length) {
    return null;
  }
  return [...issues].sort((a, b) => a.ruleIndex - b.ruleIndex)[0] ?? null;
}

/** True when an enabled rule has enough config to be considered active logic. */
export function isConditionRuleActivelyConfigured(
  rule: FieldConditionalLogic | null | undefined
): boolean {
  return !!rule && rule.enabled !== false && hasConfiguredSource(rule);
}
