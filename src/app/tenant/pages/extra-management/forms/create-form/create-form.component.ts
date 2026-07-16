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
import { Router } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';
import flatpickr from 'flatpickr';
import { Instance as FlatpickrInstance } from 'flatpickr/dist/types/instance';
import { TenantSessionService } from '../../../../../services/tenant-session.service';
import { TenantUserService } from '../../../../../services/tenant-user.service';
import { TenantJobPositionService } from '../../../../../services/tenant-job-position.service';
import { DynamicFormsStoreService } from '../services/dynamic-forms-store.service';
import { DataEntrySectionComponent } from '../components/data-entry-section/data-entry-section.component';
import { ChecklistFormSectionComponent } from '../components/checklist-form-section/checklist-form-section.component';
import { VisualFormSectionComponent } from '../components/visual-form-section/visual-form-section.component';
import { ResponseFormSectionComponent } from '../components/response-form-section/response-form-section.component';
import { FieldCreateModalComponent } from '../components/field-create-modal/field-create-modal.component';
import {
  ChecklistFormSection,
  createDefaultFrequencyRecurring,
  DataEntrySection,
  FormFieldConfig,
  FormMetaConfig,
  FormSection,
  FrequencyInterval,
  FrequencyMonthMode,
  FrequencyType,
  ResponseFormSection,
  SECTION_OPTIONS,
  SectionType,
  VisualFormSection,
  buildDynamicFormPayload,
  createId,
  createSection,
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
    ResponseFormSectionComponent,
    DataEntrySectionComponent,
    ChecklistFormSectionComponent,
    VisualFormSectionComponent,
    FieldCreateModalComponent,
  ],
  templateUrl: './create-form.component.html',
  styleUrl: './create-form.component.scss',
})
export class CreateFormComponent implements OnInit {
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.section-dropdown')) {
      this.sectionDropdownOpen.set(false);
      this.sectionSearchQuery.set('');
    }
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
  private readonly session = inject(TenantSessionService);
  private readonly store = inject(DynamicFormsStoreService);
  private readonly userService = inject(TenantUserService);
  private readonly jobPositionService = inject(TenantJobPositionService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);

  readonly sectionOptions = SECTION_OPTIONS;
  private readonly frequencyDateInput = viewChild<ElementRef<HTMLInputElement>>('frequencyDateInput');
  private flatpickrInstance: FlatpickrInstance | null = null;

  /** Options with `disabled` flag for types already added to the form. */
  readonly availableSectionOptions = computed(() => {
    const usedTypes = new Set(this.sections().map((s) => s.type));
    return this.sectionOptions.map((opt) => ({
      ...opt,
      disabled: usedTypes.has(opt.value),
    }));
  });

  readonly sectionDropdownOpen = signal(false);
  readonly sectionSearchQuery = signal('');

  readonly filteredSectionOptions = computed(() => {
    const query = this.sectionSearchQuery().trim().toLowerCase();
    const options = this.availableSectionOptions();
    return query
      ? options.filter((opt) => opt.label.toLowerCase().includes(query))
      : options;
  });

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
  readonly selectedSectionType = signal<SectionType | ''>('');
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

  readonly fieldModalOpen = signal(false);
  private readonly pendingFieldTarget = signal<{ sectionId: string; rowId: string } | null>(null);

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
      this.currentStep.update((s) => s + 1);
    }
  }

  prevStep(): void {
    if (this.currentStep() > 1) {
      this.currentStep.update((s) => s - 1);
    }
  }

  goToStep(stepNum: number): void {
    if (stepNum < this.currentStep()) {
      this.currentStep.set(stepNum);
    }
  }

  // ── Lifecycle ────────────────────────────────────────────────

  ngOnInit(): void {
    this.loadJobPositions();
    this.loadUsers();
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
        },
        error: () => this.jobPositionOptions.set([]),
      });
  }

  private loadUsers(): void {
    this.userService
      .getUsers(1, 9999)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res: any) => {
          const data = res?.data || res;
          if (Array.isArray(data)) {
            this.userOptions.set(data.map((u: any) => ({ id: String(u.id), name: u.fld_1784206421607_5byrqvw })));
          }
        },
        error: () => this.userOptions.set([]),
      });
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

  onAddSection(): void {
    const type = this.selectedSectionType();
    if (!type) return;

    this.sections.update((list) => [...list, createSection(type)]);
  }

  onSectionTypeChange(value: string): void {
    console.log('[Dynamic Forms] Section type changed:', value);
    const type = (value || '') as SectionType | '';
    this.selectedSectionType.set(type);
    if (type && !this.isTypeAlreadyUsed(type)) {
      this.onAddSection();
    } else {
      this.selectedSectionType.set('');
    }
  }

  onSectionSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.sectionSearchQuery.set(value);
  }

  selectSectionOption(opt: { value: SectionType; label: string; disabled: boolean }): void {
    if (opt.disabled) return;
    this.sectionSearchQuery.set('');
    this.sectionDropdownOpen.set(false);
    this.onSectionTypeChange(opt.value);
  }

  getSectionDisplayLabel(): string {
    if (!this.selectedSectionType()) {
      return 'Select section';
    }
    const match = this.sectionOptions.find((o) => o.value === this.selectedSectionType());
    return match?.label ?? 'Select section';
  }

  private isTypeAlreadyUsed(type: SectionType): boolean {
    return this.sections().some((s) => s.type === type);
  }

  updateSection(updated: FormSection): void {
    this.sections.update((list) =>
      list.map((section) => (section.id === updated.id ? updated : section)),
    );
  }

  removeSection(sectionId: string): void {
    this.sections.update((list) => list.filter((s) => s.id !== sectionId));
    this.resetAddSectionDropdown();
  }

  /** Resets the Add Section control to "Select section". */
  private resetAddSectionDropdown(): void {
    this.selectedSectionType.set('');
    this.sectionSearchQuery.set('');
    this.sectionDropdownOpen.set(false);
  }

  openFieldModal(target: { sectionId: string; rowId: string }): void {
    this.pendingFieldTarget.set(target);
    this.fieldModalOpen.set(true);
  }

  closeFieldModal(): void {
    this.fieldModalOpen.set(false);
    this.pendingFieldTarget.set(null);
  }

  onFieldSaved(field: FormFieldConfig): void {
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
        if (!('rows' in section)) return section;

        const rows = section.rows.length
          ? section.rows
          : [{ id: createId('row'), fields: [] as FormFieldConfig[] }];

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

    this.closeFieldModal();
  }

  updateMeta<K extends keyof FormMetaConfig>(key: K, value: FormMetaConfig[K]): void {
    this.meta.update((current) => ({ ...current, [key]: value }));
  }

  // ── Multi-Select Helpers ──────────────────────────────────────

  toggleMultiSelect(
    key: 'assignUsersDropdownOpen' | 'assignPositionsDropdownOpen' | 'reportUsersDropdownOpen' | 'reportPositionsDropdownOpen',
  ): void {
    this[key].set(!this[key]());
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

  asResponseForm(section: FormSection): ResponseFormSection {
    return section as ResponseFormSection;
  }

  asDataEntry(section: FormSection): DataEntrySection {
    return section as DataEntrySection;
  }

  asChecklist(section: FormSection): ChecklistFormSection {
    return section as ChecklistFormSection;
  }

  asVisual(section: FormSection): VisualFormSection {
    return section as VisualFormSection;
  }

  preview(): void {
    const payload = this.buildPayload();
    console.log('[Dynamic Forms] Preview payload:', payload);
  }

  cancel(): void {
    this.router.navigate(['/tenant', this.session.getSlug(), 'dynamic-forms']);
  }

  save(): void {
    if (!this.canSave()) return;

    const payload = this.buildPayload();
    console.log('[Dynamic Forms] Submit payload:', payload);
    this.store.save(payload);
    this.router.navigate(['/tenant', this.session.getSlug(), 'dynamic-forms']);
  }

  private buildPayload() {
    return buildDynamicFormPayload(this.formName(), this.sections(), this.meta());
  }
}
