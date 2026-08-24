import {
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
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { finalize, startWith, take } from 'rxjs';
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
import {
  applyCanvasDrop,
  clearStaleConditionalLogic,
  duplicateFormField,
  removeFormField,
  updateFormField,
} from '../../../../form-builder/utils/form-field-operations';
import {
  pruneConditionalLogicForDeletedFields,
  resolveCollectionConditionalEffects,
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
import { SectionFieldPreviewComponent } from '../components/section-field-preview/section-field-preview.component';
import {
  mapBuilderFieldToConfig,
  mapConfigFieldToBuilder,
} from '../utils/field-builder-adapter.utils';
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
  FrequencyType,
  SavedDynamicForm,
  buildDynamicFormPayload,
  createId,
} from '../models/dynamic-form.models';

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
export class CreateFormComponent implements OnInit {
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.multi-select-dropdown')) {
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
      this.freqWeekOrderDropdownOpen.set(false);
      this.freqWeekOrderSearch.set('');
      this.freqMonthDropdownOpen.set(false);
      this.freqMonthSearch.set('');
      this.freqYearMonthDropdownOpen.set(false);
      this.freqYearMonthSearch.set('');
    }
  }

  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly formsService = inject(TenantFormsService);
  private readonly toastr = inject(ToastrService);
  private readonly userService = inject(TenantUserService);
  private readonly jobPositionService = inject(TenantJobPositionService);
  private readonly locationCache = inject(LocationCacheService);
  private readonly formStorageService = inject(FormStorageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);

  private readonly frequencyDateInput = viewChild<ElementRef<HTMLInputElement>>('frequencyDateInput');
  private flatpickrInstance: FlatpickrInstance | null = null;

  // ── Assign & Report Multi-Select State ────────────────────────
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
    const filtered = q ? opts.filter((o) => o.name.toLowerCase().includes(q)) : opts;
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
    const filtered = q ? opts.filter((o) => o.name.toLowerCase().includes(q)) : opts;
    return filtered.map((o) => ({ ...o, selected: selected.has(o.name) }));
  });

  readonly filteredReportPositions = computed(() => {
    const q = this.reportPositionsSearch().trim().toLowerCase();
    const selected = new Set(this.meta().reportJobPosition);
    const opts = this.jobPositionOptions();
    const filtered = q ? opts.filter((o) => o.name.toLowerCase().includes(q)) : opts;
    return filtered.map((o) => ({ ...o, selected: selected.has(o.name) }));
  });

  readonly formName = signal('');
  readonly sections = signal<FormSection[]>([]);

  // ── Edit Mode State ───────────────────────────────────────────
  /** Template id when the wizard is opened from View Forms → Edit. */
  readonly formId = signal<string>('');
  readonly isEditing = computed(() => !!this.formId());
  readonly loading = signal(false);
  private loadedSchema: DynamicFormPayload | null = null;

  readonly sectionDialogOpen = signal(false);
  readonly sectionDialogMode = signal<'create' | 'rename'>('create');
  readonly editingSectionId = signal<string | null>(null);
  readonly sectionNameInput = signal('');
  readonly sectionNameError = signal('');
  readonly sectionPendingRemoval = signal<CustomFormSection | null>(null);
  readonly meta = signal<FormMetaConfig>({
    assignJobPosition: [],
    assignUsers: [],
    reportJobPosition: [],
    reportUsers: [],
    frequencyJobPosition: [],
    frequencyDate: null,
    frequencyType: 'atOnce',
    frequencyRecurring: createDefaultFrequencyRecurring(),
  });

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
  readonly builderModuleName = 'dynamic-forms';
  /** Prevents click-to-edit while a row field is being dragged. */
  private isReorderingExistingFields = false;

  readonly builderCombinedSchema = computed(() => [
    ...this.rowBuilderFields(),
    ...this.builderSchema(),
  ]);

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
      null
    );
  });

  readonly canSaveDraftField = computed(() => {
    const selected = this.selectedBuilderField();
    if (selected && this.isExistingRowField(selected.id)) {
      return true;
    }
    // Enable Save when any newly added draft field is ready (not only the selected one).
    return this.builderSchema().some((field) => !!field.label?.trim());
  });

  readonly hasSections = computed(() => this.sections().length > 0);
  readonly canSave = computed(() => this.formName().trim().length > 0 && this.hasSections());

  // ── Wizard State ──────────────────────────────────────────────
  readonly currentStep = signal(1);
  readonly totalSteps = 3;

  readonly steps: WizardStep[] = [
    { label: 'Form Details', number: 1 },
    { label: 'Assign & Report', number: 2 },
    { label: 'Frequency', number: 3 },
  ];

  readonly isFirstStep = computed(() => this.currentStep() === 1);
  readonly isLastStep = computed(() => this.currentStep() === this.totalSteps);

  readonly step1Valid = computed(
    () => this.formName().trim().length > 0 && this.sections().length > 0,
  );

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

  readonly weekOrderOptions = [
    { label: 'First', value: 'first' },
    { label: 'Second', value: 'second' },
    { label: 'Third', value: 'third' },
    { label: 'Fourth', value: 'fourth' },
    { label: 'Last', value: 'last' },
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

  // ── Frequency Custom Select State ─────────────────────────────
  readonly freqTypeDropdownOpen = signal(false);
  readonly freqTypeSearch = signal('');
  readonly freqIntervalDropdownOpen = signal(false);
  readonly freqIntervalSearch = signal('');
  readonly freqWeekOrderDropdownOpen = signal(false);
  readonly freqWeekOrderSearch = signal('');
  readonly freqMonthDropdownOpen = signal(false);
  readonly freqMonthSearch = signal('');
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

  readonly filteredWeekOrderOptions = computed(() => {
    const q = this.freqWeekOrderSearch().trim().toLowerCase();
    return q
      ? this.weekOrderOptions.filter((o) => o.label.toLowerCase().includes(q))
      : this.weekOrderOptions;
  });

  readonly filteredMonthOptions = computed(() => {
    const q = this.freqMonthSearch().trim().toLowerCase();
    return q
      ? this.monthOptions.filter((o) => o.label.toLowerCase().includes(q))
      : this.monthOptions;
  });

  readonly filteredYearMonthOptions = computed(() => {
    const q = this.freqYearMonthSearch().trim().toLowerCase();
    return q
      ? this.monthOptions.filter((o) => o.label.toLowerCase().includes(q))
      : this.monthOptions;
  });

  readonly frequencyForm = this.fb.nonNullable.group({
    type: this.fb.nonNullable.control<FrequencyType>('recurring'),
    date: this.fb.control<string | null>(null),
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

  readonly frequencyMonthMode = toSignal(
    this.frequencyForm.controls.monthMode.valueChanges.pipe(
      startWith(this.frequencyForm.controls.monthMode.value),
    ),
    { initialValue: 'dayOfMonth' as FrequencyMonthMode },
  );

  // ── Dynamic Options ──────────────────────────────────────────
  readonly jobPositionOptions = signal<{ id: string; name: string }[]>([]);
  readonly userOptions = signal<{ id: string; name: string }[]>([]);

  constructor() {
    this.frequencyForm.valueChanges
      .pipe(startWith(this.frequencyForm.getRawValue()), takeUntilDestroyed())
      .subscribe(() => this.syncFrequencyToMeta());

    effect(() => {
      const step = this.currentStep();
      const type = this.frequencyType();
      const input = this.frequencyDateInput();

      this.destroyFlatpickr();

      if (step !== 3 || type !== 'atOnce' || !input) return;

      this.flatpickrInstance = flatpickr(input.nativeElement, {
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
    });

    effect(() => {
      const mode = this.frequencyMonthMode();
      const { dayOfMonth, weekOrder, onTheMonth } = this.frequencyForm.controls;
      if (mode === 'dayOfMonth') {
        dayOfMonth.enable({ emitEvent: false });
        weekOrder.disable({ emitEvent: false });
        onTheMonth.disable({ emitEvent: false });
      } else {
        dayOfMonth.disable({ emitEvent: false });
        weekOrder.enable({ emitEvent: false });
        onTheMonth.enable({ emitEvent: false });
      }
    });

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
    return true;
  }

  nextStep(): void {
    if (this.currentStep() < this.totalSteps && this.canProceed()) {
      this.closeFieldBuilder();
      this.currentStep.update((s) => s + 1);
    }
  }

  prevStep(): void {
    if (this.currentStep() > 1) {
      this.closeFieldBuilder();
      this.currentStep.update((s) => s - 1);
    }
  }

  goToStep(stepNum: number): void {
    if (stepNum < this.currentStep()) {
      this.closeFieldBuilder();
      this.currentStep.set(stepNum);
    }
  }

  // ── Lifecycle ────────────────────────────────────────────────

  ngOnInit(): void {
    this.formId.set(this.route.snapshot.paramMap.get('id') ?? '');
    this.loadJobPositions();
    this.loadUsers();
    if (this.formId()) {
      this.loadTemplate();
    }
  }

  private loadJobPositions(): void {
    this.jobPositionService
      .getJobPositions(1, 9999)
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
            .getUsers(1, 9999)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (res: any) => {
                const data = res?.data || res;
                if (Array.isArray(data)) {
                  this.userOptions.set(data.map((u: any) => ({
                    id: String(u.id),
                    name: nameFieldId ? String(u[nameFieldId] ?? '') : '',
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
            .getUsers(1, 9999)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (res: any) => {
                const data = res?.data || res;
                if (Array.isArray(data)) {
                  this.userOptions.set(data.map((u: any) => ({
                    id: String(u.id),
                    name: '',
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
    this.sections.set(this.deserializeSections(payload.sections ?? []));
    this.applyFrequencyToForm(payload);
    this.loadedSchema = payload;
    this.applyLoadedMeta();
    this.wireRowLocationDependencies();
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
    },
  ): FormFieldConfig {
    const type = field?.type ?? 'text';
    return {
      ...field,
      id: field?.id ?? createId('field'),
      type,
      label: field?.label ?? '',
      name: field?.name ?? '',
      required: field?.required ?? false,
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
      rangePlaceholderFrom: (field as any)?.rangePlaceholderFrom,
      rangePlaceholderTo: (field as any)?.rangePlaceholderTo,
      timeFormat:
        type === 'range' && normalizeRangeType((field as any)?.rangeType) === 'time'
          ? normalizeRangeTimeFormat((field as any)?.timeFormat)
          : undefined,
    };
  }

  private applyFrequencyToForm(payload: DynamicFormPayload): void {
    const frequency = payload.frequency ?? ({} as DynamicFormPayload['frequency']);
    const recurring = frequency.recurring ?? createDefaultFrequencyRecurring();

    this.frequencyForm.patchValue({
      type: frequency.type ?? 'atOnce',
      date: frequency.date ?? null,
      every: recurring.every ?? 1,
      interval: recurring.interval ?? 'month',
      repeatCount: recurring.repeatCount ?? 1,
      monthMode: recurring.monthMode ?? 'dayOfMonth',
      dayOfMonth: recurring.dayOfMonth ?? 1,
      weekOrder: recurring.weekOrder ?? 'first',
      onTheMonth: recurring.onTheMonth ?? 'january',
      daysOfWeek: [...(recurring.daysOfWeek ?? [])],
      yearMonth: recurring.yearMonth ?? 'january',
      yearDay: recurring.yearDay ?? 1,
    });
  }

  /** Map saved Assign/Report ids to display names once options are available. */
  private applyLoadedMeta(): void {
    const schema = this.loadedSchema;
    if (!schema) return;

    const userOptions = this.userOptions();
    const positionOptions = this.jobPositionOptions();

    this.meta.update((current) => ({
      ...current,
      assignJobPosition: this.resolveSelectedNames(schema.assign?.jobPosition, positionOptions),
      assignUsers: this.resolveSelectedNames(schema.assign?.users, userOptions),
      reportJobPosition: this.resolveSelectedNames(schema.report?.jobPosition, positionOptions),
      reportUsers: this.resolveSelectedNames(schema.report?.users, userOptions),
      frequencyJobPosition: (schema.frequency?.jobPosition ?? '')
        .split(', ')
        .map((name) => name.trim())
        .filter(Boolean),
    }));
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
    controlName: 'type' | 'interval' | 'weekOrder' | 'onTheMonth' | 'yearMonth',
    options: { label: string; value: string }[],
    placeholder: string,
  ): string {
    const val = this.frequencyForm.controls[controlName].value;
    const match = options.find((o) => o.value === val);
    return match?.label ?? placeholder;
  }

  selectFreqOption(
  controlName: 'type' | 'interval' | 'weekOrder' | 'onTheMonth' | 'yearMonth',
  value: string,
  dropdownSignal: WritableSignal<boolean>,
  searchSignal: WritableSignal<string>,
): void {
  this.frequencyForm.get(controlName)?.setValue(value);

  searchSignal.set('');
  dropdownSignal.set(false);
}

  onFreqSearch(event: Event, searchSignal: WritableSignal<string>): void {
    searchSignal.set((event.target as HTMLInputElement).value);
  }

  private syncFrequencyToMeta(): void {
    const value = this.frequencyForm.getRawValue();
    this.meta.update((current) => ({
      ...current,
      frequencyDate: value.date,
      frequencyType: value.type,
      frequencyRecurring: {
        every: Number(value.every) || 1,
        interval: value.interval,
        repeatCount: Number(value.repeatCount) || 1,
        daysOfWeek: [...value.daysOfWeek],
        monthMode: value.monthMode,
        dayOfMonth: Number(value.dayOfMonth),
        weekOrder: value.weekOrder,
        onTheMonth: value.onTheMonth,
        yearMonth: value.yearMonth,
        yearDay: Number(value.yearDay) || 1,
      },
    }));
  }

  private destroyFlatpickr(): void {
    if (this.flatpickrInstance) {
      this.flatpickrInstance.destroy();
      this.flatpickrInstance = null;
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
    this.updateSection({
      ...section,
      rows: section.rows.filter((row) => row.id !== rowId),
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
    value: string,
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

    this.applyRowLocationDependencies(section.id, rowId, fieldId, value, nextFields);
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

  openFieldModal(target: { sectionId: string; rowId: string }): void {
    this.pendingFieldTarget.set(target);
    this.initializeRowBuilderFields();
    this.builderSchema.set([]);
    this.selectedFieldId.set(null);
    this.builderActiveTab.set('fields');
    this.fieldBuilderOpen.set(true);
  }

  closeFieldBuilder(): void {
    const target = this.pendingFieldTarget();
    this.fieldBuilderOpen.set(false);
    this.pendingFieldTarget.set(null);
    this.builderActiveTab.set('fields');
    this.resetBuilderDraft();

    // Strip any all-States/all-Cities options that live field edits may have written.
    if (target) {
      this.initializeRowLocationDependencies(target.sectionId, target.rowId);
    }
  }

  onBuilderActiveTabChange(tab: FormBuilderTab): void {
    if (tab === 'settings' && !this.selectedFieldId()) {
      return;
    }
    this.builderActiveTab.set(tab);
  }

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

  onDuplicateField(field: FormField): void {
    if (this.isExistingRowField(field.id)) {
      const result = duplicateFormField(field, this.rowBuilderFields());
      this.rowBuilderFields.set(result.schema);
      if (result.duplicate) {
        this.appendRowFieldToSections(
          mapBuilderFieldToConfig(result.duplicate, { preserveId: true }),
        );
        this.onSelectField(result.duplicate);
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
    const blockReason = getLocationFieldDeleteBlockReason(
      field,
      this.builderCombinedSchema(),
    );
    if (blockReason) {
      return;
    }

    if (this.isExistingRowField(field.id)) {
      this.rowBuilderFields.update((fields) => removeFormField(field, fields));
      this.builderSchema.update((fields) => clearStaleConditionalLogic(fields, [field.id]));
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
    this.rowBuilderFields.update((fields) => clearStaleConditionalLogic(fields, [field.id]));
    this.pruneSectionConditions([field.id]);
    const selectedId = this.selectedFieldId();
    if (selectedId && !nextSchema.some((item) => item.id === selectedId)) {
      this.selectedFieldId.set(null);
      this.builderActiveTab.set('fields');
    }
  }

  onDeleteSelectedDraft(): void {
    const field = this.selectedBuilderField();
    if (field) {
      this.onDeleteField(field);
    }
  }

  onUpdateField(updated: FormField): void {
    if (this.isExistingRowField(updated.id)) {
      this.rowBuilderFields.update((fields) => updateFormField(updated, fields));
      this.updateRowFieldInSections(
        mapBuilderFieldToConfig(updated, { preserveId: true }),
      );
      return;
    }

    this.builderSchema.set(updateFormField(updated, this.builderSchema()));
  }

  /** Persist all newly added draft fields into the section/row that opened Add Field. */
  onBuilderSave(): void {
    const selected = this.selectedBuilderField();

    // Existing row-field edits are applied live; Save just returns to the palette.
    if (selected && this.isExistingRowField(selected.id)) {
      this.selectedFieldId.set(null);
      this.builderActiveTab.set('fields');
      const target = this.pendingFieldTarget();
      if (target) {
        this.initializeRowLocationDependencies(target.sectionId, target.rowId);
      }
      return;
    }

    if (!this.canSaveDraftField()) return;

    // Keep every newly dragged field from this builder session (order preserved).
    const fieldsToAdd = this.builderSchema().filter((field) => !!field.label?.trim());
    if (!fieldsToAdd.length) return;

    const target = this.pendingFieldTarget();
    for (const field of fieldsToAdd) {
      this.appendFieldToPendingTarget(
        mapBuilderFieldToConfig(field, { preserveId: true }),
      );
    }

    if (target) {
      this.initializeRowLocationDependencies(target.sectionId, target.rowId);
    }
    this.closeFieldBuilder();
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
      this.loadStateOptionsForRow(sectionId, rowId, state, country.value);
    }

    if (!city) return;

    if (state) {
      this.loadCityOptionsForStateRow(sectionId, rowId, city, state.value);
    } else if (country) {
      this.loadCityOptionsForCountryRow(sectionId, rowId, city, country.value);
    }
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

    // Keep consistent sizing with existing section fields; always append to the clicked row.
    const newField: FormFieldConfig = {
      ...field,
      isDefault: false,
      width: undefined,
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

  // ── Multi-Select Helpers ──────────────────────────────────────

  toggleMultiSelect(
    key: 'assignUsersDropdownOpen' | 'assignPositionsDropdownOpen' | 'reportUsersDropdownOpen' | 'reportPositionsDropdownOpen',
  ): void {
    const wasOpen = this[key]();
    this.closeAllMultiSelectDropdowns();
    if (!wasOpen) {
      this[key].set(true);
    }
  }

  private closeAllMultiSelectDropdowns(): void {
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
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    this.updateMeta(metaKey, updated as any);
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

  preview(): void {
    const payload = this.buildPayload();
    console.log('[Dynamic Forms] Preview payload:', payload);
  }

  cancel(): void {
    this.router.navigate(['/dynamic-forms']);
  }

  save(): void {
    if (!this.canSave()) return;

    const payload = this.buildPayload();
    const id = this.formId();

    if (id) {
      this.formsService
        .updateTemplate(Number(id), { name: this.formName(), schema: payload })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.toastr.success('Form updated successfully');
            this.router.navigate(['/dynamic-forms']);
          },
          error: (err) => {
            this.toastr.error(err?.error?.message || 'Failed to update form');
          },
        });
      return;
    }

    this.formsService
      .createForm({ name: this.formName(), schema: payload })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toastr.success('Form created successfully');
          this.router.navigate(['/dynamic-forms']);
        },
        error: (err) => {
          this.toastr.error(err?.error?.message || 'Failed to create form');
        },
      });
  }

  private buildPayload() {
    return buildDynamicFormPayload(this.formName(), this.sections(), this.meta(), {
      users: this.userOptions(),
      jobPositions: this.jobPositionOptions(),
    });
  }
}
