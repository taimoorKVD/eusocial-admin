import {
  ChangeDetectorRef,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  HostListener,
  inject,
  OnInit,
  signal,
  viewChild,
  WritableSignal,
} from '@angular/core';
import { FieldSettingsComponent } from '../../../../form-builder/field-settings/field-settings.component';
import { LogicRulesPanelComponent } from '../../../../forms/logic-rules-panel/logic-rules-panel.component';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { finalize, Observable, startWith, take } from 'rxjs';
import { CreateFormCanDeactivate } from './create-form-can-deactivate.interface';
import flatpickr from 'flatpickr';
import { Instance as FlatpickrInstance } from 'flatpickr/dist/types/instance';
import { TenantUserService } from '../../../../../services/tenant-user.service';
import { TenantJobPositionService } from '../../../../../services/tenant-job-position.service';
import { LocationCacheService } from '../../../../../services/location-cache.service';
import { ToastrService } from 'ngx-toastr';
import { SharedModule } from '../../../../../shared/shared.module';
import { TenantFormsService } from '../services/tenant-forms.service';
import { FormStorageService } from '../../../../forms/services/form-storage.service';
import { FormField } from '../../../../form-builder/models/form-field.model';
import { FIELD_TEMPLATES } from '../../../../form-builder/data/field-templates';
import {
  applyCanvasDrop,
  clearStaleConditionalLogic,
  duplicateFormField,
  removeFormField,
  updateFormField,
} from '../../../../form-builder/utils/form-field-operations';
import {
  CONDITION_ACTION_LABELS,
  CONDITION_OPERATOR_LABELS,
  getPrimaryActionType,
  getPrimaryPredicate,
  getSelectedActionTypes,
  hasConfiguredSource,
  normalizeConditionalLogic,
  pruneConditionalLogicForDeletedFields,
  resolveCollectionConditionalEffects,
  serializeConditionalLogic,
} from '../../../../../shared/conditional-logic';
import { resolveCharacterLimit } from '../../../../../shared/dynamic-form/character-limit.utils';
import {
  DEFAULT_RANGE_STEP,
  normalizeRangeTimeFormat,
  normalizeRangeType,
} from '../../../../../shared/dynamic-form/range-field.utils';
import { getLocationFieldDeleteBlockReason } from '../../../../form-builder/utils/location-field-dependencies.utils';
import { FormEditorCoreModule } from '../../../../forms/form-editor-core.module';
import { FormBuilderTab } from '../../../../forms/components/form-builder-workspace/form-builder-workspace.component';
import { FormLogicRule } from '../../../../forms/logic-rules/logic-rule.models';
import {
  collectLogicRuleFieldIds,
  findLogicRulesUsingField,
  normalizeLogicRules,
  pruneLogicRulesForDeletedFields,
  summarizeActions,
  summarizeConditions,
  summarizeRuleCard,
} from '../../../../forms/logic-rules/logic-rule.utils';
import { SectionFieldPreviewComponent } from '../components/section-field-preview/section-field-preview.component';
import {
  availableRowWidthPresetsForField,
  builderWidthToPreset,
  largestFittingBuilderWidth,
  mapBuilderFieldToConfig,
  mapBuilderWidthToPercent,
  mapConfigFieldToBuilder,
  normalizeBuilderWidthUnits,
  rowHasAvailableColumnSpace,
  rowRemainingGridUnits,
  widthToGridUnits,
  type RowWidthPreset,
} from '../utils/field-builder-adapter.utils';
import {
  hydrateFormTemplateDynamicSelectField,
  hydrateFormTemplateDynamicSelectOptions,
} from '../utils/hydrate-dynamic-select-options.utils';
import {
  clearDependentLocationOptions,
  getConfigFieldLocationKind,
  getFieldOptionLabelKey,
  getFieldOptionValueKey,
  getRowLocationFields,
  isEmptyLocationValue,
  mapLocationRecordsToSelectOptions,
  resolveLocationRecordId,
} from '../utils/row-location-dependencies.utils';
import {
  createDefaultFrequencyRecurring,
  createCustomSection,
  createEmptyRow,
  CustomFormSection,
  DynamicFormPayload,
  FormFieldConfig,
  FormMetaConfig,
  FormRow,
  FormSection,
  FormSelectOption,
  FrequencyInterval,
  FrequencyMonthMode,
  FrequencyTimeParts,
  FrequencyType,
  SavedDynamicForm,
  ASSIGN_REPORT_MODE_OPTIONS,
  AssignReportMode,
  buildDynamicFormPayload,
  createId,
  formatAssignReportModeLabel,
  normalizeAssignReportMode,
  normalizeFrequencyTimes,
  resolveFrequencyScheduleTimes,
  resolveMinimumFrequencyEndDate,
  sanitizeFrequencyRecurring,
} from '../models/dynamic-form.models';
import {
  TIME_MERIDIEM_OPTIONS,
  TimeMeridiem,
  composeTimeFrom12h,
  getTimeHour12,
  getTimeMeridiem,
  getTimeMinute,
  isValidTimeFieldValue,
} from '../../../../../shared/dynamic-form/time-field.utils';

interface WizardStep {
  label: string;
  number: number;
}

@Component({
  selector: 'app-create-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    SharedModule,
    FormEditorCoreModule,
    SectionFieldPreviewComponent,
  ],
  templateUrl: './create-form.component.html',
  styleUrl: './create-form.component.scss',
})
export class CreateFormComponent implements OnInit, CreateFormCanDeactivate {
  /**
   * Browser unload (reload / tab close) can only show the native prompt.
   * Custom Angular modals cannot block or replace this dialog.
   */
  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.multi-select-dropdown')) {
      this.assignModeDropdownOpen.set(false);
      this.reportModeDropdownOpen.set(false);
      this.assignUsersDropdownOpen.set(false);
      this.assignUsersSearch.set('');
      this.assignPositionsDropdownOpen.set(false);
      this.assignPositionsSearch.set('');
      this.reportUsersDropdownOpen.set(false);
      this.reportUsersSearch.set('');
      this.reportPositionsDropdownOpen.set(false);
      this.reportPositionsSearch.set('');
    }
    if (!target.closest('.freq-select-dropdown')) {
      this.freqTypeDropdownOpen.set(false);
      this.freqTypeSearch.set('');
      this.freqIntervalDropdownOpen.set(false);
      this.freqIntervalSearch.set('');
      this.freqYearMonthDropdownOpen.set(false);
      this.freqYearMonthSearch.set('');
    }
  }

  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly formsService = inject(TenantFormsService);
  /** Used to open the existing Conditional Logic modal without duplicating it. */
  private readonly fieldSettings = viewChild(FieldSettingsComponent);
  /** Host for Automation Rules editor modal (list chrome hidden). */
  private readonly logicRulesPanel = viewChild(LogicRulesPanelComponent);

  readonly logicOverviewOpen = signal(false);
  readonly logicOverviewTab = signal<'logicMap' | 'automationMap' | 'list'>('list');
  private readonly toastr = inject(ToastrService);
  private readonly userService = inject(TenantUserService);
  private readonly jobPositionService = inject(TenantJobPositionService);
  private readonly locationCache = inject(LocationCacheService);
  private readonly formStorageService = inject(FormStorageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);

  private readonly frequencyDateInput = viewChild<ElementRef<HTMLInputElement>>('frequencyDateInput');
  private readonly frequencyStartDateInput =
    viewChild<ElementRef<HTMLInputElement>>('frequencyStartDateInput');
  private readonly frequencyEndDateInput =
    viewChild<ElementRef<HTMLInputElement>>('frequencyEndDateInput');
  private flatpickrInstance: FlatpickrInstance | null = null;
  private flatpickrStartInstance: FlatpickrInstance | null = null;
  private flatpickrEndInstance: FlatpickrInstance | null = null;

  // ── Assign & Report Multi-Select State ────────────────────────
  readonly assignModeDropdownOpen = signal(false);
  readonly reportModeDropdownOpen = signal(false);
  readonly assignUsersDropdownOpen = signal(false);
  readonly assignUsersSearch = signal('');
  readonly assignPositionsDropdownOpen = signal(false);
  readonly assignPositionsSearch = signal('');
  readonly reportUsersDropdownOpen = signal(false);
  readonly reportUsersSearch = signal('');
  readonly reportPositionsDropdownOpen = signal(false);
  readonly reportPositionsSearch = signal('');

  readonly filteredAssignUsers = computed(() => {
    const q = this.assignUsersSearch().trim().toLowerCase();
    const selected = new Set(this.meta().assignUsers);
    const opts = this.userOptions();
    const filtered = q
      ? opts.filter((o) => o.name.toLowerCase().includes(q) || (o.jobPosition || '').toLowerCase().includes(q))
      : opts;
    return filtered.map((o) => ({ ...o, selected: selected.has(o.name) }));
  });

  readonly filteredAssignPositions = computed(() => {
    const q = this.assignPositionsSearch().trim().toLowerCase();
    const selected = new Set(this.meta().assignJobPosition);
    const opts = this.jobPositionOptions();
    const filtered = q ? opts.filter((o) => o.name.toLowerCase().includes(q)) : opts;
    return filtered.map((o) => ({ ...o, selected: selected.has(o.name) }));
  });

  readonly filteredReportUsers = computed(() => {
    const q = this.reportUsersSearch().trim().toLowerCase();
    const selected = new Set(this.meta().reportUsers);
    const opts = this.userOptions();
    const filtered = q
      ? opts.filter((o) => o.name.toLowerCase().includes(q) || (o.jobPosition || '').toLowerCase().includes(q))
      : opts;
    return filtered.map((o) => ({ ...o, selected: selected.has(o.name) }));
  });

  readonly filteredReportPositions = computed(() => {
    const q = this.reportPositionsSearch().trim().toLowerCase();
    const selected = new Set(this.meta().reportJobPosition);
    const opts = this.jobPositionOptions();
    const filtered = q ? opts.filter((o) => o.name.toLowerCase().includes(q)) : opts;
    return filtered.map((o) => ({ ...o, selected: selected.has(o.name) }));
  });

  /** Assign: Job Positions disabled while any User is selected. */
  readonly assignPositionsDisabled = computed(() => this.meta().assignUsers.length > 0);
  /** Assign: Users disabled while any Job Position is selected. */
  readonly assignUsersDisabled = computed(() => this.meta().assignJobPosition.length > 0);
  /** Report: Job Positions disabled while any User is selected. */
  readonly reportPositionsDisabled = computed(() => this.meta().reportUsers.length > 0);
  /** Report: Users disabled while any Job Position is selected. */
  readonly reportUsersDisabled = computed(() => this.meta().reportJobPosition.length > 0);

  readonly formName = signal('');
  readonly sections = signal<FormSection[]>([]);

  // ── Edit Mode State ───────────────────────────────────────────
  /** Template id when the wizard is opened from View Forms → Edit. */
  readonly formId = signal<string>('');
  readonly isEditing = computed(() => !!this.formId());
  readonly loading = signal(false);
  /** True while create/update form template API is in flight. */
  readonly submitting = signal(false);
  /** True while manual Save as Draft API is in flight. */
  readonly savingDraft = signal(false);
  readonly showUnsavedChangesModal = signal(false);
  private loadedSchema: DynamicFormPayload | null = null;

  /** Snapshot of last saved / loaded template config for dirty detection. */
  private savedSnapshot = '';
  private baselineReady = false;
  /** Once the user has unsaved edits, stop auto-refreshing the baseline. */
  private freezeBaseline = false;
  /** Skip unsaved guard after intentional navigate (save/discard). */
  private allowNavigation = false;
  private navigationResolver: ((allow: boolean) => void) | null = null;

  readonly sectionDialogOpen = signal(false);
  /** UI-only: which Build canvas sections are collapsed. */
  readonly collapsedSectionIds = signal<ReadonlySet<string>>(new Set());
  readonly sectionDialogMode = signal<'create' | 'rename'>('create');
  readonly editingSectionId = signal<string | null>(null);
  readonly sectionNameInput = signal('');
  readonly sectionNameError = signal('');
  readonly sectionPendingRemoval = signal<CustomFormSection | null>(null);
  readonly meta = signal<FormMetaConfig>({
    assignJobPosition: [],
    assignUsers: [],
    assignMode: 'individual',
    reportJobPosition: [],
    reportUsers: [],
    reportMode: 'individual',
    frequencyJobPosition: [],
    frequencyDate: null,
    frequencyTime: null,
    frequencyStartDate: null,
    frequencyEndDate: null,
    frequencyType: 'atOnce',
    frequencyRecurring: createDefaultFrequencyRecurring(),
  });

  readonly assignReportModeOptions = ASSIGN_REPORT_MODE_OPTIONS;
  readonly assignModeLabel = computed(() =>
    formatAssignReportModeLabel(this.meta().assignMode, 'One response'),
  );
  readonly reportModeLabel = computed(() =>
    formatAssignReportModeLabel(this.meta().reportMode, 'One response'),
  );

  /** Split-view row editor: palette + selected-row drop canvas. */
  readonly fieldBuilderOpen = signal(false);
  private readonly pendingFieldTarget = signal<{ sectionId: string; rowId: string } | null>(null);

  /** Existing row fields converted for Form Builder editing. */
  readonly rowBuilderFields = signal<FormField[]>([]);
  readonly builderSchema = signal<FormField[]>([]);
  readonly selectedFieldId = signal<string | null>(null);
  readonly builderActiveTab = signal<FormBuilderTab>('fields');
  readonly paletteListId = 'createFormPaletteList';
  readonly canvasListId = 'createFormCanvasList';
  readonly existingRowListId = 'createFormExistingRowList';
  /** Empty-state drop target when the form has no sections yet. */
  readonly emptyCanvasListId = 'createFormEmptyCanvas';
  /** Stable empty data ref for CDK drop lists that only accept palette drops. */
  readonly emptyDropListData: FormField[] = [];
  readonly builderModuleName = 'dynamic-forms';
  /** Input Fields header count (“N types”) — matches palette templates. */
  readonly paletteFieldTypeCount = FIELD_TEMPLATES.length;

  /**
   * Drop-list ids the palette connects to in the always-on Build workspace.
   * Empty canvas when no sections; otherwise each row canvas, add-column slot,
   * and per-section new-row zone.
   */
  readonly paletteConnectedDropLists = computed(() => {
    const sections = this.sections();
    if (!sections.length) {
      return [this.emptyCanvasListId];
    }
    const ids: string[] = [];
    for (const section of sections) {
      for (const row of section.rows) {
        ids.push(this.rowCanvasListId(section.id, row.id));
        if (this.rowCanAddColumn(row)) {
          ids.push(this.rowAddColumnListId(section.id, row.id));
        }
      }
      ids.push(this.sectionNewRowListId(section.id));
    }
    return ids;
  });

  readonly draftStatusLabel = computed(() =>
    this.isEditing() ? 'Editing saved template' : 'Draft · Not saved yet',
  );

  /** Stable per-row builder schemas for canvas CDK lists (rebuilt when sections change). */
  readonly rowCanvasSchemas = computed(() => {
    const map = new Map<string, FormField[]>();
    for (const section of this.sections()) {
      for (const row of section.rows) {
        map.set(
          `${section.id}:${row.id}`,
          row.fields.map((field) => mapConfigFieldToBuilder(field)),
        );
      }
    }
    return map;
  });
  /** Prevents click-to-edit while a row field is being dragged. */
  private isReorderingExistingFields = false;

  readonly builderCombinedSchema = computed(() => [
    ...this.rowBuilderFields(),
    ...this.builderSchema(),
  ]);

  /** All form fields across sections + current builder drafts — for Logic Rules. */
  readonly logicSchemaFields = computed(() => {
    const fromSections = this.sections().flatMap((section) =>
      section.rows.flatMap((row) =>
        row.fields.map((field) => mapConfigFieldToBuilder(field)),
      ),
    );
    const draftFields = this.builderSchema();
    const draftIds = new Set(draftFields.map((field) => field.id));
    const merged = [
      ...fromSections.filter((field) => !draftIds.has(field.id)),
      ...draftFields,
    ];
    const rowLive = this.rowBuilderFields();
    if (!rowLive.length) {
      return merged;
    }
    const rowIds = new Set(rowLive.map((field) => field.id));
    return [
      ...merged.filter((field) => !rowIds.has(field.id)),
      ...rowLive,
    ];
  });

  readonly logicRules = signal<FormLogicRule[]>([]);

  /** Section + row context for the open Add Field editor. */
  readonly builderRowContext = computed(() => {
    const target = this.pendingFieldTarget();
    if (!target) return null;

    const section = this.sections().find((item) => item.id === target.sectionId);
    if (!section) return null;

    const rowIndex = section.rows.findIndex((row) => row.id === target.rowId);
    const row: FormRow =
      rowIndex >= 0
        ? section.rows[rowIndex]
        : { id: target.rowId, fields: [] };

    return {
      sectionId: section.id,
      sectionLabel: section.name,
      row,
      rowIndex: rowIndex >= 0 ? rowIndex : 0,
    };
  });

  readonly selectedBuilderField = computed(() => {
    const id = this.selectedFieldId();
    if (!id) return null;

    return (
      this.builderSchema().find((field) => field.id === id) ??
      this.rowBuilderFields().find((field) => field.id === id) ??
      this.logicSchemaFields().find((field) => field.id === id) ??
      null
    );
  });

  /** Field-type eyebrow for the Field Settings panel chrome (e.g. TEXTAREA). */
  readonly selectedFieldTypeEyebrow = computed(() => {
    const field = this.selectedBuilderField();
    if (!field) return '';
    const raw = (field.fieldTypeName || field.type || 'field').toString();
    return raw.replace(/[-_]/g, ' ').trim().toUpperCase();
  });

  readonly isDraftFieldUsedInLogicRules = computed(() => {
    const field = this.selectedBuilderField();
    if (!field) {
      return false;
    }
    return findLogicRulesUsingField(this.logicRules(), field.id).length > 0;
  });

  /** Fields with configured Conditional Logic (enabled + source). */
  readonly fieldsWithConditionalLogicIds = computed(() =>
    this.logicSchemaFields()
      .filter((field) => this.fieldHasConfiguredConditionalLogic(field))
      .map((field) => field.id),
  );

  /** Fields referenced by at least one Automation Rule. */
  readonly fieldsWithAutomationRuleIds = computed(() => {
    const ids = new Set<string>();
    for (const rule of this.logicRules()) {
      for (const id of collectLogicRuleFieldIds(rule)) {
        ids.add(id);
      }
    }
    return [...ids];
  });

  /**
   * Badge count = configured field conditions + automation rules.
   * (Matches Figma: 2 logic + 2 automations → 4.)
   */
  readonly logicAutomationsCount = computed(
    () => this.fieldsWithConditionalLogicIds().length + this.logicRules().length,
  );

  readonly configuredConditionalLogicFields = computed(() =>
    this.logicSchemaFields().filter((field) =>
      this.fieldHasConfiguredConditionalLogic(field),
    ),
  );

  readonly canSaveDraftField = computed(() => {
    const selected = this.selectedBuilderField();
    if (selected && this.isExistingRowField(selected.id)) {
      return true;
    }
    // Enable Save when any newly added draft field is ready (not only the selected one).
    return this.builderSchema().some((field) => !!field.label?.trim());
  });

  readonly hasSections = computed(() => this.sections().length > 0);
  readonly canSave = computed(
    () =>
      this.formName().trim().length > 0 &&
      this.hasSections() &&
      this.isFrequencyScheduleValid(),
  );

  // ── Wizard State ──────────────────────────────────────────────
  readonly currentStep = signal(1);
  readonly totalSteps = 3;

  readonly steps: WizardStep[] = [
    { label: 'Build', number: 1 },
    { label: 'Assign & report', number: 2 },
    { label: 'Schedule', number: 3 },
  ];

  readonly isFirstStep = computed(() => this.currentStep() === 1);
  readonly isLastStep = computed(() => this.currentStep() === this.totalSteps);

  readonly step1Valid = computed(() => {
    if (this.formName().trim().length === 0) {
      return false;
    }
    const sections = this.sections();
    if (sections.length === 0) {
      return false;
    }
    // Every section must contain at least one field.
    return sections.every((section) =>
      section.rows.some((row) => row.fields.length > 0),
    );
  });

  /** Assign and Report To each need at least one User or Job Position. */
  readonly step2Valid = computed(() => {
    const m = this.meta();
    const assignOk =
      m.assignUsers.length > 0 || m.assignJobPosition.length > 0;
    const reportOk =
      m.reportUsers.length > 0 || m.reportJobPosition.length > 0;
    return assignOk && reportOk;
  });

  /** Assigned people/teams for the relationship diagram. */
  readonly assignFlowItems = computed(() => {
    const m = this.meta();
    return [
      ...m.assignUsers.map((name) => ({ name, kind: 'user' as const })),
      ...m.assignJobPosition.map((name) => ({ name, kind: 'team' as const })),
    ];
  });

  /** Report-to people/teams for the relationship diagram. */
  readonly reportFlowItems = computed(() => {
    const m = this.meta();
    return [
      ...m.reportUsers.map((name) => ({ name, kind: 'user' as const })),
      ...m.reportJobPosition.map((name) => ({ name, kind: 'team' as const })),
    ];
  });

  readonly showAssignReportFlow = computed(
    () => this.assignFlowItems().length > 0 && this.reportFlowItems().length > 0,
  );

  // ── Frequency (Reactive Form) ─────────────────────────────────
  readonly frequencyTypeOptions: { label: string; value: FrequencyType }[] = [
    { label: 'At Once', value: 'atOnce' },
    { label: 'Recurring', value: 'recurring' },
  ];

  readonly intervalOptions: { label: string; value: FrequencyInterval }[] = [
    { label: 'Day', value: 'day' },
    { label: 'Week', value: 'week' },
    { label: 'Month', value: 'month' },
    { label: 'Year', value: 'year' },
  ];

  readonly monthOptions = [
    { label: 'January', value: 'january' },
    { label: 'February', value: 'february' },
    { label: 'March', value: 'march' },
    { label: 'April', value: 'april' },
    { label: 'May', value: 'may' },
    { label: 'June', value: 'june' },
    { label: 'July', value: 'july' },
    { label: 'August', value: 'august' },
    { label: 'September', value: 'september' },
    { label: 'October', value: 'october' },
    { label: 'November', value: 'november' },
    { label: 'December', value: 'december' },
  ];

  readonly weekdayOptions = [
    { label: 'Mon', value: 'monday' },
    { label: 'Tue', value: 'tuesday' },
    { label: 'Wed', value: 'wednesday' },
    { label: 'Thu', value: 'thursday' },
    { label: 'Fri', value: 'friday' },
    { label: 'Sat', value: 'saturday' },
    { label: 'Sun', value: 'sunday' },
  ];

  readonly timeHourOptions = Array.from({ length: 12 }, (_, i) => i + 1);
  readonly timeMinuteOptions = Array.from({ length: 60 }, (_, i) => i);
  readonly timeMeridiemOptions = TIME_MERIDIEM_OPTIONS;

  // ── Frequency Custom Select State ─────────────────────────────
  readonly freqTypeDropdownOpen = signal(false);
  readonly freqTypeSearch = signal('');
  readonly freqIntervalDropdownOpen = signal(false);
  readonly freqIntervalSearch = signal('');
  readonly freqYearMonthDropdownOpen = signal(false);
  readonly freqYearMonthSearch = signal('');

  readonly filteredFrequencyTypeOptions = computed(() => {
    const q = this.freqTypeSearch().trim().toLowerCase();
    return q
      ? this.frequencyTypeOptions.filter((o) => o.label.toLowerCase().includes(q))
      : this.frequencyTypeOptions;
  });

  readonly filteredIntervalOptions = computed(() => {
    const q = this.freqIntervalSearch().trim().toLowerCase();
    return q
      ? this.intervalOptions.filter((o) => o.label.toLowerCase().includes(q))
      : this.intervalOptions;
  });

  readonly filteredYearMonthOptions = computed(() => {
    const q = this.freqYearMonthSearch().trim().toLowerCase();
    return q
      ? this.monthOptions.filter((o) => o.label.toLowerCase().includes(q))
      : this.monthOptions;
  });

  /** Start Year options: current year through the next 10 years. */
  readonly frequencyYearOptions = Array.from({ length: 11 }, (_, i) => {
    const year = new Date().getFullYear() + i;
    return { label: String(year), value: year };
  });

  readonly frequencyForm = this.fb.nonNullable.group({
    type: this.fb.nonNullable.control<FrequencyType>('recurring'),
    date: this.fb.control<string | null>(null),
    time: this.fb.control<string | null>(null),
    startDate: this.fb.control<string | null>(null),
    endDate: this.fb.control<string | null>(null),
    every: this.fb.nonNullable.control(1),
    interval: this.fb.nonNullable.control<FrequencyInterval>('month'),
    repeatCount: this.fb.nonNullable.control(1),
    monthMode: this.fb.nonNullable.control<FrequencyMonthMode>('dayOfMonth'),
    dayOfMonth: this.fb.nonNullable.control(1),
    weekOrder: this.fb.nonNullable.control('first'),
    onTheMonth: this.fb.nonNullable.control('january'),
    daysOfWeek: this.fb.nonNullable.control<string[]>([]),
    yearMonth: this.fb.nonNullable.control('january'),
    yearDay: this.fb.nonNullable.control(1),
    times: this.fb.nonNullable.control<string[]>(['']),
  });

  readonly frequencyType = toSignal(
    this.frequencyForm.controls.type.valueChanges.pipe(
      startWith(this.frequencyForm.controls.type.value),
    ),
    { initialValue: 'atOnce' as FrequencyType },
  );

  readonly frequencyInterval = toSignal(
    this.frequencyForm.controls.interval.valueChanges.pipe(
      startWith(this.frequencyForm.controls.interval.value),
    ),
    { initialValue: 'month' as FrequencyInterval },
  );

  readonly frequencyRepeatCount = toSignal(
    this.frequencyForm.controls.repeatCount.valueChanges.pipe(
      startWith(this.frequencyForm.controls.repeatCount.value),
    ),
    { initialValue: 1 },
  );

  /** Indices for Daily time slots (length = repeatCount). */
  readonly dailyTimeSlotIndexes = computed(() => {
    const count = Math.max(1, Number(this.frequencyRepeatCount()) || 1);
    return Array.from({ length: count }, (_, i) => i);
  });

  /**
   * Minimum selectable Schedule End Date for recurring schedules.
   * Null when start/config is incomplete (e.g. weekly with no days).
   */
  readonly frequencyMinEndDate = computed(() => {
    const meta = this.meta();
    if (meta.frequencyType !== 'recurring') {
      return null;
    }
    const start = meta.frequencyStartDate?.trim() || null;
    if (!start) {
      return null;
    }
    return resolveMinimumFrequencyEndDate(start, meta.frequencyRecurring);
  });

  /**
   * End Year options: selected Start Year + next 10 years, then filtered
   * by the existing minimum End Year (startYear + repeat interval).
   */
  readonly frequencyEndYearOptions = computed(() => {
    const meta = this.meta();
    const startYear = this.yearFromYmd(meta.frequencyStartDate);
    if (startYear == null) {
      return [];
    }

    const range = Array.from({ length: 10 }, (_, i) => {
      const year = startYear + 1 + i;
      return { label: String(year), value: year };
    });

    const minYear = this.yearFromYmd(this.frequencyMinEndDate());
    return range.filter((opt) => minYear == null || opt.value >= minYear);
  });

  // ── Dynamic Options ──────────────────────────────────────────
  readonly jobPositionOptions = signal<{ id: string; name: string }[]>([]);
  readonly userOptions = signal<{ id: string; name: string; jobPosition?: string }[]>([]);

  constructor() {
    this.frequencyForm.valueChanges
      .pipe(startWith(this.frequencyForm.getRawValue()), takeUntilDestroyed())
      .subscribe(() => {
        this.enforceYearEveryMax();
        this.enforceMinimumScheduleEndDate();
        this.syncFrequencyToMeta();
      });

    effect(() => {
      const step = this.currentStep();
      const type = this.frequencyType();
      const interval = this.frequencyInterval();
      const dateInput = this.frequencyDateInput();
      const startInput = this.frequencyStartDateInput();
      const endInput = this.frequencyEndDateInput();

      this.destroyFlatpickr();

      if (step !== 3) return;

      if (type === 'atOnce' && dateInput) {
        this.flatpickrInstance = flatpickr(dateInput.nativeElement, {
          dateFormat: 'Y-m-d',
          altInput: true,
          altFormat: 'F j, Y',
          allowInput: false,
          minDate: 'today',
          defaultDate: this.frequencyForm.controls.date.value || undefined,
          onChange: (_selectedDates, dateStr) => {
            this.frequencyForm.controls.date.setValue(dateStr || null, { emitEvent: true });
          },
        });
        return;
      }

      // Yearly uses Start Year / End Year inputs — not date pickers.
      const needsRange =
        type === 'recurring' &&
        (interval === 'day' || interval === 'week' || interval === 'month');

      if (!needsRange || !startInput || !endInput) return;

      const startValue = this.frequencyForm.controls.startDate.value;
      const endValue = this.frequencyForm.controls.endDate.value;
      const endMinDate = this.resolveCurrentMinEndDate() || startValue || 'today';

      this.flatpickrStartInstance = flatpickr(startInput.nativeElement, {
        dateFormat: 'Y-m-d',
        altInput: true,
        altFormat: 'F j, Y',
        allowInput: false,
        minDate: 'today',
        defaultDate: startValue || undefined,
        onChange: (_selectedDates, dateStr) => {
          this.onFrequencyStartDateChange(dateStr || null);
        },
      });

      this.flatpickrEndInstance = flatpickr(endInput.nativeElement, {
        dateFormat: 'Y-m-d',
        altInput: true,
        altFormat: 'F j, Y',
        allowInput: false,
        minDate: endMinDate,
        defaultDate: endValue || undefined,
        onChange: (_selectedDates, dateStr) => {
          this.onFrequencyEndDateChange(dateStr || null);
        },
        onOpen: (_selectedDates, _dateStr, instance) => {
          const minEnd = this.resolveCurrentMinEndDate();
          const currentEnd = this.frequencyForm.controls.endDate.value;
          const focusDate = currentEnd || minEnd;
          if (focusDate) {
            instance.jumpToDate(focusDate, false);
          }
        },
      });

      if (!endValue && endMinDate && endMinDate !== 'today') {
        this.flatpickrEndInstance.jumpToDate(endMinDate, false);
      }
    });

    effect(() => {
      const minEnd = this.frequencyMinEndDate();
      if (!this.flatpickrEndInstance || !minEnd) {
        return;
      }
      this.flatpickrEndInstance.set('minDate', minEnd);
      const currentEnd = this.frequencyForm.controls.endDate.value;
      // Keep the calendar on a month that has selectable dates.
      this.flatpickrEndInstance.jumpToDate(currentEnd || minEnd, false);
    });

    this.frequencyForm.controls.repeatCount.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((count) => this.syncDailyTimesToRepeatCount(Number(count) || 1));

    this.destroyRef.onDestroy(() => this.destroyFlatpickr());
  }

  // ── Step Navigation ──────────────────────────────────────────

  isStepCompleted(stepNum: number): boolean {
    if (stepNum === 1) return this.step1Valid();
    return this.currentStep() > stepNum;
  }

  isStepActive(stepNum: number): boolean {
    return this.currentStep() === stepNum;
  }

  canProceed(): boolean {
    if (this.currentStep() === 1) return this.step1Valid();
    if (this.currentStep() === 2) return this.step2Valid();
    return true;
  }

  nextStep(): void {
    if (this.currentStep() < this.totalSteps && this.canProceed()) {
      this.showBuilderPalette();
      this.currentStep.update((s) => s + 1);
    }
  }

  prevStep(): void {
    if (this.currentStep() > 1) {
      this.showBuilderPalette();
      this.currentStep.update((s) => s - 1);
    }
  }

  goToStep(stepNum: number): void {
    if (stepNum < this.currentStep()) {
      this.showBuilderPalette();
      this.currentStep.set(stepNum);
    }
  }

  /** Header primary action: advance wizard, or persist on the last step. */
  saveAndContinue(): void {
    if (this.isLastStep()) {
      this.save();
      return;
    }
    this.nextStep();
  }

  /** Disabled state for the Figma “Save & continue” control. */
  canSaveAndContinue(): boolean {
    if (this.isLastStep()) {
      return this.canSave() && !this.submitting();
    }
    return this.canProceed();
  }

  /**
   * Edit mode only: enable Update without requiring the user to reach the last tab.
   * Reuses the same canSave / updateTemplate path as the final-step Update action.
   */
  canUpdateExistingTemplate(): boolean {
    return this.isEditing() && this.canSave() && !this.submitting();
  }

  /** Edit mode: persist current changes via the existing update API (no step advance). */
  updateExistingTemplate(): void {
    if (!this.canUpdateExistingTemplate()) {
      return;
    }
    this.save();
  }

  // ── Lifecycle ────────────────────────────────────────────────

  ngOnInit(): void {
    this.formId.set(this.route.snapshot.paramMap.get('id') ?? '');
    this.loadJobPositions();
    this.loadUsers();
    if (this.formId()) {
      this.loadTemplate();
    } else {
      // Create mode: empty template is the clean baseline (not unsaved).
      this.markBaseline();
    }
  }

  canDeactivate(): boolean | Promise<boolean> {
    if (this.allowNavigation || !this.hasUnsavedChanges()) {
      return true;
    }

    this.showUnsavedChangesModal.set(true);
    return new Promise<boolean>((resolve) => {
      this.navigationResolver = resolve;
    });
  }

  /** Meaningful template config changes vs last saved/loaded baseline. */
  hasUnsavedChanges(): boolean {
    if (this.allowNavigation || !this.baselineReady) {
      return false;
    }
    const dirty = this.captureSnapshot() !== this.savedSnapshot;
    if (dirty) {
      this.freezeBaseline = true;
    }
    return dirty;
  }

  canSaveAsDraft(): boolean {
    const hasName = this.formName().trim().length > 0;
    return hasName && !this.savingDraft() && !this.submitting();
  }

  /** Header: save incomplete/complete template via draft endpoint, then leave. */
  saveAsDraft(): void {
    if (!this.canSaveAsDraft()) {
      return;
    }

    this.performSaveDraft()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toastr.success('Draft saved successfully');
          this.freezeBaseline = false;
          this.markBaseline();
          this.leaveAfterSave();
        },
        error: (err) => {
          this.toastr.error(err?.error?.message || 'Failed to save draft');
        },
      });
  }

  onUnsavedStayHere(): void {
    this.showUnsavedChangesModal.set(false);
    if (this.navigationResolver) {
      this.navigationResolver(false);
      this.navigationResolver = null;
    }
  }

  onUnsavedDiscardChanges(): void {
    this.showUnsavedChangesModal.set(false);
    this.allowNavigation = true;
    if (this.navigationResolver) {
      this.navigationResolver(true);
      this.navigationResolver = null;
      return;
    }
    this.router.navigate(['/dynamic-forms']);
  }

  onUnsavedSaveAsDraft(): void {
    if (!this.canSaveAsDraft()) {
      return;
    }

    this.performSaveDraft()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toastr.success('Draft saved successfully');
          this.freezeBaseline = false;
          this.markBaseline();
          this.showUnsavedChangesModal.set(false);
          this.allowNavigation = true;
          if (this.navigationResolver) {
            this.navigationResolver(true);
            this.navigationResolver = null;
            return;
          }
          this.router.navigate(['/dynamic-forms']);
        },
        error: (err) => {
          this.toastr.error(err?.error?.message || 'Failed to save draft');
        },
      });
  }

  private performSaveDraft(): Observable<unknown> {
    this.savingDraft.set(true);
    const body = {
      name: this.formName().trim() || 'Untitled form',
      schema: this.buildPayload(),
    };
    const persistedId = Number(this.formId());
    const request$ =
      Number.isFinite(persistedId) && persistedId > 0
        ? this.formsService.updateTemplateDraft(persistedId, body)
        : this.formsService.saveTemplateDraft(body);

    return request$.pipe(finalize(() => this.savingDraft.set(false)));
  }

  private leaveAfterSave(): void {
    this.allowNavigation = true;
    this.router.navigate(['/dynamic-forms']);
  }

  private captureSnapshot(): string {
    return JSON.stringify({
      formName: this.formName(),
      sections: this.sections(),
      meta: this.meta(),
      logicRules: this.logicRules(),
    });
  }

  private markBaseline(): void {
    if (this.freezeBaseline) {
      return;
    }
    this.savedSnapshot = this.captureSnapshot();
    this.baselineReady = true;
  }

  private loadJobPositions(): void {
    this.jobPositionService
      .getJobPositions(1)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res: any) => {
          const data = res?.data || res;
          if (Array.isArray(data)) {
            this.jobPositionOptions.set(data.map((jp: any) => ({ id: String(jp.id), name: jp.name })));
          }
          this.applyLoadedMeta();
        },
        error: () => {
          this.jobPositionOptions.set([]);
          this.applyLoadedMeta();
        },
      });
  }

  private loadUsers(): void {
    this.formStorageService
      .loadForm('users')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (schema) => {
          const fields = schema?.fields || [];
          const nameField = fields.find((f: any) => f.name === 'name') || fields.find((f: any) => (f.label || '').toLowerCase() === 'name');
          const nameFieldId = nameField?.id || null;

          this.userService
            .getUsers(1)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (res: any) => {
                const data = res?.data || res;
                if (Array.isArray(data)) {
                  this.userOptions.set(data.map((u: any) => ({
                    id: String(u.id),
                    name: nameFieldId ? String(u[nameFieldId] ?? '') : '',
                    jobPosition: u.job_position?.name || u.jobPosition?.name || '',
                  })));
                }
                this.applyLoadedMeta();
              },
              error: () => {
                this.userOptions.set([]);
                this.applyLoadedMeta();
              },
            });
        },
        error: () => {
          this.userService
            .getUsers(1)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (res: any) => {
                const data = res?.data || res;
                if (Array.isArray(data)) {
                  this.userOptions.set(data.map((u: any) => ({
                    id: String(u.id),
                    name: '',
                    jobPosition: u.job_position?.name || u.jobPosition?.name || '',
                  })));
                }
                this.applyLoadedMeta();
              },
              error: () => {
                this.userOptions.set([]);
                this.applyLoadedMeta();
              },
            });
        },
      });
  }

  // ── Edit Mode (load / populate) ───────────────────────────────

  private loadTemplate(): void {
    this.loading.set(true);

    this.formsService
      .getTemplateById(Number(this.formId()))
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (template) => this.populateForm(template),
        error: (err) => {
          this.toastr.error(err?.error?.message || 'Failed to load form template');
        },
      });
  }

  private populateForm(template: SavedDynamicForm): void {
    const payload = template.payload ?? ({} as DynamicFormPayload);

    this.formName.set(payload.formName?.trim() || template.formName || '');
    const sections = this.deserializeSections(payload.sections ?? []);
    this.applyFrequencyToForm(payload);
    this.logicRules.set(normalizeLogicRules(payload.conditionalRules));
    this.loadedSchema = payload;
    this.applyLoadedMeta();

    // Resolve saved dynamic Select IDs → labels for canvas display (payload stays IDs).
    hydrateFormTemplateDynamicSelectOptions(this.formStorageService, sections)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((hydratedSections) => {
        this.sections.set(hydratedSections);
        this.wireRowLocationDependencies();
        this.markBaseline();
      });
  }

  private deserializeSections(
    sections: DynamicFormPayload['sections'],
  ): FormSection[] {
    return (sections ?? []).map((section) => ({
      id: section.id ?? createId('section'),
      name: section.name ?? '',
      type: 'custom' as const,
      rows: (section.rows ?? []).map((row) => ({
        id: createId('row'),
        fields: (row.fields ?? []).map((field) => this.deserializeField(field)),
      })),
    }));
  }

  private deserializeField(
    field: DynamicFormPayload['sections'][number]['rows'][number]['fields'][number] & {
      id?: string;
      selectionType?: string;
      selection_type?: string;
    },
  ): FormFieldConfig {
    const type = field?.type ?? 'text';
    const selectionType =
      type === 'select' ? this.resolveLoadedSelectionType(field) : undefined;

    return {
      ...field,
      id: field?.id ?? createId('field'),
      type,
      label: field?.label ?? '',
      name: field?.name ?? '',
      required: field?.required ?? false,
      selectionType,
      allowDecimal: type === 'number' || (type === 'range' && normalizeRangeType((field as any)?.rangeType) === 'number')
        ? (field as any)?.allowDecimal === true
        : undefined,
      characterLimit: type === 'text' || type === 'textarea'
        ? resolveCharacterLimit(type, (field as { characterLimit?: number })?.characterLimit)
        : undefined,
      rangeType: type === 'range' ? normalizeRangeType((field as any)?.rangeType) : undefined,
      rangeMin: (field as any)?.rangeMin,
      rangeMax: (field as any)?.rangeMax,
      rangeStep:
        type === 'range' && normalizeRangeType((field as any)?.rangeType) === 'number'
          ? (Number((field as any)?.rangeStep) > 0
              ? Number((field as any)?.rangeStep)
              : DEFAULT_RANGE_STEP)
          : undefined,
      rangeMinDate: (field as any)?.rangeMinDate,
      rangeMaxDate: (field as any)?.rangeMaxDate,
      minDate: type === 'date' ? (field as any)?.minDate : undefined,
      maxDate: type === 'date' ? (field as any)?.maxDate : undefined,
      rangePlaceholderFrom: (field as any)?.rangePlaceholderFrom,
      rangePlaceholderTo: (field as any)?.rangePlaceholderTo,
      timeFormat:
        type === 'range' && normalizeRangeType((field as any)?.rangeType) === 'time'
          ? normalizeRangeTimeFormat((field as any)?.timeFormat)
          : undefined,
    };
  }

  private resolveLoadedSelectionType(field: {
    selectionType?: string;
    selection_type?: string;
    optionSource?: { type?: string; endpoint?: string };
  }): 'single' | 'multi' {
    const raw = String(field.selectionType ?? field.selection_type ?? '')
      .trim()
      .toLowerCase();
    return raw === 'multi' || raw === 'multiple' ? 'multi' : 'single';
  }

  private applyFrequencyToForm(payload: DynamicFormPayload): void {
    const frequency = payload.frequency ?? ({} as DynamicFormPayload['frequency']);
    const rawRecurring = frequency.recurring ?? createDefaultFrequencyRecurring();
    // Edit API may expose slots as times / timesAmPm / timesParts (recurring or root).
    const resolvedTimes = resolveFrequencyScheduleTimes(
      rawRecurring,
      frequency as {
        times?: string[] | null;
        timesAmPm?: string[] | null;
        timesParts?: FrequencyTimeParts[] | null;
      },
    );
    const recurring = sanitizeFrequencyRecurring({
      ...rawRecurring,
      times: resolvedTimes,
    });
    const isAtOnce = (frequency.type ?? 'atOnce') === 'atOnce';
    const scheduleTimes = normalizeFrequencyTimes(
      recurring.times,
      recurring.repeatCount,
    );

    // Patch scheduling fields first. `repeatCount` valueChanges syncs/pads `times`
    // from the previous value — always apply saved times afterward so edit restore wins.
    this.frequencyForm.patchValue({
      type: frequency.type ?? 'atOnce',
      date: frequency.date ?? null,
      time: isAtOnce
        ? frequency.time ?? null
        : null,
      startDate: frequency.startDate ?? null,
      endDate: frequency.endDate ?? null,
      every: recurring.every,
      interval: recurring.interval,
      repeatCount: recurring.repeatCount,
      monthMode: 'dayOfMonth',
      dayOfMonth: recurring.dayOfMonth,
      weekOrder: recurring.weekOrder,
      onTheMonth: recurring.onTheMonth,
      daysOfWeek: [...recurring.daysOfWeek],
      yearMonth: recurring.yearMonth,
      yearDay: recurring.yearDay,
    });
    this.frequencyForm.controls.times.setValue(scheduleTimes, { emitEvent: true });
  }

  /** Map saved Assign/Report ids to display names once options are available. */
  private applyLoadedMeta(): void {
    const schema = this.loadedSchema;
    if (!schema) return;

    const userOptions = this.userOptions();
    const positionOptions = this.jobPositionOptions();

    const assign = this.enforceExclusiveUserOrPosition(
      this.resolveSelectedNames(schema.assign?.users, userOptions),
      this.resolveSelectedNames(schema.assign?.jobPosition, positionOptions),
    );
    const report = this.enforceExclusiveUserOrPosition(
      this.resolveSelectedNames(schema.report?.users, userOptions),
      this.resolveSelectedNames(schema.report?.jobPosition, positionOptions),
    );

    this.meta.update((current) => ({
      ...current,
      assignUsers: assign.users,
      assignJobPosition: assign.positions,
      assignMode: normalizeAssignReportMode(schema.assign?.mode),
      reportUsers: report.users,
      reportJobPosition: report.positions,
      reportMode: normalizeAssignReportMode(schema.report?.mode),
      frequencyJobPosition: (schema.frequency?.jobPosition ?? '')
        .split(', ')
        .map((name) => name.trim())
        .filter(Boolean),
    }));

    // Options may resolve after hydrate; refresh baseline until the user edits.
    if (this.isEditing()) {
      this.markBaseline();
    }
  }

  /**
   * Prefer Users when both Users and Job Positions are present (legacy edits).
   * Otherwise preserve whichever side has values.
   */
  private enforceExclusiveUserOrPosition(
    users: string[],
    positions: string[],
  ): { users: string[]; positions: string[] } {
    if (users.length > 0 && positions.length > 0) {
      return { users, positions: [] };
    }
    return { users, positions };
  }

  private resolveSelectedNames(
    ids: number[] | null | undefined,
    options: { id: string; name: string }[],
  ): string[] {
    if (!ids || !ids.length) return [];
    return ids
      .map((id) => options.find((option) => Number(option.id) === id)?.name)
      .filter((name): name is string => !!name);
  }

  /** Restore Country → State → City cascading on the loaded rows. */
  private wireRowLocationDependencies(): void {
    for (const section of this.sections()) {
      for (const row of section.rows) {
        const { country, state, city } = getRowLocationFields(row.fields);
        if (country || state || city) {
          this.initializeRowLocationDependencies(section.id, row.id);
        }
      }
    }
  }

  // ── Frequency helpers ─────────────────────────────────────────

  isWeekdaySelected(day: string): boolean {
    return this.frequencyForm.controls.daysOfWeek.value.includes(day);
  }

  toggleWeekday(day: string): void {
    const current = this.frequencyForm.controls.daysOfWeek.value;
    const next = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day];
    this.frequencyForm.controls.daysOfWeek.setValue(next);
  }

  // ── Frequency Custom Select Helpers ───────────────────────────

  getFreqSelectLabel(
    controlName: 'type' | 'interval' | 'yearMonth',
    options: { label: string; value: string }[],
    placeholder: string,
  ): string {
    const val = this.frequencyForm.controls[controlName].value;
    const match = options.find((o) => o.value === val);
    return match?.label ?? placeholder;
  }

  selectFreqOption(
    controlName: 'type' | 'interval' | 'yearMonth',
    value: string,
    dropdownSignal: WritableSignal<boolean>,
    searchSignal: WritableSignal<string>,
  ): void {
    const previous = this.frequencyForm.controls[controlName].value;
    this.frequencyForm.get(controlName)?.setValue(value);

    if (controlName === 'type' && previous !== value) {
      this.resetFieldsForFrequencyType(value as FrequencyType);
    }

    if (controlName === 'interval' && previous !== value) {
      this.resetFieldsForInterval(value as FrequencyInterval);
    }

    searchSignal.set('');
    dropdownSignal.set(false);
  }

  onFreqSearch(event: Event, searchSignal: WritableSignal<string>): void {
    searchSignal.set((event.target as HTMLInputElement).value);
  }

  /** Clear the opposite type's scheduling fields when switching At Once ↔ Recurring. */
  private resetFieldsForFrequencyType(type: FrequencyType): void {
    if (type === 'atOnce') {
      this.frequencyForm.patchValue({
        startDate: null,
        endDate: null,
        times: [],
        time: null,
        daysOfWeek: [],
      });
      return;
    }

    const repeatCount = Math.max(
      1,
      Number(this.frequencyForm.controls.repeatCount.value) || 1,
    );
    this.frequencyForm.patchValue({
      date: null,
      time: null,
      startDate: null,
      endDate: null,
      times: normalizeFrequencyTimes([], repeatCount),
    });
    this.resetFieldsForInterval(this.frequencyForm.controls.interval.value);
  }

  /** Clear schedule fields that belong to other intervals after a unit switch. */
  private resetFieldsForInterval(interval: FrequencyInterval): void {
    const defaults = createDefaultFrequencyRecurring();
    const repeatCount = Math.max(
      1,
      Number(this.frequencyForm.controls.repeatCount.value) || 1,
    );
    switch (interval) {
      case 'day':
        this.frequencyForm.patchValue({
          daysOfWeek: [],
          monthMode: 'dayOfMonth',
          dayOfMonth: defaults.dayOfMonth,
          weekOrder: defaults.weekOrder,
          onTheMonth: defaults.onTheMonth,
          yearMonth: defaults.yearMonth,
          yearDay: defaults.yearDay,
          time: null,
          times: normalizeFrequencyTimes(
            this.frequencyForm.controls.times.value,
            repeatCount,
          ),
          endDate: null,
        });
        break;
      case 'week':
        this.frequencyForm.patchValue({
          monthMode: 'dayOfMonth',
          dayOfMonth: defaults.dayOfMonth,
          weekOrder: defaults.weekOrder,
          onTheMonth: defaults.onTheMonth,
          yearMonth: defaults.yearMonth,
          yearDay: defaults.yearDay,
          time: null,
          times: normalizeFrequencyTimes(
            this.frequencyForm.controls.times.value,
            repeatCount,
          ),
          endDate: null,
        });
        break;
      case 'month':
        this.frequencyForm.patchValue({
          daysOfWeek: [],
          monthMode: 'dayOfMonth',
          weekOrder: defaults.weekOrder,
          onTheMonth: defaults.onTheMonth,
          yearMonth: defaults.yearMonth,
          yearDay: defaults.yearDay,
          time: null,
          times: normalizeFrequencyTimes(
            this.frequencyForm.controls.times.value,
            repeatCount,
          ),
          endDate: null,
        });
        break;
      case 'year':
        this.frequencyForm.patchValue({
          daysOfWeek: [],
          monthMode: 'dayOfMonth',
          dayOfMonth: defaults.dayOfMonth,
          weekOrder: defaults.weekOrder,
          onTheMonth: defaults.onTheMonth,
          time: null,
          times: normalizeFrequencyTimes(
            this.frequencyForm.controls.times.value,
            repeatCount,
          ),
          endDate: null,
          every: Math.min(
            10,
            Math.max(1, Number(this.frequencyForm.controls.every.value) || 1),
          ),
        });
        break;
    }

    if (this.flatpickrEndInstance) {
      this.flatpickrEndInstance.clear();
    }
  }

  private syncFrequencyToMeta(): void {
    const value = this.frequencyForm.getRawValue();
    const repeatCount = Math.max(1, Number(value.repeatCount) || 1);
    this.meta.update((current) => ({
      ...current,
      frequencyDate: value.date,
      frequencyTime: value.time,
      frequencyStartDate: value.startDate,
      frequencyEndDate: value.endDate,
      frequencyType: value.type,
      frequencyRecurring: sanitizeFrequencyRecurring({
        every: Number(value.every) || 1,
        interval: value.interval,
        repeatCount,
        daysOfWeek: [...value.daysOfWeek],
        monthMode: 'dayOfMonth',
        dayOfMonth: Number(value.dayOfMonth),
        weekOrder: value.weekOrder,
        onTheMonth: value.onTheMonth,
        yearMonth: value.yearMonth,
        yearDay: Number(value.yearDay) || 1,
        time: value.time,
        times: normalizeFrequencyTimes(value.times, repeatCount),
      }),
    }));
  }

  private syncDailyTimesToRepeatCount(repeatCount: number): void {
    if (this.frequencyForm.controls.type.value !== 'recurring') {
      return;
    }
    const next = normalizeFrequencyTimes(
      this.frequencyForm.controls.times.value,
      repeatCount,
    );
    this.frequencyForm.controls.times.setValue(next, { emitEvent: true });
  }

  /**
   * Required scheduling fields for At Once / Daily / Weekly / Monthly / Yearly.
   * Reads `meta()` so `canSave` recomputes when frequency fields change.
   */
  isFrequencyScheduleValid(): boolean {
    const meta = this.meta();
    if (meta.frequencyType === 'atOnce') {
      return !!meta.frequencyDate?.trim() && isValidTimeFieldValue(meta.frequencyTime);
    }

    if (meta.frequencyType !== 'recurring') {
      return true;
    }

    const recurring = meta.frequencyRecurring;
    const every = Math.max(1, Number(recurring.every) || 1);
    if (recurring.interval === 'year' && every > 10) {
      return false;
    }

    const start = meta.frequencyStartDate?.trim() || '';
    const end = meta.frequencyEndDate?.trim() || '';
    if (!start || !end) {
      return false;
    }

    const minEnd = resolveMinimumFrequencyEndDate(start, recurring);
    if (minEnd && end < minEnd) {
      return false;
    }
    if (!minEnd && end < start) {
      return false;
    }

    if (recurring.interval === 'day' ||
      recurring.interval === 'week' ||
      recurring.interval === 'month' ||
      recurring.interval === 'year'
    ) {
      const times = normalizeFrequencyTimes(recurring.times, recurring.repeatCount);
      return times.every((slot) => isValidTimeFieldValue(slot));
    }

    return isValidTimeFieldValue(recurring.time);
  }

  /**
   * Yearly "Repeat every" is capped at 10. Day/Week/Month keep existing behavior.
   */
  private enforceYearEveryMax(): void {
    const value = this.frequencyForm.getRawValue();
    if (value.type !== 'recurring' || value.interval !== 'year') {
      return;
    }
    const every = Number(value.every);
    if (!Number.isFinite(every) || every <= 10) {
      return;
    }
    this.frequencyForm.controls.every.setValue(10, { emitEvent: false });
  }

  /**
   * Clear Schedule End Date when it no longer satisfies the current
   * recurrence minimum (do not clamp to a stale/auto value).
   */
  private enforceMinimumScheduleEndDate(): void {
    const minEnd = this.resolveCurrentMinEndDate();
    const end = this.frequencyForm.controls.endDate.value?.trim() || null;
    if (!end) {
      return;
    }

    if (minEnd && end < minEnd) {
      this.clearFrequencyEndDate();
      return;
    }

    const start = this.frequencyForm.controls.startDate.value?.trim() || null;
    if (!minEnd && start && end < start) {
      this.clearFrequencyEndDate();
    }
  }

  private clearFrequencyEndDate(): void {
    this.frequencyForm.controls.endDate.setValue(null, { emitEvent: false });
    if (this.flatpickrEndInstance) {
      this.flatpickrEndInstance.clear();
      const minEnd = this.resolveCurrentMinEndDate();
      if (minEnd) {
        this.flatpickrEndInstance.set('minDate', minEnd);
        this.flatpickrEndInstance.jumpToDate(minEnd, false);
      }
    }
  }

  /** Compute min end date from the live frequency form (not meta). */
  private resolveCurrentMinEndDate(): string | null {
    const value = this.frequencyForm.getRawValue();
    if (value.type !== 'recurring') {
      return null;
    }

    const start = value.startDate?.trim() || null;
    if (!start) {
      return null;
    }

    const repeatCount = Math.max(1, Number(value.repeatCount) || 1);
    const recurring = sanitizeFrequencyRecurring({
      every: Number(value.every) || 1,
      interval: value.interval,
      repeatCount,
      daysOfWeek: [...value.daysOfWeek],
      monthMode: 'dayOfMonth',
      dayOfMonth: Number(value.dayOfMonth),
      weekOrder: value.weekOrder,
      onTheMonth: value.onTheMonth,
      yearMonth: value.yearMonth,
      yearDay: Number(value.yearDay) || 1,
      time: value.time,
      times: normalizeFrequencyTimes(value.times, repeatCount),
    });

    return resolveMinimumFrequencyEndDate(start, recurring);
  }

  /** Year value stored in startDate (`YYYY-01-01`) for yearly schedules. */
  frequencyStartYear(): number | null {
    return this.yearFromYmd(this.frequencyForm.controls.startDate.value);
  }

  /** Year value stored in endDate (`YYYY-01-01`) for yearly schedules. */
  frequencyEndYear(): number | null {
    return this.yearFromYmd(this.frequencyForm.controls.endDate.value);
  }

  /** Minimum selectable End Year for the current yearly config (startYear + every). */
  frequencyMinEndYear(): number | null {
    const minEnd = this.frequencyMinEndDate();
    return this.yearFromYmd(minEnd);
  }

  onFrequencyStartYearChange(raw: string): void {
    const year = Number(raw);
    if (!Number.isFinite(year)) {
      this.frequencyForm.controls.startDate.setValue(null);
      return;
    }
    this.frequencyForm.controls.startDate.setValue(`${Math.floor(year)}-01-01`);
    this.enforceMinimumScheduleEndDate();
  }

  onFrequencyEndYearChange(raw: string): void {
    const year = Number(raw);
    if (!Number.isFinite(year)) {
      this.clearFrequencyEndDate();
      return;
    }
    const minYear = this.frequencyMinEndYear();
    const nextYear = Math.floor(year);
    if (minYear != null && nextYear < minYear) {
      this.clearFrequencyEndDate();
      return;
    }
    this.frequencyForm.controls.endDate.setValue(`${nextYear}-01-01`);
  }

  private yearFromYmd(value: string | null | undefined): number | null {
    if (!value || !/^\d{4}/.test(value)) {
      return null;
    }
    const year = Number(value.slice(0, 4));
    return Number.isFinite(year) ? year : null;
  }

  dailyTimeSlotLabel(index: number): string {
    const count = this.dailyTimeSlotIndexes().length;
    if (count === 1) {
      return 'Time';
    }
    return `Assignment time ${index + 1}`;
  }

  frequencyTimeHour(value: string | null | undefined): number | null {
    return getTimeHour12(value);
  }

  frequencyTimeMinute(value: string | null | undefined): number | null {
    return getTimeMinute(value);
  }

  frequencyTimeMeridiem(value: string | null | undefined): TimeMeridiem | null {
    return getTimeMeridiem(value);
  }

  onFrequencyTimePartChange(
    target: 'single' | number,
    part: 'hour' | 'minute' | 'meridiem',
    raw: string,
  ): void {
    const current =
      target === 'single'
        ? this.frequencyForm.controls.time.value
        : this.frequencyForm.controls.times.value[target] ?? null;

    let hour = getTimeHour12(current) ?? 12;
    let minute = getTimeMinute(current) ?? 0;
    let meridiem = getTimeMeridiem(current) ?? 'AM';

    if (part === 'hour') {
      const parsed = Number(raw);
      hour = Number.isFinite(parsed) ? parsed : hour;
    } else if (part === 'minute') {
      const parsed = Number(raw);
      minute = Number.isFinite(parsed) ? parsed : minute;
    } else if (raw === 'AM' || raw === 'PM') {
      meridiem = raw;
    }

    const next = composeTimeFrom12h(hour, minute, meridiem);

    if (target === 'single') {
      this.frequencyForm.controls.time.setValue(next);
      return;
    }

    const times = [...this.frequencyForm.controls.times.value];
    times[target] = next ?? '';
    this.frequencyForm.controls.times.setValue(times);
  }

  onFrequencyStartDateChange(value: string | null): void {
    this.frequencyForm.controls.startDate.setValue(value);
    this.enforceMinimumScheduleEndDate();
  }

  onFrequencyEndDateChange(value: string | null): void {
    const minEnd = this.resolveCurrentMinEndDate();
    if (value && minEnd && value < minEnd) {
      this.clearFrequencyEndDate();
      return;
    }
    this.frequencyForm.controls.endDate.setValue(value);
  }

  private destroyFlatpickr(): void {
    if (this.flatpickrInstance) {
      this.flatpickrInstance.destroy();
      this.flatpickrInstance = null;
    }
    if (this.flatpickrStartInstance) {
      this.flatpickrStartInstance.destroy();
      this.flatpickrStartInstance = null;
    }
    if (this.flatpickrEndInstance) {
      this.flatpickrEndInstance.destroy();
      this.flatpickrEndInstance = null;
    }
  }

  // ── Section Management ────────────────────────────────────────

  openAddSectionDialog(): void {
    this.sectionDialogMode.set('create');
    this.editingSectionId.set(null);
    this.sectionNameInput.set('');
    this.sectionNameError.set('');
    this.sectionDialogOpen.set(true);
  }

  /** Figma empty-state CTA — same dialog as Add Section. */
  addFirstSection(): void {
    this.openAddSectionDialog();
  }

  isSectionCollapsed(sectionId: string): boolean {
    return this.collapsedSectionIds().has(sectionId);
  }

  toggleSectionCollapsed(sectionId: string): void {
    this.collapsedSectionIds.update((current) => {
      const next = new Set(current);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }

  /** Duplicate a section (new ids for section, rows, and fields). */
  duplicateSection(section: CustomFormSection): void {
    const copyName = `${section.name} Copy`;
    let name = copyName;
    let suffix = 2;
    while (
      this.sections().some(
        (item) => item.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase(),
      )
    ) {
      name = `${copyName} ${suffix}`;
      suffix += 1;
    }

    const duplicated: CustomFormSection = {
      ...createCustomSection(name),
      rows: section.rows.map((row) => ({
        id: createId('row'),
        fields: row.fields.map((field) => ({
          ...field,
          id: createId('field'),
          name: `${field.name}_copy`,
          isDefault: false,
        })),
      })),
    };

    this.sections.update((list) => {
      const index = list.findIndex((item) => item.id === section.id);
      if (index < 0) {
        return [...list, duplicated];
      }
      const next = [...list];
      next.splice(index + 1, 0, duplicated);
      return next;
    });
  }

  /** True when a row still has Width-in-row capacity for another column. */
  rowCanAddColumn(row: FormRow): boolean {
    return rowHasAvailableColumnSpace(row.fields);
  }

  /** Remaining 12-col units in a row (for sizing the Add column slot). */
  rowRemainingUnits(row: FormRow): number {
    return rowRemainingGridUnits(row.fields);
  }

  /** Flex basis for the Add column drop target based on leftover capacity. */
  rowAddColumnFlexBasis(row: FormRow): string {
    const remaining = this.rowRemainingUnits(row);
    if (remaining <= 0) {
      return '0%';
    }
    return `calc(${(remaining / 12) * 100}% - 0.5rem)`;
  }

  /** Width of the canvas band that already holds fields in this row. */
  rowUsedFlexBasis(row: FormRow): string {
    const used = Math.max(0, 12 - this.rowRemainingUnits(row));
    if (used <= 0) {
      return '100%';
    }
    return `calc(${(used / 12) * 100}% - 0.5rem)`;
  }

  selectedFieldWidthCapacityHint = computed((): string | null => {
    const field = this.selectedBuilderField();
    if (!field) {
      return null;
    }
    const allowed = this.selectedFieldAvailableWidthPresets();
    if (allowed.length >= 3) {
      return null;
    }
    return 'This width cannot fit because the row is already occupied.';
  });

  /** Width presets allowed for the selected field in its current row. */
  selectedFieldAvailableWidthPresets = computed((): RowWidthPreset[] => {
    const field = this.selectedBuilderField();
    if (!field) {
      return ['third', 'half', 'full'];
    }
    const location = this.findFieldLocation(field.id);
    if (!location) {
      return ['third', 'half', 'full'];
    }
    const rowFields = this.getRowCanvasSchema(location.sectionId, location.rowId);
    return availableRowWidthPresetsForField(rowFields, field.id);
  });

  rowCanvasListId(sectionId: string, rowId: string): string {
    return `createFormCanvas_${sectionId}_${rowId}`;
  }

  /** Visible “Add column / drop a field here” sink beside a row. */
  rowAddColumnListId(sectionId: string, rowId: string): string {
    return `createFormAddCol_${sectionId}_${rowId}`;
  }

  sectionNewRowListId(sectionId: string): string {
    return `createFormNewRow_${sectionId}`;
  }

  getRowCanvasSchema(sectionId: string, rowId: string): FormField[] {
    return this.rowCanvasSchemas().get(`${sectionId}:${rowId}`) ?? [];
  }

  focusWorkspaceRow(sectionId: string, rowId: string): void {
    this.pendingFieldTarget.set({ sectionId, rowId });
    this.initializeRowBuilderFields();
    this.fieldBuilderOpen.set(true);
  }

  onSelectWorkspaceField(
    sectionId: string,
    rowId: string,
    field: FormField,
  ): void {
    this.focusWorkspaceRow(sectionId, rowId);
    this.onSelectField(field);
  }

  /**
   * Empty canvas: first palette drop creates Section 1 + a row and commits the field.
   */
  onEmptyCanvasDrop(event: CdkDragDrop<FormField[]>): void {
    if (event.previousContainer === event.container || this.hasSections()) {
      return;
    }

    const result = applyCanvasDrop(event, []);
    if (!result.insertedField) {
      return;
    }

    const section = createCustomSection(this.nextDefaultSectionName());
    const row = createEmptyRow();
    const mapped = mapBuilderFieldToConfig(result.insertedField, {
      preserveId: true,
    });

    hydrateFormTemplateDynamicSelectField(this.formStorageService, mapped)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((hydrated) => {
        const field: FormFieldConfig = {
          ...hydrated,
          isDefault: false,
          value: hydrated.value ?? '',
        };
        this.sections.set([
          {
            ...section,
            rows: [{ ...row, fields: [field] }],
          },
        ]);
        this.focusWorkspaceRow(section.id, row.id);
        this.onSelectField(mapConfigFieldToBuilder(field));
        this.initializeRowLocationDependencies(section.id, row.id);
      });
  }

  /** Drop onto an existing row canvas — insert/reorder and commit immediately. */
  onWorkspaceRowDrop(
    sectionId: string,
    rowId: string,
    event: CdkDragDrop<FormField[]>,
  ): void {
    this.focusWorkspaceRow(sectionId, rowId);
    const current = this.getRowCanvasSchema(sectionId, rowId);

    // Cross-container insert: if this row has no remaining capacity, start a new row.
    if (event.previousContainer !== event.container) {
      const remaining = rowRemainingGridUnits(current);
      if (current.length > 0 && remaining < 4) {
        this.onSectionNewRowDrop(sectionId, event);
        return;
      }
    }

    const result = applyCanvasDrop(event, current);

    if (event.previousContainer === event.container) {
      this.replaceRowFieldsFromBuilder(sectionId, rowId, result.schema);
      return;
    }

    const inserted = result.insertedField;
    if (!inserted) {
      this.replaceRowFieldsFromBuilder(sectionId, rowId, result.schema);
      return;
    }

    const siblings = result.schema.filter((field) => field.id !== inserted.id);
    const fittingWidth = largestFittingBuilderWidth(
      rowRemainingGridUnits(siblings),
    );
    const widthAdjusted: FormField = {
      ...inserted,
      width: fittingWidth > 0 ? fittingWidth : normalizeBuilderWidthUnits(inserted.width),
    };

    const mapped = mapBuilderFieldToConfig(widthAdjusted, { preserveId: true });
    hydrateFormTemplateDynamicSelectField(this.formStorageService, mapped)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((hydrated) => {
        const builderHydrated = mapConfigFieldToBuilder(hydrated);
        const nextSchema = result.schema.map((field) =>
          field.id === inserted.id ? builderHydrated : field,
        );
        this.replaceRowFieldsFromBuilder(sectionId, rowId, nextSchema);
        this.focusWorkspaceRow(sectionId, rowId);
        this.onSelectField(builderHydrated);
        this.initializeRowLocationDependencies(sectionId, rowId);
      });
  }

  /**
   * Drop onto the visible “Add column / drop a field here” slot —
   * appends a new column on the same row when capacity allows.
   */
  onRowAddColumnDrop(
    sectionId: string,
    rowId: string,
    event: CdkDragDrop<FormField[]>,
  ): void {
    if (event.previousContainer === event.container) {
      return;
    }

    const current = this.getRowCanvasSchema(sectionId, rowId);
    if (!rowHasAvailableColumnSpace(current)) {
      // Row is full — place the field on a new row instead of overflowing.
      this.onSectionNewRowDrop(sectionId, event);
      return;
    }

    // Append after existing columns (ignore sink index 0 on the empty list).
    const appendEvent = {
      ...event,
      currentIndex: current.length,
    } as CdkDragDrop<FormField[]>;

    this.onWorkspaceRowDrop(sectionId, rowId, appendEvent);
  }

  /** Drop below a section to append a new row with the dragged field. */
  onSectionNewRowDrop(
    sectionId: string,
    event: CdkDragDrop<FormField[]>,
  ): void {
    if (event.previousContainer === event.container) {
      return;
    }

    const result = applyCanvasDrop(event, []);
    if (!result.insertedField) {
      return;
    }

    const row = createEmptyRow();
    const mapped = mapBuilderFieldToConfig(result.insertedField, {
      preserveId: true,
    });

    hydrateFormTemplateDynamicSelectField(this.formStorageService, mapped)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((hydrated) => {
        const field: FormFieldConfig = {
          ...hydrated,
          isDefault: false,
          value: hydrated.value ?? '',
        };
        this.sections.update((list) =>
          list.map((section) =>
            section.id === sectionId
              ? { ...section, rows: [...section.rows, { ...row, fields: [field] }] }
              : section,
          ),
        );
        this.focusWorkspaceRow(sectionId, row.id);
        this.onSelectField(mapConfigFieldToBuilder(field));
        this.initializeRowLocationDependencies(sectionId, row.id);
      });
  }

  private nextDefaultSectionName(): string {
    let n = this.sections().length + 1;
    let name = `Section ${n}`;
    while (
      this.sections().some(
        (section) => section.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase(),
      )
    ) {
      n += 1;
      name = `Section ${n}`;
    }
    return name;
  }

  private replaceRowFieldsFromBuilder(
    sectionId: string,
    rowId: string,
    schema: FormField[],
  ): void {
    const configs = schema.map((field) => {
      const mapped = mapBuilderFieldToConfig(field, { preserveId: true });
      return {
        ...mapped,
        isDefault: false,
        value: mapped.value ?? '',
      };
    });
    this.patchRowFields(sectionId, rowId, () => configs);
    this.rowBuilderFields.set(schema);
  }

  private findFieldLocation(
    fieldId: string,
  ): { sectionId: string; rowId: string } | null {
    for (const section of this.sections()) {
      for (const row of section.rows) {
        if (row.fields.some((field) => field.id === fieldId)) {
          return { sectionId: section.id, rowId: row.id };
        }
      }
    }
    return null;
  }

  openRenameSectionDialog(section: CustomFormSection): void {
    this.sectionDialogMode.set('rename');
    this.editingSectionId.set(section.id);
    this.sectionNameInput.set(section.name);
    this.sectionNameError.set('');
    this.sectionDialogOpen.set(true);
  }

  closeSectionDialog(): void {
    this.sectionDialogOpen.set(false);
    this.editingSectionId.set(null);
    this.sectionNameInput.set('');
    this.sectionNameError.set('');
  }

  onSectionNameInput(value: string): void {
    this.sectionNameInput.set(value);
    if (this.sectionNameError()) {
      this.sectionNameError.set('');
    }
  }

  saveSection(): void {
    const name = this.sectionNameInput().trim();
    if (!name) {
      this.sectionNameError.set('Section name is required.');
      return;
    }

    const editingId = this.editingSectionId();
    const duplicate = this.sections().some(
      (section) =>
        section.id !== editingId &&
        section.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase(),
    );
    if (duplicate) {
      this.sectionNameError.set('A section with this name already exists.');
      return;
    }

    if (this.sectionDialogMode() === 'rename' && editingId) {
      this.sections.update((list) =>
        list.map((section) =>
          section.id === editingId ? { ...section, name } : section,
        ),
      );
    } else {
      // Start with no rows so the Figma empty-section state is shown.
      this.sections.update((list) => [...list, createCustomSection(name)]);
    }

    this.closeSectionDialog();
  }

  updateSection(updated: FormSection): void {
    this.sections.update((list) =>
      list.map((section) => (section.id === updated.id ? updated : section)),
    );
  }

  requestRemoveSection(section: CustomFormSection): void {
    this.sectionPendingRemoval.set(section);
  }

  cancelRemoveSection(): void {
    this.sectionPendingRemoval.set(null);
  }

  confirmRemoveSection(): void {
    const section = this.sectionPendingRemoval();
    if (!section) return;

    const deletedIds = section.rows.flatMap((row) =>
      row.fields.map((field) => field.id),
    );
    if (deletedIds.length) {
      this.logicRules.set(
        pruneLogicRulesForDeletedFields(this.logicRules(), deletedIds),
      );
    }

    this.sections.update((list) => list.filter((item) => item.id !== section.id));
    this.sectionPendingRemoval.set(null);
  }

  addSectionRow(section: CustomFormSection): void {
    this.updateSection({
      ...section,
      rows: [...section.rows, createEmptyRow()],
    });
  }

  removeSectionRow(section: CustomFormSection, rowId: string): void {
    const row = section.rows.find((item) => item.id === rowId);
    const deletedIds = (row?.fields ?? []).map((field) => field.id);
    if (deletedIds.length) {
      this.logicRules.set(
        pruneLogicRulesForDeletedFields(this.logicRules(), deletedIds),
      );
    }

    this.updateSection({
      ...section,
      rows: section.rows.filter((item) => item.id !== rowId),
    });
  }

  removeSectionField(section: CustomFormSection, rowId: string, fieldId: string): void {
    const row = section.rows.find((item) => item.id === rowId);
    const field = row?.fields.find((item) => item.id === fieldId);
    if (!row || !field) return;

    const blockReason = getLocationFieldDeleteBlockReason(
      mapConfigFieldToBuilder(field),
      row.fields.map(mapConfigFieldToBuilder),
    );
    if (blockReason) {
      return;
    }

    this.logicRules.set(
      pruneLogicRulesForDeletedFields(this.logicRules(), [fieldId]),
    );

    this.updateSection({
      ...section,
      rows: section.rows.map((item) =>
        item.id === rowId
          ? { ...item, fields: item.fields.filter((f) => f.id !== fieldId) }
          : item,
      ),
    });
  }

  updateSectionFieldValue(
    section: CustomFormSection,
    rowId: string,
    fieldId: string,
    value: string | string[],
  ): void {
    const row = section.rows.find((item) => item.id === rowId);
    if (!row) return;

    const nextFields = row.fields.map((field) =>
      field.id === fieldId ? { ...field, value } : field,
    );

    this.updateSection({
      ...section,
      rows: section.rows.map((item) =>
        item.id === rowId ? { ...item, fields: nextFields } : item,
      ),
    });

    const dependencyValue = Array.isArray(value) ? value[0] ?? '' : value;
    this.applyRowLocationDependencies(
      section.id,
      rowId,
      fieldId,
      dependencyValue,
      nextFields,
    );
  }

  sectionHasFields(section: CustomFormSection): boolean {
    return section.rows.some((row) => row.fields.length > 0);
  }

  getRowConditionalEffects(row: { fields: FormFieldConfig[] }) {
    return resolveCollectionConditionalEffects(row.fields);
  }

  onExistingRowFieldsDrop(event: CdkDragDrop<FormFieldConfig[]>): void {
    if (
      event.previousContainer !== event.container ||
      event.previousIndex === event.currentIndex
    ) {
      return;
    }

    const target = this.pendingFieldTarget();
    if (!target) return;

    this.sections.update((list) =>
      list.map((section) => {
        if (section.id !== target.sectionId) {
          return section;
        }

        return {
          ...section,
          rows: section.rows.map((row) => {
            if (row.id !== target.rowId) return row;
            const fields = [...row.fields];
            moveItemInArray(fields, event.previousIndex, event.currentIndex);
            return { ...row, fields };
          }),
        };
      }),
    );

    this.initializeRowBuilderFields();
  }

  onExistingRowFieldDragStarted(): void {
    this.isReorderingExistingFields = true;
  }

  onExistingRowFieldDragEnded(): void {
    setTimeout(() => {
      this.isReorderingExistingFields = false;
    });
  }

  openFieldBuilderForSection(section: CustomFormSection): void {
    // Ensure the first field targets an existing first row (or a stable new row id).
    const rowId = section.rows[0]?.id ?? createId('row');
    this.openFieldModal({ sectionId: section.id, rowId });
  }

  /**
   * Open Form Builder on the field's row and select it in Customize mode
   * (same path as clicking the field inside the builder canvas).
   */
  editSectionField(
    section: CustomFormSection,
    rowId: string,
    field: FormFieldConfig,
  ): void {
    this.openFieldModal({ sectionId: section.id, rowId }, field.id);
  }

  openFieldModal(
    target: { sectionId: string; rowId: string },
    selectFieldId?: string,
  ): void {
    this.pendingFieldTarget.set(target);
    this.initializeRowBuilderFields();
    this.builderSchema.set([]);
    this.fieldBuilderOpen.set(true);

    if (selectFieldId && this.rowBuilderFields().some((item) => item.id === selectFieldId)) {
      this.selectedFieldId.set(selectFieldId);
      this.builderActiveTab.set('settings');
      return;
    }

    this.selectedFieldId.set(null);
    this.builderActiveTab.set('fields');
  }

  closeFieldBuilder(): void {
    const target = this.pendingFieldTarget();
    this.fieldBuilderOpen.set(false);
    this.logicOverviewOpen.set(false);
    this.pendingFieldTarget.set(null);
    this.builderActiveTab.set('fields');
    this.resetBuilderDraft();

    // Strip any all-States/all-Cities options that live field edits may have written.
    // Never let location refresh block exiting the builder after a successful Save.
    if (target) {
      try {
        this.initializeRowLocationDependencies(target.sectionId, target.rowId);
      } catch {
        // Location cascade refresh is best-effort; form fields are already persisted.
      }
    }
  }

  onBuilderActiveTabChange(tab: FormBuilderTab): void {
    // Automation Rules / Versions removed from Form Template builder chrome.
    if (tab === 'logic' || tab === 'versions') {
      return;
    }
    // Input Fields and Input Customization are mutually exclusive.
    if (tab === 'fields') {
      this.showBuilderPalette();
      return;
    }
    if (tab === 'settings' && !this.selectedFieldId()) {
      return;
    }
    this.builderActiveTab.set(tab);
  }

  /** Hide Input Customization, clear canvas selection, show Input Fields. */
  showBuilderPalette(): void {
    this.selectedFieldId.set(null);
    this.builderActiveTab.set('fields');
  }

  onSelectExistingRowField(field: FormFieldConfig): void {
    if (this.isReorderingExistingFields) return;

    const builderField = this.rowBuilderFields().find((item) => item.id === field.id);
    if (builderField) {
      this.selectedFieldId.set(builderField.id);
      this.builderActiveTab.set('settings');
    }
  }

  onCanvasDrop(event: Parameters<typeof applyCanvasDrop>[0]): void {
    const result = applyCanvasDrop(event, this.builderSchema());
    this.builderSchema.set(result.schema);
    if (result.insertedField) {
      this.onSelectField(result.insertedField);
    }
  }

  onSelectField(field: FormField): void {
    this.selectedFieldId.set(field.id);
    this.builderActiveTab.set('settings');
  }

  /**
   * Form Template canvas shortcut: open existing Conditional Logic modal for a field.
   * Selects the field so field-settings (and its modal) load the correct context.
   */
  onOpenFieldConditionalLogic(field: FormField): void {
    this.logicOverviewOpen.set(false);
    const location = this.findFieldLocation(field.id);
    if (location) {
      this.focusWorkspaceRow(location.sectionId, location.rowId);
    }
    this.selectedFieldId.set(field.id);
    this.builderActiveTab.set('settings');
    this.cdr.detectChanges();
    this.fieldSettings()?.openConditionModal();
  }

  /**
   * Form Template canvas shortcut: open existing Automation Rules editor popup.
   */
  onOpenFieldAutomationRules(field: FormField): void {
    this.logicOverviewOpen.set(false);
    const location = this.findFieldLocation(field.id);
    if (location) {
      this.focusWorkspaceRow(location.sectionId, location.rowId);
    }
    this.selectedFieldId.set(field.id);
    this.cdr.detectChanges();

    const existing = findLogicRulesUsingField(this.logicRules(), field.id);
    const panel = this.logicRulesPanel();
    if (!panel) {
      return;
    }

    if (existing.length) {
      panel.openEditEditor(existing[0], field.id);
      return;
    }

    panel.openCreateEditor(field.id);
  }

  onExistingFieldQuickAction(
    event: Event,
    field: FormFieldConfig,
    action: 'condition' | 'automation',
  ): void {
    event.preventDefault();
    event.stopPropagation();

    if (this.isReorderingExistingFields) {
      return;
    }

    const builderField = this.rowBuilderFields().find((item) => item.id === field.id);
    if (!builderField) {
      return;
    }

    if (action === 'condition') {
      this.onOpenFieldConditionalLogic(builderField);
      return;
    }

    this.onOpenFieldAutomationRules(builderField);
  }

  fieldHasConfiguredConditionalLogic(field: FormField | FormFieldConfig): boolean {
    const logic = normalizeConditionalLogic(field.condition ?? null);
    return !!logic?.enabled && hasConfiguredSource(logic);
  }

  normalizeConditionEnabled(field: FormField | FormFieldConfig): boolean {
    return !!normalizeConditionalLogic(field.condition ?? null)?.enabled;
  }

  getConditionSourceId(field: FormField): string {
    return getPrimaryPredicate(normalizeConditionalLogic(field.condition ?? null)).fieldId;
  }

  getConditionSourceLabel(field: FormField): string {
    const sourceId = this.getConditionSourceId(field);
    return (
      this.logicSchemaFields().find((item) => item.id === sourceId)?.label ||
      'No field chosen yet'
    );
  }

  getLogicSchemaField(fieldId: string): FormField | undefined {
    return this.logicSchemaFields().find((item) => item.id === fieldId);
  }

  fieldHasAutomationRules(fieldId: string): boolean {
    return findLogicRulesUsingField(this.logicRules(), fieldId).length > 0;
  }

  openLogicOverview(tab: 'logicMap' | 'automationMap' | 'list' = 'list'): void {
    this.logicOverviewTab.set(tab);
    this.logicOverviewOpen.set(true);
  }

  closeLogicOverview(): void {
    this.logicOverviewOpen.set(false);
  }

  setLogicOverviewTab(tab: 'logicMap' | 'automationMap' | 'list'): void {
    this.logicOverviewTab.set(tab);
  }

  /**
   * Logic & automations → Add Logic: open Conditional Logic in pick-target mode.
   * Does not preselect a field — user chooses the target in the modal first.
   */
  onOverviewAddLogic(): void {
    const fields = this.logicSchemaFields();
    if (!fields.length) {
      return;
    }

    this.logicOverviewOpen.set(false);
    // Field settings host lives on the Build step — ensure it is mounted.
    if (this.currentStep() !== 1) {
      this.currentStep.set(1);
    }
    const first = fields[0];
    const location = this.findFieldLocation(first.id);
    if (location) {
      this.focusWorkspaceRow(location.sectionId, location.rowId);
    }
    if (!this.selectedFieldId()) {
      this.selectedFieldId.set(first.id);
    }
    this.builderActiveTab.set('settings');
    this.cdr.detectChanges();
    // Field-settings host may mount on the next CD after switching to Build.
    queueMicrotask(() =>
      this.fieldSettings()?.openConditionModal({ pickTargetField: true }),
    );
  }

  onConditionTargetFieldChange(fieldId: string): void {
    const field = this.logicSchemaFields().find((item) => item.id === fieldId);
    if (!field) {
      return;
    }
    const location = this.findFieldLocation(field.id);
    if (location) {
      this.focusWorkspaceRow(location.sectionId, location.rowId);
    }
    this.selectedFieldId.set(field.id);
    this.builderActiveTab.set('settings');
    this.cdr.detectChanges();
  }

  onOverviewEditLogic(field: FormField): void {
    this.onOpenFieldConditionalLogic(field);
  }

  onOverviewToggleLogic(field: FormField, enabled: boolean): void {
    const logic = normalizeConditionalLogic(field.condition ?? null);
    if (!logic) {
      return;
    }
    this.onUpdateField({
      ...field,
      condition: serializeConditionalLogic({ ...logic, enabled }),
    });
  }

  onOverviewAddAutomation(): void {
    this.logicOverviewOpen.set(false);
    this.cdr.detectChanges();
    this.logicRulesPanel()?.openCreateEditor();
  }

  onOverviewEditAutomation(rule: FormLogicRule): void {
    this.logicOverviewOpen.set(false);
    this.cdr.detectChanges();
    this.logicRulesPanel()?.openEditEditor(rule);
  }

  onOverviewToggleAutomation(rule: FormLogicRule, enabled: boolean): void {
    this.logicRulesPanel()?.toggleRuleEnabled(rule, enabled);
  }

  summarizeFieldCondition(field: FormField): string {
    const logic = normalizeConditionalLogic(field.condition ?? null);
    if (!logic) {
      return 'No conditional logic configured';
    }
    const predicate = getPrimaryPredicate(logic);
    const source =
      this.logicSchemaFields().find((item) => item.id === predicate.fieldId)?.label ||
      'a field';
    const operator =
      CONDITION_OPERATOR_LABELS[predicate.operator] ?? predicate.operator;
    const needsValue = !['isEmpty', 'isNotEmpty', 'checked', 'unchecked'].includes(
      predicate.operator,
    );
    const valueText =
      needsValue && predicate.value != null && String(predicate.value).trim() !== ''
        ? ` ${String(predicate.value)}`
        : '';
    const action = getSelectedActionTypes(logic)
      .map((type) => CONDITION_ACTION_LABELS[type] ?? type)
      .join(' + ');
    return `${action || 'Update field'} when ${source} ${operator}${valueText}`;
  }

  /** List/map display: friendlier action phrasing for Figma chrome. */
  logicActionNarrative(field: FormField): string {
    const logic = normalizeConditionalLogic(field.condition ?? null);
    if (!logic?.actions?.length) {
      return 'Updated';
    }
    const types = new Set(getSelectedActionTypes(logic));
    const parts: string[] = [];
    if (types.has('show')) {
      parts.push('Shown');
    }
    if (types.has('hide')) {
      parts.push('Hidden');
    }
    if (types.has('require')) {
      parts.push('required');
    }
    if (types.has('optional')) {
      parts.push('optional');
    }
    if (types.has('enable')) {
      parts.push('enabled');
    }
    if (types.has('disable')) {
      parts.push('disabled');
    }
    if (types.has('setValue')) {
      parts.push('value set');
    }
    if (!parts.length) {
      return CONDITION_ACTION_LABELS[getPrimaryActionType(logic)] ?? 'Updated';
    }
    if (parts.length === 1) {
      return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    }
    const [first, ...rest] = parts;
    return `${first} and ${rest.join(' and ')}`;
  }

  /** Logic map condition pill (e.g. "is above 5"). */
  logicMapConditionPill(field: FormField): string {
    const logic = normalizeConditionalLogic(field.condition ?? null);
    if (!logic) {
      return 'when condition matches';
    }
    const predicate = getPrimaryPredicate(logic);
    const operator = this.mapOperatorPhrase(predicate.operator);
    const needsValue = !['isEmpty', 'isNotEmpty', 'checked', 'unchecked'].includes(
      predicate.operator,
    );
    const valueText =
      needsValue && predicate.value != null && String(predicate.value).trim() !== ''
        ? ` ${String(predicate.value)}`
        : '';
    return `${operator}${valueText}`.trim();
  }

  /** Logic map action pill (e.g. "shows and requires it"). */
  logicMapActionPill(field: FormField): string {
    const narrative = this.logicActionNarrative(field).toLowerCase();
    if (narrative === 'shown and required') {
      return 'shows and requires it';
    }
    if (narrative === 'shown') {
      return 'shows it';
    }
    if (narrative === 'hidden') {
      return 'hides it';
    }
    if (narrative === 'required') {
      return 'requires it';
    }
    if (narrative === 'value set') {
      return 'sets its value';
    }
    return `${narrative} it`;
  }

  /** List row: narrative with source field split out for a badge. */
  logicListSummaryParts(field: FormField): {
    before: string;
    badge: string;
    after: string;
  } {
    const logic = normalizeConditionalLogic(field.condition ?? null);
    if (!logic) {
      return { before: 'No conditional logic configured', badge: '', after: '' };
    }
    const predicate = getPrimaryPredicate(logic);
    const source =
      this.logicSchemaFields().find((item) => item.id === predicate.fieldId)?.label ||
      'a field';
    const operator = this.mapOperatorPhrase(predicate.operator);
    const needsValue = !['isEmpty', 'isNotEmpty', 'checked', 'unchecked'].includes(
      predicate.operator,
    );
    const valueText =
      needsValue && predicate.value != null && String(predicate.value).trim() !== ''
        ? ` ${String(predicate.value)}`
        : '';
    return {
      before: `${this.logicActionNarrative(field)} when`,
      badge: source,
      after: `${operator}${valueText}`.trim(),
    };
  }

  automationListSummaryParts(rule: FormLogicRule): {
    before: string;
    badge: string;
    after: string;
  } {
    const schema = this.logicSchemaFields();
    const first = rule.conditions.items.find((item) => item.fieldId);
    if (!first) {
      return {
        before: `If ${summarizeConditions(rule, schema)}, then ${summarizeActions(rule)}`,
        badge: '',
        after: '',
      };
    }
    const fieldLabel =
      schema.find((item) => item.id === first.fieldId)?.label?.trim() || 'a field';
    const operator = this.mapOperatorPhrase(first.operator);
    let comparison = '';
    if (!['isEmpty', 'isNotEmpty', 'checked', 'unchecked'].includes(first.operator)) {
      if (first.comparison.type === 'fixed') {
        comparison =
          first.comparison.value != null && String(first.comparison.value).trim() !== ''
            ? ` ${String(first.comparison.value)}`
            : '';
      } else if (first.comparison.type === 'field') {
        comparison = ` ${
          schema.find((item) => item.id === first.comparison.fieldId)?.label || 'a field'
        }`;
      }
    }
    const restConditions = rule.conditions.items.filter((item) => item.fieldId).slice(1);
    const extra =
      restConditions.length > 0
        ? ` ${summarizeConditions(
            {
              ...rule,
              conditions: { ...rule.conditions, items: restConditions },
            },
            schema,
          )}`
        : '';
    return {
      before: 'If',
      badge: fieldLabel,
      after: `${operator}${comparison}${extra}, then ${summarizeActions(rule)}`.trim(),
    };
  }

  summarizeAutomationRule(rule: FormLogicRule): string {
    const schema = this.logicSchemaFields();
    return `If ${summarizeConditions(rule, schema)}, then ${summarizeActions(rule)}`;
  }

  automationRuleCardSummary(rule: FormLogicRule): { when: string; then: string } {
    return summarizeRuleCard(rule, this.logicSchemaFields());
  }

  automationMapSourceFields(rule: FormLogicRule): FormField[] {
    const schema = this.logicSchemaFields();
    const seen = new Set<string>();
    const fields: FormField[] = [];
    for (const item of rule.conditions.items) {
      if (!item.fieldId || seen.has(item.fieldId)) {
        continue;
      }
      seen.add(item.fieldId);
      const field = schema.find((entry) => entry.id === item.fieldId);
      if (field) {
        fields.push(field);
      }
    }
    return fields;
  }

  automationMapConditionPill(rule: FormLogicRule, fieldId: string): string {
    const item = rule.conditions.items.find((entry) => entry.fieldId === fieldId);
    if (!item) {
      return 'matches';
    }
    const operator = this.mapOperatorPhrase(item.operator);
    if (['isEmpty', 'isNotEmpty', 'checked', 'unchecked'].includes(item.operator)) {
      return operator;
    }
    if (item.comparison.type === 'fixed') {
      const value =
        item.comparison.value != null && String(item.comparison.value).trim() !== ''
          ? String(item.comparison.value)
          : '';
      return value ? `${operator} ${value}` : operator;
    }
    if (item.comparison.type === 'field') {
      const label =
        this.logicSchemaFields().find((entry) => entry.id === item.comparison.fieldId)
          ?.label || 'a field';
      return `${operator} ${label}`;
    }
    return operator;
  }

  automationMapActionCards(
    rule: FormLogicRule,
  ): Array<{ type: string; label: string; detail: string }> {
    if (!rule.actions.length) {
      return [{ type: 'none', label: 'No action configured', detail: 'Add an action to this rule' }];
    }
    return rule.actions.map((action) => {
      if (action.type === 'purchaseRequest') {
        return {
          type: action.type,
          label: 'Create purchase request',
          detail: 'Creates a purchase request on submit',
        };
      }
      if (action.type === 'sendNotification') {
        return {
          type: action.type,
          label: 'Send notification',
          detail: 'Alert to everyone in the position',
        };
      }
      if (action.type === 'maintenanceRequest') {
        return {
          type: action.type,
          label: 'Create maintenance request',
          detail: 'Creates a maintenance request on submit',
        };
      }
      return {
        type: action.type,
        label: summarizeActions({ ...rule, actions: [action] }),
        detail: 'After submit',
      };
    });
  }

  automationRunOrdinal(index: number): string {
    const n = index + 1;
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 13) {
      return `${n}TH`;
    }
    switch (n % 10) {
      case 1:
        return `${n}ST`;
      case 2:
        return `${n}ND`;
      case 3:
        return `${n}RD`;
      default:
        return `${n}TH`;
    }
  }

  fieldTypeDisplayLabel(field: FormField | null | undefined): string {
    if (!field) {
      return 'Field';
    }
    const raw = (field.fieldTypeName || field.type || 'field').toString();
    return raw
      .replace(/[-_]/g, ' ')
      .trim()
      .replace(/\b\w/g, (ch) => ch.toUpperCase());
  }

  /** Compact glyph for Automation map answer cards (Figma-style). */
  automationMapFieldGlyph(field: FormField | null | undefined): string {
    const type = (field?.fieldTypeName || field?.type || '').toString().toLowerCase();
    if (type.includes('number') || type.includes('measurement') || type.includes('rating')) {
      return '#';
    }
    if (type.includes('checkbox') || type.includes('radio') || type.includes('select')) {
      return '☑';
    }
    if (type.includes('temp') || type.includes('temperature')) {
      return '°';
    }
    if (type.includes('image') || type.includes('photo') || type.includes('file')) {
      return '▣';
    }
    if (type.includes('date') || type.includes('time')) {
      return '◷';
    }
    return '=';
  }

  fieldLocationLabel(fieldId: string): string {
    for (let s = 0; s < this.sections().length; s++) {
      const section = this.sections()[s];
      for (let r = 0; r < section.rows.length; r++) {
        if (section.rows[r].fields.some((field) => field.id === fieldId)) {
          return `Section ${s + 1}, Row ${r + 1}`;
        }
      }
    }
    return 'This form';
  }

  private mapOperatorPhrase(operator: string): string {
    switch (operator) {
      case 'greaterThan':
        return 'is above';
      case 'lessThan':
        return 'is below';
      case 'greaterThanOrEqual':
        return 'is at least';
      case 'lessThanOrEqual':
        return 'is at most';
      case 'equals':
        return 'equals';
      case 'notEquals':
        return 'does not equal';
      case 'contains':
        return 'includes';
      case 'notContains':
        return 'does not include';
      case 'startsWith':
        return 'starts with';
      case 'endsWith':
        return 'ends with';
      case 'isEmpty':
        return 'is empty';
      case 'isNotEmpty':
        return 'is not empty';
      case 'checked':
        return 'is checked';
      case 'unchecked':
        return 'is not checked';
      default:
        return (
          CONDITION_OPERATOR_LABELS[operator as keyof typeof CONDITION_OPERATOR_LABELS] ??
          operator
        ).toLowerCase();
    }
  }

  onDuplicateField(field: FormField): void {
    const location =
      this.findFieldLocation(field.id) ?? this.pendingFieldTarget();

    if (location) {
      this.focusWorkspaceRow(location.sectionId, location.rowId);
      const current = this.getRowCanvasSchema(location.sectionId, location.rowId);
      const result = duplicateFormField(field, current);
      if (result.duplicate) {
        const siblings = current;
        const remaining = rowRemainingGridUnits(siblings);
        const fitting = largestFittingBuilderWidth(remaining);
        if (fitting <= 0) {
          // Current row is full — place the duplicate on a new row.
          const mapped = mapBuilderFieldToConfig(result.duplicate, {
            preserveId: true,
          });
          hydrateFormTemplateDynamicSelectField(this.formStorageService, mapped)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((hydrated) => {
              const newRow = createEmptyRow();
              const fieldConfig: FormFieldConfig = {
                ...hydrated,
                isDefault: false,
                value: hydrated.value ?? '',
              };
              this.sections.update((list) =>
                list.map((section) => {
                  if (section.id !== location.sectionId) {
                    return section;
                  }
                  const index = section.rows.findIndex(
                    (row) => row.id === location.rowId,
                  );
                  const nextRows = [...section.rows];
                  const insertAt = index >= 0 ? index + 1 : nextRows.length;
                  nextRows.splice(insertAt, 0, {
                    ...newRow,
                    fields: [fieldConfig],
                  });
                  return { ...section, rows: nextRows };
                }),
              );
              this.focusWorkspaceRow(location.sectionId, newRow.id);
              this.onSelectField(mapConfigFieldToBuilder(fieldConfig));
            });
          return;
        }

        const widthAdjusted = {
          ...result.duplicate,
          width: Math.min(
            normalizeBuilderWidthUnits(result.duplicate.width),
            fitting,
          ),
        };
        const mapped = mapBuilderFieldToConfig(widthAdjusted, {
          preserveId: true,
        });
        hydrateFormTemplateDynamicSelectField(this.formStorageService, mapped)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe((hydrated) => {
            const builderHydrated = mapConfigFieldToBuilder(hydrated);
            const nextSchema = result.schema.map((item) =>
              item.id === result.duplicate!.id ? builderHydrated : item,
            );
            this.replaceRowFieldsFromBuilder(
              location.sectionId,
              location.rowId,
              nextSchema,
            );
            this.focusWorkspaceRow(location.sectionId, location.rowId);
            this.onSelectField(builderHydrated);
          });
      }
      return;
    }

    const result = duplicateFormField(field, this.builderSchema());
    this.builderSchema.set(result.schema);
    if (result.duplicate) {
      this.onSelectField(result.duplicate);
    }
  }

  onDuplicateSelectedDraft(): void {
    const field = this.selectedBuilderField();
    if (field) {
      this.onDuplicateField(field);
    }
  }

  onDeleteField(field: FormField): void {
    const location =
      this.findFieldLocation(field.id) ?? this.pendingFieldTarget();
    const schemaForBlock = location
      ? this.getRowCanvasSchema(location.sectionId, location.rowId)
      : this.builderCombinedSchema();
    const blockReason = getLocationFieldDeleteBlockReason(field, schemaForBlock);
    if (blockReason) {
      return;
    }

    this.logicRules.set(
      pruneLogicRulesForDeletedFields(this.logicRules(), [field.id]),
    );

    if (location) {
      this.focusWorkspaceRow(location.sectionId, location.rowId);
      this.rowBuilderFields.update((fields) => removeFormField(field, fields));
      this.builderSchema.update((fields) =>
        clearStaleConditionalLogic(fields, [field.id]),
      );
      this.removeRowFieldFromSections(field.id);
      this.pruneSectionConditions([field.id]);
      const selectedId = this.selectedFieldId();
      if (selectedId === field.id) {
        this.selectedFieldId.set(null);
        this.builderActiveTab.set('fields');
      }
      return;
    }

    const nextSchema = removeFormField(field, this.builderSchema());
    this.builderSchema.set(nextSchema);
    this.rowBuilderFields.update((fields) =>
      clearStaleConditionalLogic(fields, [field.id]),
    );
    this.pruneSectionConditions([field.id]);
    const selectedId = this.selectedFieldId();
    if (selectedId && !nextSchema.some((item) => item.id === selectedId)) {
      this.selectedFieldId.set(null);
      this.builderActiveTab.set('fields');
    }
  }

  onLogicRulesChange(rules: FormLogicRule[]): void {
    this.logicRules.set(normalizeLogicRules(rules));
  }

  onDeleteSelectedDraft(): void {
    const field = this.selectedBuilderField();
    if (field) {
      this.onDeleteField(field);
    }
  }

  onUpdateField(updated: FormField): void {
    const location =
      this.findFieldLocation(updated.id) ?? this.pendingFieldTarget();

    if (location) {
      const rowFields = this.getRowCanvasSchema(location.sectionId, location.rowId);
      const allowed = availableRowWidthPresetsForField(rowFields, updated.id);
      const nextPreset = builderWidthToPreset(updated.width);
      const safeUpdated: FormField = allowed.includes(nextPreset)
        ? { ...updated, width: normalizeBuilderWidthUnits(updated.width) }
        : {
            ...updated,
            width: normalizeBuilderWidthUnits(
              rowFields.find((field) => field.id === updated.id)?.width,
            ),
          };

      this.focusWorkspaceRow(location.sectionId, location.rowId);
      this.rowBuilderFields.update((fields) => updateFormField(safeUpdated, fields));
      const mapped = mapBuilderFieldToConfig(safeUpdated, { preserveId: true });
      hydrateFormTemplateDynamicSelectField(this.formStorageService, mapped)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((hydrated) => this.updateRowFieldInSections(hydrated));
      return;
    }

    this.builderSchema.set(updateFormField(updated, this.builderSchema()));
  }

  /**
   * Legacy builder Save — in the always-on workspace, field edits commit live.
   * This only returns the right rail to the palette (does not leave Build).
   */
  onBuilderSave(): void {
    this.showBuilderPalette();
    const target = this.pendingFieldTarget();
    if (target) {
      try {
        this.initializeRowLocationDependencies(target.sectionId, target.rowId);
      } catch {
        // Location cascade refresh is best-effort.
      }
    }
  }

  private isExistingRowField(fieldId: string): boolean {
    return this.rowBuilderFields().some((field) => field.id === fieldId);
  }

  private initializeRowBuilderFields(): void {
    const target = this.pendingFieldTarget();
    if (!target) {
      this.rowBuilderFields.set([]);
      return;
    }

    const section = this.sections().find((item) => item.id === target.sectionId);
    if (!section) {
      this.rowBuilderFields.set([]);
      return;
    }

    const row = section.rows.find((item) => item.id === target.rowId);
    this.rowBuilderFields.set((row?.fields ?? []).map(mapConfigFieldToBuilder));
  }

  private updateRowFieldInSections(field: FormFieldConfig): void {
    const target = this.pendingFieldTarget();
    if (!target) return;

    this.sections.update((list) =>
      list.map((section) => {
        if (section.id !== target.sectionId) {
          return section;
        }

        return {
          ...section,
          rows: section.rows.map((row) =>
            row.id === target.rowId
              ? {
                  ...row,
                  fields: row.fields.map((item) =>
                    item.id === field.id
                      ? { ...item, ...field, isDefault: item.isDefault }
                      : item,
                  ),
                }
              : row,
          ),
        };
      }),
    );
  }

  private appendRowFieldToSections(field: FormFieldConfig): void {
    const target = this.pendingFieldTarget();
    if (!target) return;

    this.sections.update((list) =>
      list.map((section) => {
        if (section.id !== target.sectionId) {
          return section;
        }

        return {
          ...section,
          rows: section.rows.map((row) =>
            row.id === target.rowId
              ? { ...row, fields: [...row.fields, field] }
              : row,
          ),
        };
      }),
    );

    this.initializeRowLocationDependencies(target.sectionId, target.rowId);
  }

  private removeRowFieldFromSections(fieldId: string): void {
    const target = this.pendingFieldTarget();
    if (!target) return;

    this.sections.update((list) =>
      list.map((section) => {
        if (section.id !== target.sectionId) {
          return section;
        }

        return {
          ...section,
          rows: section.rows.map((row) =>
            row.id === target.rowId
              ? {
                  ...row,
                  fields: row.fields.filter((field) => field.id !== fieldId),
                }
              : row,
          ),
        };
      }),
    );
  }

  private pruneSectionConditions(deletedIds: string[]): void {
    if (!deletedIds.length) {
      return;
    }

    this.sections.update((list) =>
      list.map((section) => ({
        ...section,
        rows: section.rows.map((row) => ({
          ...row,
          fields: row.fields.map((field) => ({
            ...field,
            condition: pruneConditionalLogicForDeletedFields(field.condition, deletedIds),
          })),
        })),
      })),
    );
  }

  private resetBuilderDraft(): void {
    this.rowBuilderFields.set([]);
    this.builderSchema.set([]);
    this.selectedFieldId.set(null);
  }

  /**
   * After fields are saved into Form Details, strip baked-in all-States/all-Cities
   * options and wire Country → State → City like `app-dynamic-form`.
   */
  private initializeRowLocationDependencies(sectionId: string, rowId: string): void {
    const section = this.sections().find((item) => item.id === sectionId);
    if (!section) return;

    const row = section.rows.find((item) => item.id === rowId);
    if (!row) return;

    const cleared = clearDependentLocationOptions(row.fields);
    const enriched = this.enrichRootLocationOptions(cleared);
    this.patchRowFields(sectionId, rowId, () => enriched);
    this.refreshRowLocationOptionsFromValues(sectionId, rowId, enriched);
  }

  /**
   * Enrich root location selects (Country, or State when no Country) with
   * id-based options from LocationCacheService — same shape as app-dynamic-form.
   */
  private enrichRootLocationOptions(fields: FormFieldConfig[]): FormFieldConfig[] {
    const { country, state } = getRowLocationFields(fields);

    return fields.map((field) => {
      if (country && field.id === country.id) {
        const records = this.locationCache.countries();
        if (!records.length) return field;
        return {
          ...field,
          options: mapLocationRecordsToSelectOptions(
            records,
            getFieldOptionLabelKey(field),
            getFieldOptionValueKey(field),
          ),
        };
      }

      // State is root when Country is absent — show all States from cache.
      if (state && !country && field.id === state.id) {
        const records = this.locationCache.states();
        if (!records.length) return field;
        return {
          ...field,
          options: mapLocationRecordsToSelectOptions(
            records,
            getFieldOptionLabelKey(field),
            getFieldOptionValueKey(field),
          ),
        };
      }

      return field;
    });
  }

  /** Reload dependent options from currently selected parent values (no clears). */
  private refreshRowLocationOptionsFromValues(
    sectionId: string,
    rowId: string,
    fields: FormFieldConfig[],
  ): void {
    const { country, state, city } = getRowLocationFields(fields);

    if (state && country) {
      this.loadStateOptionsForRow(
        sectionId,
        rowId,
        state,
        this.toLocationDependencyValue(country.value),
      );
    }

    if (!city) return;

    if (state) {
      this.loadCityOptionsForStateRow(
        sectionId,
        rowId,
        city,
        this.toLocationDependencyValue(state.value),
      );
    } else if (country) {
      this.loadCityOptionsForCountryRow(
        sectionId,
        rowId,
        city,
        this.toLocationDependencyValue(country.value),
      );
    }
  }

  /** Location cascade APIs expect a scalar parent id (multi → first selected). */
  private toLocationDependencyValue(value: FormFieldConfig['value']): string {
    if (Array.isArray(value)) {
      return String(value[0] ?? '');
    }
    return String(value ?? '');
  }

  /**
   * Country → State → City cascading for a Form Details row.
   * Mirrors `app-dynamic-form` handleLocationSelection + LocationCacheService.
   */
  private applyRowLocationDependencies(
    sectionId: string,
    rowId: string,
    changedFieldId: string,
    value: string,
    fields: FormFieldConfig[],
  ): void {
    const { country, state, city } = getRowLocationFields(fields);
    const changed = fields.find((field) => field.id === changedFieldId);
    if (!changed) return;

    const kind = getConfigFieldLocationKind(changed);

    if (kind === 'countries') {
      if (state) {
        this.patchRowFields(sectionId, rowId, (rowFields) =>
          rowFields.map((field) => {
            if (field.id === state.id) {
              return { ...field, value: '', options: [] };
            }
            if (city && field.id === city.id) {
              return { ...field, value: '', options: [] };
            }
            return field;
          }),
        );
        this.loadStateOptionsForRow(sectionId, rowId, state, value);
        return;
      }

      if (city) {
        this.patchRowFields(sectionId, rowId, (rowFields) =>
          rowFields.map((field) =>
            field.id === city.id ? { ...field, value: '', options: [] } : field,
          ),
        );
        this.loadCityOptionsForCountryRow(sectionId, rowId, city, value);
      }
      return;
    }

    if (kind === 'states' && city) {
      this.patchRowFields(sectionId, rowId, (rowFields) =>
        rowFields.map((field) =>
          field.id === city.id ? { ...field, value: '', options: [] } : field,
        ),
      );
      this.loadCityOptionsForStateRow(sectionId, rowId, city, value);
    }
  }

  private loadStateOptionsForRow(
    sectionId: string,
    rowId: string,
    stateField: FormFieldConfig,
    countryValue: unknown,
  ): void {
    if (isEmptyLocationValue(countryValue)) {
      this.patchRowFieldOptions(sectionId, rowId, stateField.id, [], true);
      return;
    }

    const countryId = resolveLocationRecordId(
      String(countryValue),
      this.locationCache.countries(),
    );
    // Prefer raw value when it already is an id (dynamic-form style).
    const resolvedId = countryId ?? countryValue;

    this.locationCache
      .getStatesForCountry(resolvedId)
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((records) => {
        const options = mapLocationRecordsToSelectOptions(
          records,
          getFieldOptionLabelKey(stateField),
          getFieldOptionValueKey(stateField),
        );
        this.patchRowFieldOptions(sectionId, rowId, stateField.id, options, false);
      });
  }

  private loadCityOptionsForStateRow(
    sectionId: string,
    rowId: string,
    cityField: FormFieldConfig,
    stateValue: unknown,
  ): void {
    if (isEmptyLocationValue(stateValue)) {
      this.patchRowFieldOptions(sectionId, rowId, cityField.id, [], true);
      return;
    }

    const stateId = resolveLocationRecordId(String(stateValue), this.locationCache.states());
    const resolvedId = stateId ?? stateValue;

    this.locationCache
      .getCitiesForState(resolvedId)
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((records) => {
        const options = mapLocationRecordsToSelectOptions(
          records,
          getFieldOptionLabelKey(cityField),
          getFieldOptionValueKey(cityField),
        );
        this.patchRowFieldOptions(sectionId, rowId, cityField.id, options, false);
      });
  }

  private loadCityOptionsForCountryRow(
    sectionId: string,
    rowId: string,
    cityField: FormFieldConfig,
    countryValue: unknown,
  ): void {
    if (isEmptyLocationValue(countryValue)) {
      this.patchRowFieldOptions(sectionId, rowId, cityField.id, [], true);
      return;
    }

    const countryId = resolveLocationRecordId(
      String(countryValue),
      this.locationCache.countries(),
    );
    const resolvedId = countryId ?? countryValue;

    this.locationCache
      .getCitiesForCountry(resolvedId)
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((records) => {
        const options = mapLocationRecordsToSelectOptions(
          records,
          getFieldOptionLabelKey(cityField),
          getFieldOptionValueKey(cityField),
        );
        this.patchRowFieldOptions(sectionId, rowId, cityField.id, options, false);
      });
  }

  private patchRowFieldOptions(
    sectionId: string,
    rowId: string,
    fieldId: string,
    options: FormSelectOption[],
    clearValue: boolean,
  ): void {
    this.patchRowFields(sectionId, rowId, (rowFields) =>
      rowFields.map((field) =>
        field.id === fieldId
          ? {
              ...field,
              options,
              value: clearValue ? '' : field.value,
            }
          : field,
      ),
    );
  }

  private patchRowFields(
    sectionId: string,
    rowId: string,
    updater: (fields: FormFieldConfig[]) => FormFieldConfig[],
  ): void {
    this.sections.update((list) =>
      list.map((section) => {
        if (section.id !== sectionId) {
          return section;
        }

        return {
          ...section,
          rows: section.rows.map((row) =>
            row.id === rowId ? { ...row, fields: updater(row.fields) } : row,
          ),
        };
      }),
    );
  }

  private appendFieldToPendingTarget(field: FormFieldConfig): void {
    const target = this.pendingFieldTarget();
    if (!target) return;

    const currentRow = this.sections()
      .find((section) => section.id === target.sectionId)
      ?.rows.find((row) => row.id === target.rowId);
    const currentFields = currentRow?.fields ?? [];

    // Row already full — start a new row instead of overflowing capacity.
    if (currentFields.length > 0 && !rowHasAvailableColumnSpace(currentFields)) {
      const fittingWidth = largestFittingBuilderWidth(12);
      const newField: FormFieldConfig = {
        ...field,
        width: mapBuilderWidthToPercent(fittingWidth),
        isDefault: false,
        value: field.value ?? '',
      };
      const newRow = createEmptyRow();
      this.sections.update((list) =>
        list.map((section) => {
          if (section.id !== target.sectionId) {
            return section;
          }
          const index = section.rows.findIndex((row) => row.id === target.rowId);
          const nextRows = [...section.rows];
          const insertAt = index >= 0 ? index + 1 : nextRows.length;
          nextRows.splice(insertAt, 0, { ...newRow, fields: [newField] });
          return { ...section, rows: nextRows };
        }),
      );
      this.focusWorkspaceRow(target.sectionId, newRow.id);
      this.onSelectField(mapConfigFieldToBuilder(newField));
      return;
    }

    const remaining = rowRemainingGridUnits(currentFields);
    const requested = widthToGridUnits(field.width);
    const fitting =
      currentFields.length === 0
        ? normalizeBuilderWidthUnits(requested)
        : largestFittingBuilderWidth(remaining) || requested;
    const newField: FormFieldConfig = {
      ...field,
      width: mapBuilderWidthToPercent(fitting),
      isDefault: false,
      value: field.value ?? '',
    };

    this.sections.update((list) =>
      list.map((section) => {
        if (section.id !== target.sectionId) return section;

        // When the section has no rows yet, create the first row using the same
        // rowId the builder was opened with — never introduce a different empty row.
        const rows = section.rows.length
          ? section.rows
          : [{ id: target.rowId, fields: [] as FormFieldConfig[] }];

        const hasTargetRow = rows.some((row) => row.id === target.rowId);
        const resolvedRows = hasTargetRow
          ? rows
          : [...rows, { id: target.rowId, fields: [] as FormFieldConfig[] }];

        return {
          ...section,
          rows: resolvedRows.map((row) =>
            row.id === target.rowId
              ? { ...row, fields: [...row.fields, newField] }
              : row,
          ),
        };
      }),
    );
  }

  updateMeta<K extends keyof FormMetaConfig>(key: K, value: FormMetaConfig[K]): void {
    this.meta.update((current) => ({ ...current, [key]: value }));
  }

  toggleAssignModeDropdown(): void {
    const wasOpen = this.assignModeDropdownOpen();
    this.closeAllMultiSelectDropdowns();
    if (!wasOpen) {
      this.assignModeDropdownOpen.set(true);
    }
  }

  selectAssignMode(value: AssignReportMode): void {
    this.updateMeta('assignMode', normalizeAssignReportMode(value));
    this.assignModeDropdownOpen.set(false);
  }

  toggleReportModeDropdown(): void {
    const wasOpen = this.reportModeDropdownOpen();
    this.closeAllMultiSelectDropdowns();
    if (!wasOpen) {
      this.reportModeDropdownOpen.set(true);
    }
  }

  selectReportMode(value: AssignReportMode): void {
    this.updateMeta('reportMode', normalizeAssignReportMode(value));
    this.reportModeDropdownOpen.set(false);
  }

  // ── Multi-Select Helpers ──────────────────────────────────────

  toggleMultiSelect(
    key: 'assignUsersDropdownOpen' | 'assignPositionsDropdownOpen' | 'reportUsersDropdownOpen' | 'reportPositionsDropdownOpen',
  ): void {
    if (
      (key === 'assignUsersDropdownOpen' && this.assignUsersDisabled()) ||
      (key === 'assignPositionsDropdownOpen' && this.assignPositionsDisabled()) ||
      (key === 'reportUsersDropdownOpen' && this.reportUsersDisabled()) ||
      (key === 'reportPositionsDropdownOpen' && this.reportPositionsDisabled())
    ) {
      return;
    }

    const wasOpen = this[key]();
    this.closeAllMultiSelectDropdowns();
    if (!wasOpen) {
      this[key].set(true);
    }
  }

  private closeAllMultiSelectDropdowns(): void {
    this.assignModeDropdownOpen.set(false);
    this.reportModeDropdownOpen.set(false);
    this.assignUsersDropdownOpen.set(false);
    this.assignUsersSearch.set('');
    this.assignPositionsDropdownOpen.set(false);
    this.assignPositionsSearch.set('');
    this.reportUsersDropdownOpen.set(false);
    this.reportUsersSearch.set('');
    this.reportPositionsDropdownOpen.set(false);
    this.reportPositionsSearch.set('');
  }

  toggleMultiSelectOption(
    metaKey: 'assignUsers' | 'assignJobPosition' | 'reportUsers' | 'reportJobPosition',
    value: string,
  ): void {
    const current = this.meta()[metaKey] as string[];
    const isRemoving = current.includes(value);
    const updated = isRemoving
      ? current.filter((v) => v !== value)
      : [...current, value];

    this.meta.update((m) => {
      const next = { ...m, [metaKey]: updated };

      // Selecting a value clears the exclusive counterpart in the same panel.
      if (!isRemoving) {
        if (metaKey === 'assignUsers') {
          next.assignJobPosition = [];
          this.assignPositionsDropdownOpen.set(false);
          this.assignPositionsSearch.set('');
        } else if (metaKey === 'assignJobPosition') {
          next.assignUsers = [];
          this.assignUsersDropdownOpen.set(false);
          this.assignUsersSearch.set('');
        } else if (metaKey === 'reportUsers') {
          next.reportJobPosition = [];
          this.reportPositionsDropdownOpen.set(false);
          this.reportPositionsSearch.set('');
        } else if (metaKey === 'reportJobPosition') {
          next.reportUsers = [];
          this.reportUsersDropdownOpen.set(false);
          this.reportUsersSearch.set('');
        }
      }

      return next;
    });
  }

  removeMultiSelectOption(
    metaKey: 'assignUsers' | 'assignJobPosition' | 'reportUsers' | 'reportJobPosition',
    value: string,
  ): void {
    const current = this.meta()[metaKey] as string[];
    this.updateMeta(metaKey, current.filter((v) => v !== value) as any);
  }

  onMultiSelectSearch(
    event: Event,
    searchSignal: WritableSignal<string>,
  ): void {
    searchSignal.set((event.target as HTMLInputElement).value);
  }

  asCustomSection(section: FormSection): CustomFormSection {
    return section as CustomFormSection;
  }

  /** Preview requires a persisted template id (same as listing Preview action). */
  canPreviewTemplate(): boolean {
    const id = Number(this.formId());
    return Number.isFinite(id) && id > 0;
  }

  /**
   * Open the shared Form Template preview page (FormTemplatePreviewComponent).
   * Unsaved create drafts have no id — do not navigate or auto-save.
   */
  openTemplatePreview(): void {
    if (!this.canPreviewTemplate()) {
      this.toastr.info('Save the form first to preview it.');
      return;
    }

    const id = this.formId();
    this.router.navigate(['/dynamic-forms', 'preview', id], {
      queryParams: { returnTo: `/dynamic-forms/edit/${id}` },
    });
  }

  cancel(): void {
    this.router.navigate(['/dynamic-forms']);
  }

  save(): void {
    if (this.submitting()) {
      return;
    }

    if (!this.canSave()) return;

    const payload = this.buildPayload();
    const id = this.formId();

    this.submitting.set(true);

    const request$ = id
      ? this.formsService.updateTemplate(Number(id), {
          name: this.formName(),
          schema: payload,
        })
      : this.formsService.createForm({ name: this.formName(), schema: payload });

    request$
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.toastr.success(id ? 'Form updated successfully' : 'Form created successfully');
          this.freezeBaseline = false;
          this.markBaseline();
          this.leaveAfterSave();
        },
        error: (err) => {
          this.toastr.error(
            err?.error?.message || (id ? 'Failed to update form' : 'Failed to create form'),
          );
        },
      });
  }

  private buildPayload() {
    return buildDynamicFormPayload(
      this.formName(),
      this.sections(),
      this.meta(),
      {
        users: this.userOptions(),
        jobPositions: this.jobPositionOptions(),
      },
      this.logicRules(),
    );
  }
}
