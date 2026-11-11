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
import { ToastrService } from 'ngx-toastr';
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
  LogicConditionJoin,
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
  createLogicRuleId,
  filterRelatedPropertiesForLogicField,
  findLogicRulesUsingField,
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
  joinFromMatch,
  LogicFixedComparisonControlKind,
  LogicFixedValueOption,
  matchFromJoins,
  normalizeLogicRules,
  operatorNeedsComparisonValue,
  summarizeRuleCard,
} from '../logic-rules/logic-rule.utils';
import {
  firstLogicValidationIssue,
  LogicRuleValidationIssue,
  sanitizeLogicRuleOperators,
  validateLogicRule,
  validateLogicRuleNames,
  validateLogicRules,
} from '../logic-rules/logic-rule.validate';

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
  /**
   * When false, hide the panel list chrome. Editor modal stays available so
   * Form Template field shortcuts / overview can open rules without the tab UI.
   */
  @Input() showPanelList = true;
  @Output() rulesChange = new EventEmitter<FormLogicRule[]>();

  readonly actionOptions = LOGIC_ACTION_OPTIONS;
  readonly comparisonOptions = LOGIC_COMPARISON_OPTIONS;

  /** Friendlier labels for the builder UI only (values unchanged). */
  readonly friendlyActionOptions: ReadonlyArray<{
    value: LogicActionType;
    label: string;
    description: string;
  }> = [
    {
      value: 'purchaseRequest',
      label: 'Create purchase request',
      description: 'Sends a request to order an item.',
    },
    {
      value: 'sendNotification',
      label: 'Notify a job position',
      description: 'Sends an alert to everyone in a position.',
    },
    {
      value: 'maintenanceRequest',
      label: 'Create maintenance request',
      description: 'Creates a maintenance request for follow-up.',
    },
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

  /**
   * Field-scoped multi-automation session (Form Template canvas shortcut).
   * When set, the editor shows a Conditional Logic–style sidebar for all
   * automations that reference this field.
   */
  fieldScopeId: string | null = null;
  fieldScopedRules: FormLogicRule[] = [];
  activeFieldRuleIndex = 0;
  private originalFieldRuleIds = new Set<string>();

  fieldRuleMenuIndex: number | null = null;
  fieldRuleMenuStyle: Record<string, string> = {};
  addFieldAutomationModalOpen = false;
  addFieldAutomationNameDraft = '';
  renameFieldAutomationModalOpen = false;
  renameFieldAutomationIndex = -1;
  renameFieldAutomationNameDraft = '';

  /** UI-only state driving the drawer leave animation before unmount. */
  editorClosing = false;
  private editorCloseTimer: ReturnType<typeof setTimeout> | null = null;

  deleteModalOpen = false;
  pendingDeleteRule: FormLogicRule | null = null;

  /** Field-level validation issues for the open editor. */
  logicValidationIssues: LogicRuleValidationIssue[] = [];

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
    private readonly toastr: ToastrService,
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

  get isFieldScopedEditor(): boolean {
    return !!this.fieldScopeId;
  }

  get fieldScopedRuleCount(): number {
    return this.fieldScopedRules.length;
  }

  /**
   * @param seedFieldId Optional Form Template field shortcut: preselect this
   * field on the first IF condition so the modal opens ready to configure.
   */
  openCreateEditor(seedFieldId?: string): void {
    this.clearFieldScopeSession();
    this.clearEditorCloseTimer();
    this.editorClosing = false;
    this.isNewRule = true;
    this.editingRule = createEmptyLogicRule('');
    this.clearLogicValidation();
    this.editorOpen = true;

    const seed = (seedFieldId || '').trim();
    if (seed && this.editingRule.conditions.items[0]) {
      // Reuse the same handler as the field selector so operators/comparison
      // initialize for the selected field type before the UI renders.
      this.onConditionFieldChange(this.editingRule.conditions.items[0], seed);
    }

    this.prefetchRelatedPropertiesForRule(this.editingRule);
    // Required when opened programmatically from Form Template field shortcuts
    // (OnPush — parent viewChild calls do not mark this view dirty).
    this.cdr.markForCheck();
  }

  openEditEditor(rule: FormLogicRule, preferredFieldId?: string): void {
    this.clearFieldScopeSession();
    this.clearEditorCloseTimer();
    this.editorClosing = false;
    this.isNewRule = false;
    this.editingRule = sanitizeLogicRuleOperators(
      cloneLogicRule(rule),
      this.schema || [],
    );
    this.clearLogicValidation();
    this.editorOpen = true;

    const preferred = (preferredFieldId || '').trim();
    // Surface the clicked field on the first IF row when it already exists as a
    // condition field (display order only — does not invent/overwrite conditions).
    if (preferred && this.editingRule.conditions.items.length > 1) {
      const matchIndex = this.editingRule.conditions.items.findIndex(
        (item) => item.fieldId === preferred,
      );
      if (matchIndex > 0) {
        const items = [...this.editingRule.conditions.items];
        const [match] = items.splice(matchIndex, 1);
        items.unshift({ ...match, join: undefined });
        if (items[1]) {
          items[1] = { ...items[1], join: items[1].join ?? 'and' };
        }
        this.editingRule = {
          ...this.editingRule,
          conditions: { ...this.editingRule.conditions, items },
        };
      }
    }

    this.prefetchRelatedPropertiesForRule(this.editingRule);
    this.cdr.markForCheck();
  }

  /**
   * Form Template field shortcut: manage all automations that reference this
   * field in one multi-item editor (Conditional Logic–style sidebar).
   */
  openFieldAutomationsEditor(fieldId: string): void {
    const scopeId = (fieldId || '').trim();
    if (!scopeId) {
      return;
    }

    this.clearEditorCloseTimer();
    this.editorClosing = false;
    this.isNewRule = false;
    this.fieldScopeId = scopeId;

    const existing = findLogicRulesUsingField(this.localRules, scopeId).map(
      (rule) =>
        sanitizeLogicRuleOperators(cloneLogicRule(rule), this.schema || []),
    );
    this.originalFieldRuleIds = new Set(existing.map((rule) => rule.id));

    if (existing.length) {
      this.fieldScopedRules = existing;
      this.activeFieldRuleIndex = 0;
      this.editingRule = cloneLogicRule(existing[0]);
      this.surfacePreferredFieldOnEditingRule(scopeId);
    } else {
      const seeded = this.createSeededFieldAutomation(
        scopeId,
        this.defaultFieldAutomationName(0),
      );
      this.fieldScopedRules = [seeded];
      this.activeFieldRuleIndex = 0;
      this.editingRule = cloneLogicRule(seeded);
    }

    this.clearLogicValidation();
    this.editorOpen = true;
    this.prefetchRelatedPropertiesForRule(this.editingRule);
    this.cdr.markForCheck();
  }

  closeEditor(): void {
    this.overlayService.close();
    this.closeFieldRuleMenu();
    this.closeAddFieldAutomationModal();
    this.closeRenameFieldAutomationModal();
    if (!this.editorOpen || this.editorClosing) {
      return;
    }
    // Play the leave animation first, then unmount. Rule data is untouched.
    this.editorClosing = true;
    this.clearLogicValidation();
    this.cdr.markForCheck();
    this.clearEditorCloseTimer();
    this.editorCloseTimer = setTimeout(() => {
      this.editorCloseTimer = null;
      this.editorClosing = false;
      this.editorOpen = false;
      this.editingRule = null;
      this.isNewRule = false;
      this.clearFieldScopeSession();
      this.cdr.markForCheck();
    }, 220);
  }

  fieldAutomationLabel(index: number): string {
    if (index === this.activeFieldRuleIndex && this.editingRule) {
      const live = String(this.editingRule.name ?? '').trim();
      if (live) {
        return live;
      }
    }
    const rule = this.fieldScopedRules[index];
    const named = String(rule?.name ?? '').trim();
    return named || this.defaultFieldAutomationName(index);
  }

  /** Per-automation ON/OFF — active editor wins for the selected row. */
  isFieldAutomationEnabled(index: number): boolean {
    if (index === this.activeFieldRuleIndex && this.editingRule) {
      return this.editingRule.enabled !== false;
    }
    return this.fieldScopedRules[index]?.enabled !== false;
  }

  /**
   * Footer master toggle in field-scoped mode:
   * ON when any individual automation on this field is ON.
   */
  get isAnyFieldAutomationEnabled(): boolean {
    if (!this.isFieldScopedEditor || !this.fieldScopedRules.length) {
      return this.editingRule?.enabled !== false;
    }
    return this.fieldScopedRules.some((_, index) =>
      this.isFieldAutomationEnabled(index),
    );
  }

  /**
   * Sidebar toggle: flip only the targeted automation's enabled flag.
   * Turning ON validates first; turning OFF always remains possible.
   */
  onFieldAutomationEnabledChange(
    index: number,
    enabled: boolean,
    event?: Event,
  ): void {
    event?.stopPropagation();
    if (
      !this.isFieldScopedEditor ||
      index < 0 ||
      index >= this.fieldScopedRules.length
    ) {
      return;
    }

    this.commitActiveFieldAutomation();

    if (!enabled) {
      const next = [...this.fieldScopedRules];
      next[index] = { ...next[index], enabled: false };
      this.fieldScopedRules = next;
      if (index === this.activeFieldRuleIndex && this.editingRule) {
        this.editingRule = { ...this.editingRule, enabled: false };
      }
      this.clearLogicValidation();
      this.cdr.markForCheck();
      return;
    }

    const candidate = sanitizeLogicRuleOperators(
      { ...cloneLogicRule(this.fieldScopedRules[index]), enabled: true },
      this.schema || [],
    );
    const issues = validateLogicRule(
      candidate,
      index,
      this.buildLogicValidationContext(),
      { requireComplete: true },
    );
    const nameIssues = this.validateScopedNamesAgainstForm(
      this.fieldScopedRules.map((rule, ruleIndex) =>
        ruleIndex === index ? candidate : rule,
      ),
    ).filter((issue) => issue.ruleIndex === index);
    const allIssues = [...nameIssues, ...issues];
    if (allIssues.length) {
      this.applyLogicValidationIssues(allIssues);
      this.cdr.markForCheck();
      return;
    }

    const next = [...this.fieldScopedRules];
    next[index] = candidate;
    this.fieldScopedRules = next;
    if (index === this.activeFieldRuleIndex) {
      this.editingRule = cloneLogicRule(candidate);
    }
    this.clearLogicValidation();
    this.cdr.markForCheck();
  }

  /**
   * Footer "Automation is on" toggle.
   * Field-scoped: master control for all automations on the current field.
   * Single-rule: toggles only the editing rule.
   * Turning ON validates first; turning OFF always remains possible.
   */
  onEditingRuleEnabledChange(enabled: boolean): void {
    if (!this.editingRule) {
      return;
    }

    if (this.isFieldScopedEditor && this.fieldScopedRules.length) {
      this.commitActiveFieldAutomation();

      if (!enabled) {
        this.fieldScopedRules = this.fieldScopedRules.map((rule) => ({
          ...rule,
          enabled: false,
        }));
        this.editingRule = { ...this.editingRule, enabled: false };
        this.clearLogicValidation();
        this.cdr.markForCheck();
        return;
      }

      const candidates = this.fieldScopedRules.map((rule) =>
        sanitizeLogicRuleOperators(
          { ...cloneLogicRule(rule), enabled: true },
          this.schema || [],
        ),
      );
      const issues = [
        ...this.validateScopedNamesAgainstForm(candidates),
        ...candidates.flatMap((rule, index) =>
          validateLogicRule(rule, index, this.buildLogicValidationContext(), {
            requireComplete: true,
          }),
        ),
      ];
      if (issues.length) {
        this.applyLogicValidationIssues(issues);
        this.cdr.markForCheck();
        return;
      }

      this.fieldScopedRules = candidates;
      this.editingRule = cloneLogicRule(
        candidates[this.activeFieldRuleIndex] ?? candidates[0],
      );
      this.clearLogicValidation();
      this.cdr.markForCheck();
      return;
    }

    if (!enabled) {
      this.editingRule = { ...this.editingRule, enabled: false };
      this.clearLogicValidation();
      this.cdr.markForCheck();
      return;
    }

    const candidate = sanitizeLogicRuleOperators(
      { ...cloneLogicRule(this.editingRule), enabled: true },
      this.schema || [],
    );
    const issues = [
      ...this.validateSingleRuleNames(candidate),
      ...validateLogicRule(candidate, 0, this.buildLogicValidationContext(), {
        requireComplete: true,
      }),
    ];
    if (issues.length) {
      this.editingRule = { ...this.editingRule, enabled: false };
      this.applyLogicValidationIssues(issues);
      this.cdr.markForCheck();
      return;
    }

    this.editingRule = candidate;
    this.clearLogicValidation();
    this.cdr.markForCheck();
  }

  selectFieldAutomation(index: number): void {
    this.closeFieldRuleMenu();
    if (
      !this.isFieldScopedEditor ||
      !this.editingRule ||
      index < 0 ||
      index >= this.fieldScopedRules.length ||
      index === this.activeFieldRuleIndex
    ) {
      return;
    }
    this.commitActiveFieldAutomation();
    this.activeFieldRuleIndex = index;
    this.editingRule = sanitizeLogicRuleOperators(
      cloneLogicRule(this.fieldScopedRules[index]),
      this.schema || [],
    );
    this.clearLogicValidation();
    this.prefetchRelatedPropertiesForRule(this.editingRule);
    this.cdr.markForCheck();
  }

  openAddFieldAutomationModal(): void {
    if (!this.isFieldScopedEditor) {
      return;
    }
    this.closeFieldRuleMenu();
    this.addFieldAutomationNameDraft = this.defaultFieldAutomationName(
      this.fieldScopedRules.length,
    );
    this.addFieldAutomationModalOpen = true;
    this.cdr.markForCheck();
  }

  closeAddFieldAutomationModal(): void {
    this.addFieldAutomationModalOpen = false;
    this.addFieldAutomationNameDraft = '';
  }

  confirmAddFieldAutomation(): void {
    if (!this.isFieldScopedEditor || !this.fieldScopeId) {
      return;
    }

    const fallback = this.defaultFieldAutomationName(this.fieldScopedRules.length);
    const name = this.addFieldAutomationNameDraft.trim() || fallback;

    this.commitActiveFieldAutomation();
    const next = this.createSeededFieldAutomation(this.fieldScopeId, name);
    this.fieldScopedRules = [...this.fieldScopedRules, next];
    this.activeFieldRuleIndex = this.fieldScopedRules.length - 1;
    this.editingRule = cloneLogicRule(next);
    this.closeAddFieldAutomationModal();
    this.prefetchRelatedPropertiesForRule(this.editingRule);
    this.cdr.markForCheck();
  }

  duplicateFieldAutomation(index?: number | null, event?: Event): void {
    event?.stopPropagation();
    if (!this.isFieldScopedEditor || !this.editingRule) {
      return;
    }

    this.closeFieldRuleMenu();
    this.commitActiveFieldAutomation();

    const sourceIndex =
      typeof index === 'number' &&
      index >= 0 &&
      index < this.fieldScopedRules.length
        ? index
        : this.activeFieldRuleIndex;
    const source =
      this.fieldScopedRules[sourceIndex] ?? this.editingRule;
    const clone = this.cloneAutomationWithNewIds(source);
    clone.name = this.defaultFieldAutomationName(this.fieldScopedRules.length);
    clone.enabled = true;

    this.fieldScopedRules = [...this.fieldScopedRules, clone];
    this.activeFieldRuleIndex = this.fieldScopedRules.length - 1;
    this.editingRule = cloneLogicRule(clone);
    this.prefetchRelatedPropertiesForRule(this.editingRule);
    this.cdr.markForCheck();
  }

  openRenameFieldAutomationModal(index: number, event?: Event): void {
    event?.stopPropagation();
    if (!this.isFieldScopedEditor) {
      return;
    }
    if (index < 0 || index >= this.fieldScopedRules.length) {
      return;
    }
    this.closeFieldRuleMenu();
    this.renameFieldAutomationIndex = index;
    this.renameFieldAutomationNameDraft = this.fieldAutomationLabel(index);
    this.renameFieldAutomationModalOpen = true;
    this.cdr.markForCheck();
  }

  closeRenameFieldAutomationModal(): void {
    this.renameFieldAutomationModalOpen = false;
    this.renameFieldAutomationIndex = -1;
    this.renameFieldAutomationNameDraft = '';
  }

  confirmRenameFieldAutomation(): void {
    if (!this.isFieldScopedEditor) {
      return;
    }

    const index = this.renameFieldAutomationIndex;
    if (index < 0 || index >= this.fieldScopedRules.length) {
      this.closeRenameFieldAutomationModal();
      return;
    }

    const fallback = this.defaultFieldAutomationName(index);
    const name = this.renameFieldAutomationNameDraft.trim() || fallback;

    this.commitActiveFieldAutomation();
    const next = [...this.fieldScopedRules];
    next[index] = { ...next[index], name };
    this.fieldScopedRules = next;

    if (index === this.activeFieldRuleIndex && this.editingRule) {
      this.editingRule = { ...this.editingRule, name };
    }

    this.closeRenameFieldAutomationModal();
    this.cdr.markForCheck();
  }

  removeFieldAutomation(index: number): void {
    if (!this.isFieldScopedEditor || !this.fieldScopeId) {
      return;
    }
    this.closeFieldRuleMenu();

    if (this.fieldScopedRules.length <= 1) {
      const seeded = this.createSeededFieldAutomation(
        this.fieldScopeId,
        this.defaultFieldAutomationName(0),
      );
      this.fieldScopedRules = [seeded];
      this.activeFieldRuleIndex = 0;
      this.editingRule = cloneLogicRule(seeded);
      this.prefetchRelatedPropertiesForRule(this.editingRule);
      this.cdr.markForCheck();
      return;
    }

    this.commitActiveFieldAutomation();
    const next = this.fieldScopedRules.filter((_, i) => i !== index);
    const nextIndex = Math.min(
      index > this.activeFieldRuleIndex
        ? this.activeFieldRuleIndex
        : Math.max(0, this.activeFieldRuleIndex - 1),
      next.length - 1,
    );
    this.fieldScopedRules = next;
    this.activeFieldRuleIndex = nextIndex;
    this.editingRule = cloneLogicRule(next[nextIndex]);
    this.prefetchRelatedPropertiesForRule(this.editingRule);
    this.cdr.markForCheck();
  }

  toggleFieldRuleMenu(index: number, event?: Event): void {
    event?.stopPropagation();
    if (this.fieldRuleMenuIndex === index) {
      this.closeFieldRuleMenu();
      return;
    }

    const target = event?.currentTarget as HTMLElement | undefined;
    if (target) {
      const rect = target.getBoundingClientRect();
      const menuWidth = 160;
      const left = Math.min(
        Math.max(8, rect.right - menuWidth),
        window.innerWidth - menuWidth - 8,
      );
      const top = Math.min(rect.bottom + 4, window.innerHeight - 120);
      this.fieldRuleMenuStyle = {
        top: `${top}px`,
        left: `${left}px`,
      };
    }
    this.fieldRuleMenuIndex = index;
    this.cdr.markForCheck();
  }

  closeFieldRuleMenu(): void {
    if (this.fieldRuleMenuIndex === null) {
      return;
    }
    this.fieldRuleMenuIndex = null;
    this.fieldRuleMenuStyle = {};
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

  get selectedActionOptions(): ReadonlyArray<{
    value: LogicActionType;
    label: string;
  }> {
    return this.friendlyActionOptions.filter((option) =>
      this.isActionTypeSelected(option.value),
    );
  }

  isActionTypeSelected(type: LogicActionType): boolean {
    return !!this.editingRule?.actions.some((action) => action.type === type);
  }

  toggleActionType(type: LogicActionType, event?: Event): void {
    event?.stopPropagation();
    if (!this.editingRule) {
      return;
    }

    this.clearLogicValidation();
    if (this.isActionTypeSelected(type)) {
      const toRemove = this.editingRule.actions.filter(
        (action) => action.type === type,
      );
      for (const action of toRemove) {
        this.removeAction(action.id);
      }
      return;
    }

    this.editingRule = {
      ...this.editingRule,
      actions: [...this.editingRule.actions, createEmptyLogicAction(type)],
    };
  }

  removeSelectedActionType(type: LogicActionType, event: Event): void {
    event.stopPropagation();
    if (!this.editingRule) {
      return;
    }
    const toRemove = this.editingRule.actions.filter(
      (action) => action.type === type,
    );
    for (const action of toRemove) {
      this.removeAction(action.id);
    }
  }

  toggleRuleEnabled(rule: FormLogicRule, enabled: boolean): void {
    // Turning OFF always remains possible.
    if (!enabled) {
      const next = this.localRules.map((item) =>
        item.id === rule.id ? { ...item, enabled: false } : item,
      );
      this.emitRules(next);
      return;
    }

    const candidate = sanitizeLogicRuleOperators(
      { ...cloneLogicRule(rule), enabled: true },
      this.schema || [],
    );
    const prospective = this.localRules.map((item) =>
      item.id === rule.id ? candidate : item,
    );
    const issues = validateLogicRules(
      prospective,
      this.buildLogicValidationContext(),
    ).filter((issue) => {
      const index = prospective.findIndex((item) => item.id === rule.id);
      return issue.ruleIndex === index;
    });

    if (issues.length) {
      const first = firstLogicValidationIssue(issues);
      this.toastr.warning(
        `${rule.name || 'Untitled Rule'}: ${first?.message ?? 'Complete this automation before turning it on.'}`,
      );
      this.cdr.markForCheck();
      return;
    }

    this.emitRules(prospective);
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

    if (this.isFieldScopedEditor) {
      this.commitActiveFieldAutomation();

      const scoped = this.fieldScopedRules.map((rule, index) =>
        sanitizeLogicRuleOperators(
          {
            ...cloneLogicRule(rule),
            name: rule.name?.trim() || this.defaultFieldAutomationName(index),
          },
          this.schema || [],
        ),
      );
      this.fieldScopedRules = scoped;

      // Validate every automation that will be saved as ON.
      // Incomplete OFF automations may remain as drafts.
      const nameIssues = this.validateScopedNamesAgainstForm(scoped);
      const completenessIssues = scoped.flatMap((rule, index) =>
        validateLogicRule(rule, index, this.buildLogicValidationContext(), {
          requireComplete: rule.enabled !== false,
        }),
      );
      const issues = [...nameIssues, ...completenessIssues];
      if (issues.length) {
        this.applyLogicValidationIssues(issues);
        this.cdr.markForCheck();
        return;
      }

      const kept = this.localRules.filter(
        (rule) => !this.originalFieldRuleIds.has(rule.id),
      );
      this.clearLogicValidation();
      this.emitRules([...kept, ...scoped]);
      this.closeEditor();
      return;
    }

    const sanitized = sanitizeLogicRuleOperators(
      cloneLogicRule(this.editingRule),
      this.schema || [],
    );
    const name = sanitized.name?.trim() || 'Untitled Rule';
    const saved: FormLogicRule = {
      ...sanitized,
      name,
    };
    this.editingRule = saved;

    const issues = [
      ...this.validateSingleRuleNames(saved),
      ...validateLogicRule(saved, 0, this.buildLogicValidationContext(), {
        requireComplete: saved.enabled !== false,
      }),
    ];
    if (issues.length) {
      this.applyLogicValidationIssues(issues);
      this.cdr.markForCheck();
      return;
    }

    const next = this.isNewRule
      ? [...this.localRules, saved]
      : this.localRules.map((rule) => (rule.id === saved.id ? saved : rule));

    this.clearLogicValidation();
    this.emitRules(next);
    this.closeEditor();
  }

  setMatchMode(match: LogicConditionMatch): void {
    if (!this.editingRule) {
      return;
    }
    const join = joinFromMatch(match);
    const items = this.editingRule.conditions.items.map((item, index) =>
      index === 0 ? { ...item, join: undefined } : { ...item, join },
    );
    this.editingRule = {
      ...this.editingRule,
      conditions: { ...this.editingRule.conditions, match, items },
    };
  }

  conditionJoin(condition: LogicConditionItem): LogicConditionJoin {
    return (
      condition.join ?? joinFromMatch(this.editingRule?.conditions.match ?? 'all')
    );
  }

  setConditionJoin(conditionId: string, join: LogicConditionJoin): void {
    if (!this.editingRule) {
      return;
    }
    const items = this.editingRule.conditions.items.map((item, index) => {
      if (item.id !== conditionId || index === 0) {
        return item;
      }
      return { ...item, join };
    });
    this.editingRule = {
      ...this.editingRule,
      conditions: {
        ...this.editingRule.conditions,
        items,
        match: matchFromJoins(items, this.editingRule.conditions.match),
      },
    };
  }

  selectConditionJoin(conditionId: string, join: LogicConditionJoin): void {
    this.setConditionJoin(conditionId, join);
    this.overlayService.close();
  }

  addCondition(): void {
    if (!this.editingRule) {
      return;
    }
    this.clearLogicValidation();
    const items = [
      ...this.editingRule.conditions.items,
      createEmptyLogicCondition('and'),
    ];
    this.editingRule = {
      ...this.editingRule,
      conditions: {
        ...this.editingRule.conditions,
        items,
        match: matchFromJoins(items, this.editingRule.conditions.match),
      },
    };
  }

  removeCondition(conditionId: string): void {
    if (!this.editingRule) {
      return;
    }
    this.clearLogicValidation();
    const filtered = this.editingRule.conditions.items.filter(
      (item) => item.id !== conditionId,
    );
    const items = (filtered.length ? filtered : [createEmptyLogicCondition()]).map(
      (item, index) =>
        index === 0 ? { ...item, join: undefined } : { ...item, join: item.join ?? 'and' },
    );
    this.editingRule = {
      ...this.editingRule,
      conditions: {
        ...this.editingRule.conditions,
        items,
        match: matchFromJoins(items, this.editingRule.conditions.match),
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

  removeAction(actionId: string): void {
    if (!this.editingRule) {
      return;
    }
    this.editingRule = {
      ...this.editingRule,
      actions: this.editingRule.actions.filter(
        (action) => action.id !== actionId,
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
    this.clearLogicValidation();
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

  logicValidationMessage(
    field: LogicRuleValidationIssue['field'],
    conditionIndex?: number,
  ): string {
    const active = this.isFieldScopedEditor ? this.activeFieldRuleIndex : 0;
    return (
      this.logicValidationIssues.find((issue) => {
        if (issue.ruleIndex !== active || issue.field !== field) {
          return false;
        }
        if (conditionIndex !== undefined) {
          return issue.conditionIndex === conditionIndex;
        }
        return issue.conditionIndex === undefined;
      })?.message ?? ''
    );
  }

  private buildLogicValidationContext(): {
    schema: FormField[];
    resolveRelatedColumns: (
      sourceFieldId: string,
    ) => Array<{ id: string; label: string }>;
    resolveRelatedRecords: (
      sourceFieldId: string,
    ) => Record<string, unknown>[];
  } {
    return {
      schema: this.schema || [],
      resolveRelatedColumns: (sourceFieldId) =>
        this.relatedPropertyCache.get(sourceFieldId) ?? [],
      resolveRelatedRecords: (sourceFieldId) =>
        this.relatedRecordsCache.get(sourceFieldId) ?? [],
    };
  }

  private clearLogicValidation(): void {
    this.logicValidationIssues = [];
  }

  private applyLogicValidationIssues(issues: LogicRuleValidationIssue[]): void {
    this.logicValidationIssues = issues;
    const first = firstLogicValidationIssue(issues);
    if (!first) {
      return;
    }

    if (
      this.isFieldScopedEditor &&
      first.ruleIndex !== this.activeFieldRuleIndex &&
      first.ruleIndex >= 0 &&
      first.ruleIndex < this.fieldScopedRules.length
    ) {
      this.commitActiveFieldAutomation();
      this.activeFieldRuleIndex = first.ruleIndex;
      this.editingRule = sanitizeLogicRuleOperators(
        cloneLogicRule(this.fieldScopedRules[first.ruleIndex]),
        this.schema || [],
      );
      this.prefetchRelatedPropertiesForRule(this.editingRule);
    }

    const ruleLabel = this.isFieldScopedEditor
      ? this.fieldAutomationLabel(first.ruleIndex)
      : this.editingRule?.name?.trim() || 'Untitled Rule';
    this.toastr.warning(`${ruleLabel}: ${first.message}`);
  }

  /** Duplicate-name check for the single-rule editor against the rest of the form. */
  private validateSingleRuleNames(
    rule: FormLogicRule,
  ): LogicRuleValidationIssue[] {
    const prospective = this.isNewRule
      ? [...this.localRules, rule]
      : this.localRules.map((item) => (item.id === rule.id ? rule : item));
    const index = prospective.findIndex((item) => item.id === rule.id);
    return validateLogicRuleNames(prospective)
      .filter((issue) => issue.ruleIndex === index)
      .map((issue) => ({ ...issue, ruleIndex: 0 }));
  }

  /**
   * Duplicate-name check for field-scoped automations against the full form
   * (including rules outside this field scope).
   */
  private validateScopedNamesAgainstForm(
    scoped: FormLogicRule[],
  ): LogicRuleValidationIssue[] {
    const kept = this.localRules.filter(
      (rule) => !this.originalFieldRuleIds.has(rule.id),
    );
    const merged = [...kept, ...scoped];
    const scopedIdToIndex = new Map(
      scoped.map((rule, index) => [rule.id, index] as const),
    );
    return validateLogicRuleNames(merged)
      .map((issue) => {
        const rule = merged[issue.ruleIndex];
        const scopedIndex = rule ? scopedIdToIndex.get(rule.id) : undefined;
        if (scopedIndex === undefined) {
          return null;
        }
        return { ...issue, ruleIndex: scopedIndex };
      })
      .filter((issue): issue is LogicRuleValidationIssue => issue != null);
  }

  private clearFieldScopeSession(): void {
    this.fieldScopeId = null;
    this.fieldScopedRules = [];
    this.activeFieldRuleIndex = 0;
    this.originalFieldRuleIds = new Set();
    this.closeFieldRuleMenu();
    this.closeAddFieldAutomationModal();
    this.closeRenameFieldAutomationModal();
  }

  private defaultFieldAutomationName(index: number): string {
    return `Automation ${index + 1}`;
  }

  private commitActiveFieldAutomation(): void {
    if (!this.editingRule || !this.fieldScopedRules.length) {
      if (this.editingRule) {
        this.fieldScopedRules = [cloneLogicRule(this.editingRule)];
        this.activeFieldRuleIndex = 0;
      }
      return;
    }
    const index = Math.min(
      Math.max(this.activeFieldRuleIndex, 0),
      this.fieldScopedRules.length - 1,
    );
    const next = [...this.fieldScopedRules];
    next[index] = cloneLogicRule(this.editingRule);
    this.fieldScopedRules = next;
    this.activeFieldRuleIndex = index;
  }

  private createSeededFieldAutomation(
    fieldId: string,
    name: string,
  ): FormLogicRule {
    const rule = createEmptyLogicRule(name);
    if (rule.conditions.items[0]) {
      // Temporarily bind editingRule so onConditionFieldChange can patch items.
      const previous = this.editingRule;
      this.editingRule = rule;
      this.onConditionFieldChange(rule.conditions.items[0], fieldId);
      const seeded = this.editingRule
        ? cloneLogicRule(this.editingRule)
        : rule;
      this.editingRule = previous;
      return { ...seeded, name };
    }
    return rule;
  }

  private cloneAutomationWithNewIds(rule: FormLogicRule): FormLogicRule {
    const clone = cloneLogicRule(rule);
    clone.id = createLogicRuleId();
    clone.conditions = {
      ...clone.conditions,
      items: clone.conditions.items.map((item) => ({
        ...item,
        id: createLogicRuleId(),
      })),
    };
    clone.actions = clone.actions.map((action) => ({
      ...action,
      id: createLogicRuleId(),
    }));
    return clone;
  }

  private surfacePreferredFieldOnEditingRule(preferredFieldId: string): void {
    if (!this.editingRule || !preferredFieldId) {
      return;
    }
    if (this.editingRule.conditions.items.length <= 1) {
      return;
    }
    const matchIndex = this.editingRule.conditions.items.findIndex(
      (item) => item.fieldId === preferredFieldId,
    );
    if (matchIndex <= 0) {
      return;
    }
    const items = [...this.editingRule.conditions.items];
    const [match] = items.splice(matchIndex, 1);
    items.unshift({ ...match, join: undefined });
    if (items[1]) {
      items[1] = { ...items[1], join: items[1].join ?? 'and' };
    }
    this.editingRule = {
      ...this.editingRule,
      conditions: { ...this.editingRule.conditions, items },
    };
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
