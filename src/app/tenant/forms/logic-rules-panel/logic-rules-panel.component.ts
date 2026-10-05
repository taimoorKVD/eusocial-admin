import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormField } from '../../form-builder/models/form-field.model';
import {
  DynamicModuleOptionsService,
  ModuleColumnOption,
} from '../../form-builder/services/dynamic-module-options.service';
import { ConditionOperator } from '../../../shared/conditional-logic';
import {
  FormLogicRule,
  LogicActionType,
  LogicComparisonType,
  LogicConditionItem,
  LogicConditionMatch,
  LOGIC_ACTION_OPTIONS,
  LOGIC_COMPARISON_OPTIONS,
  LogicRuleAction,
} from '../logic-rules/logic-rule.models';
import {
  cloneLogicRule,
  createEmptyLogicAction,
  createEmptyLogicCondition,
  createEmptyLogicRule,
  getCompatibleCompareFields,
  getDynamicSourceEndpoint,
  getDynamicSourceFields,
  getLogicEligibleFields,
  getOperatorLabel,
  getOperatorsForFieldType,
  normalizeLogicRules,
  operatorNeedsComparisonValue,
  resolveLogicFieldKind,
  summarizeRuleCard,
} from '../logic-rules/logic-rule.utils';

@Component({
  selector: 'app-logic-rules-panel',
  standalone: false,
  templateUrl: './logic-rules-panel.component.html',
  styleUrl: './logic-rules-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogicRulesPanelComponent implements OnChanges {
  @Input() schema: FormField[] = [];
  @Input() rules: FormLogicRule[] = [];
  @Output() rulesChange = new EventEmitter<FormLogicRule[]>();

  readonly actionOptions = LOGIC_ACTION_OPTIONS;
  readonly comparisonOptions = LOGIC_COMPARISON_OPTIONS;

  localRules: FormLogicRule[] = [];
  editorOpen = false;
  editingRule: FormLogicRule | null = null;
  isNewRule = false;

  deleteModalOpen = false;
  pendingDeleteRule: FormLogicRule | null = null;

  relatedPropertyCache = new Map<string, ModuleColumnOption[]>();
  relatedPropertyLoading = new Set<string>();

  constructor(
    private readonly dynamicModuleOptions: DynamicModuleOptionsService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['rules']) {
      this.localRules = normalizeLogicRules(this.rules);
    }
    if (changes['rules'] || changes['schema']) {
      this.prefetchRelatedPropertiesForRules(this.localRules);
      if (this.editingRule) {
        this.prefetchRelatedPropertiesForRule(this.editingRule);
      }
    }
  }

  get eligibleFields(): FormField[] {
    return getLogicEligibleFields(this.schema || []);
  }

  get dynamicSourceFields(): FormField[] {
    return getDynamicSourceFields(this.schema || []);
  }

  get deleteModalMessage(): string {
    if (!this.pendingDeleteRule) {
      return 'Delete this logic rule?';
    }
    const name = this.pendingDeleteRule.name || 'Untitled Rule';
    return `Delete "${name}"? This cannot be undone.`;
  }

  trackByRuleId(_index: number, rule: FormLogicRule): string {
    return rule.id;
  }

  trackByConditionId(_index: number, item: LogicConditionItem): string {
    return item.id;
  }

  trackByActionId(_index: number, action: LogicRuleAction): string {
    return action.id;
  }

  ruleSummary(rule: FormLogicRule): { when: string; then: string } {
    return summarizeRuleCard(
      rule,
      this.schema || [],
      (sourceFieldId, property) =>
        this.resolveRelatedPropertyLabel(sourceFieldId, property),
    );
  }

  /** Resolve stored related-data property id → human column/field label. */
  resolveRelatedPropertyLabel(
    sourceFieldId: string | undefined,
    property: string | undefined,
  ): string | null {
    if (!sourceFieldId || !property) {
      return null;
    }
    const columns = this.relatedPropertyCache.get(sourceFieldId) ?? [];
    const match = columns.find((column) => column.id === property);
    const label = match?.label?.trim();
    return label || null;
  }

  openCreateEditor(): void {
    this.isNewRule = true;
    this.editingRule = createEmptyLogicRule('');
    this.editorOpen = true;
    this.prefetchRelatedPropertiesForRule(this.editingRule);
  }

  openEditEditor(rule: FormLogicRule): void {
    this.isNewRule = false;
    this.editingRule = cloneLogicRule(rule);
    this.editorOpen = true;
    this.prefetchRelatedPropertiesForRule(this.editingRule);
  }

  closeEditor(): void {
    this.editorOpen = false;
    this.editingRule = null;
    this.isNewRule = false;
  }

  toggleRuleEnabled(rule: FormLogicRule, enabled: boolean): void {
    const next = this.localRules.map((item) =>
      item.id === rule.id ? { ...item, enabled } : item,
    );
    this.emitRules(next);
  }

  requestDelete(rule: FormLogicRule): void {
    this.pendingDeleteRule = rule;
    this.deleteModalOpen = true;
  }

  confirmDelete(): void {
    if (!this.pendingDeleteRule) {
      this.deleteModalOpen = false;
      return;
    }
    const next = this.localRules.filter(
      (rule) => rule.id !== this.pendingDeleteRule!.id,
    );
    this.pendingDeleteRule = null;
    this.deleteModalOpen = false;
    this.emitRules(next);
  }

  closeDeleteModal(): void {
    this.deleteModalOpen = false;
    this.pendingDeleteRule = null;
  }

  saveEditor(): void {
    if (!this.editingRule) {
      return;
    }
    const name = this.editingRule.name?.trim() || 'Untitled Rule';
    const saved: FormLogicRule = {
      ...cloneLogicRule(this.editingRule),
      name,
    };

    const next = this.isNewRule
      ? [...this.localRules, saved]
      : this.localRules.map((rule) => (rule.id === saved.id ? saved : rule));

    this.emitRules(next);
    this.closeEditor();
  }

  setMatchMode(match: LogicConditionMatch): void {
    if (!this.editingRule) {
      return;
    }
    this.editingRule = {
      ...this.editingRule,
      conditions: { ...this.editingRule.conditions, match },
    };
  }

  addCondition(): void {
    if (!this.editingRule) {
      return;
    }
    this.editingRule = {
      ...this.editingRule,
      conditions: {
        ...this.editingRule.conditions,
        items: [
          ...this.editingRule.conditions.items,
          createEmptyLogicCondition(),
        ],
      },
    };
  }

  removeCondition(conditionId: string): void {
    if (!this.editingRule) {
      return;
    }
    const items = this.editingRule.conditions.items.filter(
      (item) => item.id !== conditionId,
    );
    this.editingRule = {
      ...this.editingRule,
      conditions: {
        ...this.editingRule.conditions,
        items: items.length ? items : [createEmptyLogicCondition()],
      },
    };
  }

  onConditionFieldChange(condition: LogicConditionItem, fieldId: string): void {
    if (!this.editingRule) {
      return;
    }
    const field = this.schema.find((item) => item.id === fieldId) ?? null;
    const operators = getOperatorsForFieldType(field);
    const operator = operators.includes(condition.operator)
      ? condition.operator
      : (operators[0] ?? 'equals');

    this.patchCondition(condition.id, {
      fieldId,
      operator,
      comparison: this.resetComparisonForOperator(
        condition.comparison,
        operator,
      ),
    });
  }

  onConditionOperatorChange(
    condition: LogicConditionItem,
    operator: ConditionOperator,
  ): void {
    this.patchCondition(condition.id, {
      operator,
      comparison: this.resetComparisonForOperator(
        condition.comparison,
        operator,
      ),
    });
  }

  onComparisonTypeChange(
    condition: LogicConditionItem,
    type: LogicComparisonType,
  ): void {
    const nextComparison = {
      type,
      value: type === 'fixed' ? (condition.comparison.value ?? '') : undefined,
      fieldId: type === 'field' ? condition.comparison.fieldId : undefined,
      sourceFieldId:
        type === 'relatedData'
          ? condition.comparison.sourceFieldId ||
            this.dynamicSourceFields[0]?.id
          : undefined,
      property:
        type === 'relatedData' ? condition.comparison.property : undefined,
    };

    this.patchCondition(condition.id, { comparison: nextComparison });

    if (type === 'relatedData' && nextComparison.sourceFieldId) {
      this.loadRelatedProperties(nextComparison.sourceFieldId);
    }
  }

  onFixedValueChange(condition: LogicConditionItem, value: string): void {
    this.patchCondition(condition.id, {
      comparison: { ...condition.comparison, type: 'fixed', value },
    });
  }

  onCompareFieldChange(condition: LogicConditionItem, fieldId: string): void {
    this.patchCondition(condition.id, {
      comparison: { ...condition.comparison, type: 'field', fieldId },
    });
  }

  onRelatedSourceChange(
    condition: LogicConditionItem,
    sourceFieldId: string,
  ): void {
    this.patchCondition(condition.id, {
      comparison: {
        ...condition.comparison,
        type: 'relatedData',
        sourceFieldId,
        property: undefined,
      },
    });
    this.loadRelatedProperties(sourceFieldId);
  }

  onRelatedPropertyChange(
    condition: LogicConditionItem,
    property: string,
  ): void {
    this.patchCondition(condition.id, {
      comparison: {
        ...condition.comparison,
        type: 'relatedData',
        property,
      },
    });
  }

  addAction(): void {
    if (!this.editingRule) {
      return;
    }
    this.editingRule = {
      ...this.editingRule,
      actions: [...this.editingRule.actions, createEmptyLogicAction()],
    };
  }

  removeAction(actionId: string): void {
    if (!this.editingRule) {
      return;
    }
    const actions = this.editingRule.actions.filter(
      (action) => action.id !== actionId,
    );
    this.editingRule = {
      ...this.editingRule,
      actions: actions.length ? actions : [createEmptyLogicAction()],
    };
  }

  onActionTypeChange(action: LogicRuleAction, type: LogicActionType): void {
    if (!this.editingRule) {
      return;
    }
    this.editingRule = {
      ...this.editingRule,
      actions: this.editingRule.actions.map((item) =>
        item.id === action.id ? { ...item, type } : item,
      ),
    };
  }

  operatorsFor(condition: LogicConditionItem): ConditionOperator[] {
    const field = this.schema.find((item) => item.id === condition.fieldId);
    return getOperatorsForFieldType(field);
  }

  operatorLabel(
    operator: ConditionOperator,
    condition: LogicConditionItem,
  ): string {
    const field = this.schema.find((item) => item.id === condition.fieldId);
    return getOperatorLabel(operator, field);
  }

  compatibleFieldsFor(condition: LogicConditionItem): FormField[] {
    const field = this.schema.find((item) => item.id === condition.fieldId);
    return getCompatibleCompareFields(this.schema, field, condition.fieldId);
  }

  needsValue(condition: LogicConditionItem): boolean {
    return operatorNeedsComparisonValue(condition.operator);
  }

  fixedValueInputType(condition: LogicConditionItem): string {
    const field = this.schema.find((item) => item.id === condition.fieldId);
    const kind = resolveLogicFieldKind(field);
    if (kind === 'numeric') {
      return 'number';
    }
    if (kind === 'date') {
      return 'date';
    }
    if (kind === 'time') {
      return 'time';
    }
    return 'text';
  }

  relatedPropertiesFor(sourceFieldId: string | undefined): ModuleColumnOption[] {
    if (!sourceFieldId) {
      return [];
    }
    return this.relatedPropertyCache.get(sourceFieldId) ?? [];
  }

  isRelatedPropertiesLoading(sourceFieldId: string | undefined): boolean {
    return !!sourceFieldId && this.relatedPropertyLoading.has(sourceFieldId);
  }

  hasRelatedDataSources(): boolean {
    return this.dynamicSourceFields.length > 0;
  }

  comparisonOptionsFor(
    _condition: LogicConditionItem,
  ): typeof LOGIC_COMPARISON_OPTIONS {
    if (this.hasRelatedDataSources()) {
      return LOGIC_COMPARISON_OPTIONS;
    }
    return LOGIC_COMPARISON_OPTIONS.filter(
      (option) => option.value !== 'relatedData',
    );
  }

  private patchCondition(
    conditionId: string,
    patch: Partial<LogicConditionItem>,
  ): void {
    if (!this.editingRule) {
      return;
    }
    this.editingRule = {
      ...this.editingRule,
      conditions: {
        ...this.editingRule.conditions,
        items: this.editingRule.conditions.items.map((item) =>
          item.id === conditionId ? { ...item, ...patch } : item,
        ),
      },
    };
  }

  private resetComparisonForOperator(
    comparison: LogicConditionItem['comparison'],
    operator: ConditionOperator,
  ): LogicConditionItem['comparison'] {
    if (!operatorNeedsComparisonValue(operator)) {
      return { type: 'fixed' };
    }
    return {
      type: comparison.type || 'fixed',
      value: comparison.type === 'fixed' ? (comparison.value ?? '') : undefined,
      fieldId: comparison.type === 'field' ? comparison.fieldId : undefined,
      sourceFieldId:
        comparison.type === 'relatedData'
          ? comparison.sourceFieldId
          : undefined,
      property:
        comparison.type === 'relatedData' ? comparison.property : undefined,
    };
  }

  private emitRules(next: FormLogicRule[]): void {
    this.localRules = next;
    this.rulesChange.emit(next);
    this.cdr.markForCheck();
  }

  private prefetchRelatedPropertiesForRules(rules: FormLogicRule[]): void {
    for (const rule of rules) {
      this.prefetchRelatedPropertiesForRule(rule);
    }
  }

  private prefetchRelatedPropertiesForRule(rule: FormLogicRule): void {
    for (const item of rule.conditions.items) {
      if (
        item.comparison.type === 'relatedData' &&
        item.comparison.sourceFieldId
      ) {
        this.loadRelatedProperties(item.comparison.sourceFieldId);
      }
    }
  }

  private loadRelatedProperties(sourceFieldId: string): void {
    if (!sourceFieldId) {
      return;
    }
    if (
      this.relatedPropertyCache.has(sourceFieldId) ||
      this.relatedPropertyLoading.has(sourceFieldId)
    ) {
      return;
    }

    const field = this.schema.find((item) => item.id === sourceFieldId);
    if (!field) {
      return;
    }

    const endpoint = getDynamicSourceEndpoint(field);
    if (!endpoint) {
      this.relatedPropertyCache.set(sourceFieldId, []);
      return;
    }

    this.relatedPropertyLoading.add(sourceFieldId);
    this.dynamicModuleOptions.getModuleData(endpoint).subscribe({
      next: (data) => {
        this.relatedPropertyLoading.delete(sourceFieldId);
        this.relatedPropertyCache.set(sourceFieldId, data.columns || []);
        this.cdr.markForCheck();
      },
      error: () => {
        this.relatedPropertyLoading.delete(sourceFieldId);
        this.relatedPropertyCache.set(sourceFieldId, []);
        this.cdr.markForCheck();
      },
    });
  }
}
