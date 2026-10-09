import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormField } from '../../form-builder/models/form-field.model';
import {
  DynamicModuleOptionsService,
  ModuleColumnOption,
} from '../../form-builder/services/dynamic-module-options.service';
import { DropdownOverlayService } from '../../../shared/directives/dropdown-panel/dropdown-overlay.service';
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
  filterRelatedPropertiesForLogicField,
  fixedOptionLabelForValue,
  getCompatibleCompareFields,
  getDynamicSourceEndpoint,
  getDynamicSourceFields,
  getFixedComparisonControlKind,
  getFixedComparisonOptions,
  getLogicEligibleFields,
  getOperatorLabel,
  getOperatorsForFieldType,
  isFixedOptionValueSelected,
  LogicFixedComparisonControlKind,
  LogicFixedValueOption,
  normalizeLogicRules,
  operatorNeedsComparisonValue,
  summarizeRuleCard,
} from '../logic-rules/logic-rule.utils';

@Component({
  selector: 'app-logic-rules-panel',
  standalone: false,
  templateUrl: './logic-rules-panel.component.html',
  styleUrl: './logic-rules-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogicRulesPanelComponent implements OnChanges, OnDestroy {
  @Input() schema: FormField[] = [];
  @Input() rules: FormLogicRule[] = [];
  @Output() rulesChange = new EventEmitter<FormLogicRule[]>();

  readonly actionOptions = LOGIC_ACTION_OPTIONS;
  readonly comparisonOptions = LOGIC_COMPARISON_OPTIONS;

  /** Friendlier labels for the builder UI only (values unchanged). */
  readonly friendlyActionOptions: ReadonlyArray<{
    value: LogicActionType;
    label: string;
  }> = [
    { value: 'purchaseRequest', label: 'Create a Purchase Request' },
    { value: 'sendNotification', label: 'Send a Notification' },
    { value: 'maintenanceRequest', label: 'Create a Maintenance Request' },
  ];

  readonly friendlyComparisonOptions: ReadonlyArray<{
    value: LogicComparisonType;
    label: string;
  }> = [
    { value: 'fixed', label: 'a specific value' },
    { value: 'field', label: 'another answer on this form' },
    { value: 'relatedData', label: 'a detail from a related item' },
  ];

  localRules: FormLogicRule[] = [];
  editorOpen = false;
  editingRule: FormLogicRule | null = null;
  isNewRule = false;

  /** UI-only state driving the drawer leave animation before unmount. */
  editorClosing = false;
  private editorCloseTimer: ReturnType<typeof setTimeout> | null = null;

  deleteModalOpen = false;
  pendingDeleteRule: FormLogicRule | null = null;

  relatedPropertyCache = new Map<string, ModuleColumnOption[]>();
  relatedRecordsCache = new Map<string, Record<string, unknown>[]>();
  relatedPropertyLoading = new Set<string>();
  readonly dropdownGroup = 'logic-rules-panel';

  readonly booleanFixedOptions: ReadonlyArray<LogicFixedValueOption> = [
    { label: 'True', value: 'true' },
    { label: 'False', value: 'false' },
  ];

  constructor(
    private readonly dynamicModuleOptions: DynamicModuleOptionsService,
    private readonly overlayService: DropdownOverlayService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnDestroy(): void {
    this.clearEditorCloseTimer();
  }

  private clearEditorCloseTimer(): void {
    if (this.editorCloseTimer) {
      clearTimeout(this.editorCloseTimer);
      this.editorCloseTimer = null;
    }
  }

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
    this.clearEditorCloseTimer();
    this.editorClosing = false;
    this.isNewRule = true;
    this.editingRule = createEmptyLogicRule('');
    this.editorOpen = true;
    this.prefetchRelatedPropertiesForRule(this.editingRule);
  }

  openEditEditor(rule: FormLogicRule): void {
    this.clearEditorCloseTimer();
    this.editorClosing = false;
    this.isNewRule = false;
    this.editingRule = cloneLogicRule(rule);
    this.editorOpen = true;
    this.prefetchRelatedPropertiesForRule(this.editingRule);
  }

  closeEditor(): void {
    this.overlayService.close();
    if (!this.editorOpen || this.editorClosing) {
      return;
    }
    // Play the leave animation first, then unmount. Rule data is untouched.
    this.editorClosing = true;
    this.cdr.markForCheck();
    this.clearEditorCloseTimer();
    this.editorCloseTimer = setTimeout(() => {
      this.editorCloseTimer = null;
      this.editorClosing = false;
      this.editorOpen = false;
      this.editingRule = null;
      this.isNewRule = false;
      this.cdr.markForCheck();
    }, 220);
  }

  fieldLabelById(fieldId: string | undefined | null): string {
    if (!fieldId) {
      return '';
    }
    return this.schema.find((item) => item.id === fieldId)?.label?.trim() || '';
  }

  comparisonTypeLabel(type: LogicComparisonType | undefined): string {
    if (!type) {
      return '';
    }
    return (
      LOGIC_COMPARISON_OPTIONS.find((option) => option.value === type)?.label || ''
    );
  }

  friendlyComparisonTypeLabel(type: LogicComparisonType | undefined): string {
    if (!type) {
      return '';
    }
    return (
      this.friendlyComparisonOptions.find((option) => option.value === type)
        ?.label || this.comparisonTypeLabel(type)
    );
  }

  actionTypeLabel(type: LogicActionType | undefined): string {
    return this.actionOptions.find((option) => option.value === type)?.label || '';
  }

  friendlyActionTypeLabel(type: LogicActionType | undefined): string {
    return (
      this.friendlyActionOptions.find((option) => option.value === type)?.label ||
      this.actionTypeLabel(type)
    );
  }

  relatedPropertyLabelFor(
    sourceFieldId: string | undefined,
    property: string | undefined,
  ): string {
    if (!property) {
      return '';
    }
    return this.resolveRelatedPropertyLabel(sourceFieldId, property) || property;
  }

  selectConditionField(condition: LogicConditionItem, fieldId: string): void {
    this.onConditionFieldChange(condition, fieldId);
    this.overlayService.close();
  }

  selectConditionOperator(
    condition: LogicConditionItem,
    operator: ConditionOperator,
  ): void {
    this.onConditionOperatorChange(condition, operator);
    this.overlayService.close();
  }

  selectComparisonType(
    condition: LogicConditionItem,
    type: LogicComparisonType,
  ): void {
    this.onComparisonTypeChange(condition, type);
    this.overlayService.close();
  }

  selectCompareField(condition: LogicConditionItem, fieldId: string): void {
    this.onCompareFieldChange(condition, fieldId);
    this.overlayService.close();
  }

  selectRelatedSource(condition: LogicConditionItem, sourceFieldId: string): void {
    this.onRelatedSourceChange(condition, sourceFieldId);
    this.overlayService.close();
  }

  selectRelatedProperty(condition: LogicConditionItem, property: string): void {
    this.onRelatedPropertyChange(condition, property);
    this.overlayService.close();
  }

  selectActionType(action: LogicRuleAction, type: LogicActionType): void {
    this.onActionTypeChange(action, type);
    this.overlayService.close();
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

    // Field type drives comparison UI — always reset incompatible prior value/config.
    this.patchCondition(condition.id, {
      fieldId,
      operator,
      comparison: this.createComparisonForOperator(operator),
    });
  }

  onConditionOperatorChange(
    condition: LogicConditionItem,
    operator: ConditionOperator,
  ): void {
    const next = this.resetComparisonForOperator(
      condition.comparison,
      operator,
    );
    // Operator change may switch between single vs multi option semantics —
    // normalize fixed values that no longer fit the control.
    if (next.type === 'fixed' && operatorNeedsComparisonValue(operator)) {
      next.value = this.normalizeFixedValueForField(
        condition.fieldId,
        next.value,
        operator,
      );
    }
    this.patchCondition(condition.id, {
      operator,
      comparison: next,
    });
  }

  onComparisonTypeChange(
    condition: LogicConditionItem,
    type: LogicComparisonType,
  ): void {
    let fieldId =
      type === 'field' ? condition.comparison.fieldId : undefined;
    if (type === 'field' && fieldId) {
      const compatibleIds = new Set(
        this.compatibleFieldsFor(condition).map((field) => field.id),
      );
      if (!compatibleIds.has(fieldId)) {
        fieldId = undefined;
      }
    }

    let fixedValue: unknown =
      type === 'fixed' ? (condition.comparison.value ?? '') : undefined;
    if (type === 'fixed') {
      fixedValue = this.normalizeFixedValueForField(
        condition.fieldId,
        fixedValue,
        condition.operator,
      );
    }

    const nextComparison = {
      type,
      value: fixedValue,
      fieldId,
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

  onFixedValueChange(condition: LogicConditionItem, value: unknown): void {
    this.patchCondition(condition.id, {
      comparison: { ...condition.comparison, type: 'fixed', value },
    });
  }

  selectFixedOption(
    condition: LogicConditionItem,
    value: string | number | '',
  ): void {
    this.onFixedValueChange(condition, value === '' ? '' : value);
    this.overlayService.close();
  }

  toggleFixedMultiOption(
    condition: LogicConditionItem,
    optionValue: string | number,
    checked: boolean,
  ): void {
    const current = Array.isArray(condition.comparison.value)
      ? [...condition.comparison.value]
      : condition.comparison.value != null &&
          condition.comparison.value !== ''
        ? [condition.comparison.value]
        : [];

    const next = checked
      ? current.some((item) => String(item) === String(optionValue))
        ? current
        : [...current, optionValue]
      : current.filter((item) => String(item) !== String(optionValue));

    this.onFixedValueChange(condition, next);
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

  conditionField(condition: LogicConditionItem): FormField | null {
    if (!condition.fieldId) {
      return null;
    }
    return this.schema.find((item) => item.id === condition.fieldId) ?? null;
  }

  fixedComparisonControlKind(
    condition: LogicConditionItem,
  ): LogicFixedComparisonControlKind {
    return getFixedComparisonControlKind(this.conditionField(condition));
  }

  fixedValueOptions(condition: LogicConditionItem): LogicFixedValueOption[] {
    const kind = this.fixedComparisonControlKind(condition);
    if (kind === 'boolean') {
      return [...this.booleanFixedOptions];
    }
    return getFixedComparisonOptions(this.conditionField(condition));
  }

  fixedValueLabel(condition: LogicConditionItem): string {
    const kind = this.fixedComparisonControlKind(condition);
    if (kind === 'boolean') {
      const stored = condition.comparison.value;
      if (stored === true || String(stored) === 'true') {
        return 'True';
      }
      if (stored === false || String(stored) === 'false') {
        return 'False';
      }
      return '';
    }
    return fixedOptionLabelForValue(
      this.conditionField(condition),
      condition.comparison.value,
    );
  }

  isFixedOptionSelected(
    condition: LogicConditionItem,
    optionValue: string | number,
  ): boolean {
    return isFixedOptionValueSelected(
      condition.comparison.value,
      optionValue,
    );
  }

  fixedValueInputType(condition: LogicConditionItem): string {
    const kind = this.fixedComparisonControlKind(condition);
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

  relatedPropertiesFor(
    sourceFieldId: string | undefined,
    condition?: LogicConditionItem,
  ): ModuleColumnOption[] {
    if (!sourceFieldId) {
      return [];
    }
    const columns = this.relatedPropertyCache.get(sourceFieldId) ?? [];
    const records = this.relatedRecordsCache.get(sourceFieldId) ?? [];
    const targetField = condition
      ? this.conditionField(condition)
      : null;
    const filtered = filterRelatedPropertiesForLogicField(
      columns,
      records,
      targetField,
    );

    // Keep a previously saved property visible while editing, even if samples
    // have not loaded yet or inference excluded it.
    const selected = condition?.comparison.property?.trim();
    if (
      selected &&
      !filtered.some((column) => column.id === selected)
    ) {
      const fromAll = columns.find((column) => column.id === selected);
      if (fromAll) {
        return [fromAll, ...filtered];
      }
    }

    return filtered;
  }

  isRelatedPropertiesLoading(sourceFieldId: string | undefined): boolean {
    return !!sourceFieldId && this.relatedPropertyLoading.has(sourceFieldId);
  }

  hasRelatedDataSources(): boolean {
    return this.dynamicSourceFields.length > 0;
  }

  comparisonOptionsFor(
    _condition: LogicConditionItem,
  ): ReadonlyArray<{ value: LogicComparisonType; label: string }> {
    if (this.hasRelatedDataSources()) {
      return this.friendlyComparisonOptions;
    }
    return this.friendlyComparisonOptions.filter(
      (option) => option.value !== 'relatedData',
    );
  }

  private createComparisonForOperator(
    operator: ConditionOperator,
  ): LogicConditionItem['comparison'] {
    if (!operatorNeedsComparisonValue(operator)) {
      return { type: 'fixed' };
    }
    return { type: 'fixed', value: '' };
  }

  private normalizeFixedValueForField(
    fieldId: string,
    value: unknown,
    operator: ConditionOperator,
  ): unknown {
    const field = this.schema.find((item) => item.id === fieldId) ?? null;
    const control = getFixedComparisonControlKind(field);

    if (control === 'options-multi') {
      if (Array.isArray(value)) {
        return value;
      }
      if (value === null || value === undefined || value === '') {
        return [];
      }
      return [value];
    }

    if (control === 'options' || control === 'boolean') {
      if (Array.isArray(value)) {
        return value.length ? value[0] : '';
      }
      return value ?? '';
    }

    if (Array.isArray(value)) {
      return value.length ? value[0] : '';
    }

    void operator;
    return value ?? '';
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
      this.relatedRecordsCache.set(sourceFieldId, []);
      return;
    }

    this.relatedPropertyLoading.add(sourceFieldId);
    this.dynamicModuleOptions.getModuleData(endpoint).subscribe({
      next: (data) => {
        this.relatedPropertyLoading.delete(sourceFieldId);
        this.relatedPropertyCache.set(sourceFieldId, data.columns || []);
        this.relatedRecordsCache.set(sourceFieldId, data.records || []);
        this.cdr.markForCheck();
      },
      error: () => {
        this.relatedPropertyLoading.delete(sourceFieldId);
        this.relatedPropertyCache.set(sourceFieldId, []);
        this.relatedRecordsCache.set(sourceFieldId, []);
        this.cdr.markForCheck();
      },
    });
  }
}
