import { Component, computed, DestroyRef, ElementRef, inject, OnInit, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgSelectModule } from '@ng-select/ng-select';
import { TenantSessionService } from '../../../../../services/tenant-session.service';
import { TenantUserService } from '../../../../../services/tenant-user.service';
import { TenantJobPositionService } from '../../../../../services/tenant-job-position.service';
import { DynamicFormsStoreService } from '../services/dynamic-forms-store.service';
import { DataEntrySectionComponent } from '../components/data-entry-section/data-entry-section.component';
import { ChecklistFormSectionComponent } from '../components/checklist-form-section/checklist-form-section.component';
import { VisualFormSectionComponent } from '../components/visual-form-section/visual-form-section.component';
import { FieldCreateModalComponent } from '../components/field-create-modal/field-create-modal.component';
import {
  ChecklistFormSection,
  DataEntrySection,
  FormFieldConfig,
  FormMetaConfig,
  FormSection,
  SECTION_OPTIONS,
  SectionType,
  VisualFormSection,
  buildDynamicFormPayload,
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
    NgSelectModule,
    DataEntrySectionComponent,
    ChecklistFormSectionComponent,
    VisualFormSectionComponent,
    FieldCreateModalComponent,
  ],
  templateUrl: './create-form.component.html',
  styleUrl: './create-form.component.scss',
})
export class CreateFormComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly session = inject(TenantSessionService);
  private readonly store = inject(DynamicFormsStoreService);
  private readonly userService = inject(TenantUserService);
  private readonly jobPositionService = inject(TenantJobPositionService);
  private readonly destroyRef = inject(DestroyRef);

  readonly sectionOptions = SECTION_OPTIONS;
  private readonly addSectionSelect = viewChild<ElementRef<HTMLSelectElement>>('addSectionSelect');

  /** Options with `disabled` flag for types already added to the form. */
  readonly availableSectionOptions = computed(() => {
    const usedTypes = new Set(this.sections().map((s) => s.type));
    return this.sectionOptions.map((opt) => ({
      ...opt,
      disabled: usedTypes.has(opt.value),
    }));
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
  });

  readonly fieldModalOpen = signal(false);
  private readonly pendingFieldTarget = signal<{ sectionId: string; rowId: string } | null>(null);

  readonly hasSections = computed(() => this.sections().length > 0);
  readonly canSave = computed(() => this.formName().trim().length > 0 && this.hasSections());

  // ── Wizard State ──────────────────────────────────────────────
  readonly currentStep = signal(1);
  readonly totalSteps = 4;

  readonly steps: WizardStep[] = [
    { label: 'Form Details', number: 1 },
    { label: 'Assign', number: 2 },
    { label: 'Report', number: 3 },
    { label: 'Frequency', number: 4 },
  ];

  readonly isFirstStep = computed(() => this.currentStep() === 1);
  readonly isLastStep = computed(() => this.currentStep() === this.totalSteps);

  readonly step1Valid = computed(
    () => this.formName().trim().length > 0 && this.sections().length > 0,
  );

  // ── Dynamic Options ──────────────────────────────────────────
  readonly jobPositionOptions = signal<{ id: string; name: string }[]>([]);
  readonly userOptions = signal<{ id: string; name: string }[]>([]);

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
            this.userOptions.set(data.map((u: any) => ({ id: String(u.id), name: u.fld_1784019110336_gor66xq })));
          }
        },
        error: () => this.userOptions.set([]),
      });
  }

  // ── Section Management ────────────────────────────────────────

  onAddSection(): void {
    const type = this.selectedSectionType();
    if (!type) return;

    this.sections.update((list) => [...list, createSection(type)]);
    this.selectedSectionType.set('');
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

  /** Resets the Add Section control to "Select section" (signal + native select sync). */
  private resetAddSectionDropdown(): void {
    this.selectedSectionType.set('');
    const selectEl = this.addSectionSelect()?.nativeElement;
    if (selectEl) {
      selectEl.value = '';
    }
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

    this.sections.update((list) =>
      list.map((section) => {
        if (section.id !== target.sectionId) return section;
        if (section.type === 'visualForm') return section;

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

    this.closeFieldModal();
  }

  updateMeta<K extends keyof FormMetaConfig>(key: K, value: FormMetaConfig[K]): void {
    this.meta.update((current) => ({ ...current, [key]: value }));
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
