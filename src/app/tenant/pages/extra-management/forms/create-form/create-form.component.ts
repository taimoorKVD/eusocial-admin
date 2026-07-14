import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TenantSessionService } from '../../../../../services/tenant-session.service';
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

@Component({
  selector: 'app-create-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DataEntrySectionComponent,
    ChecklistFormSectionComponent,
    VisualFormSectionComponent,
    FieldCreateModalComponent,
  ],
  templateUrl: './create-form.component.html',
  styleUrl: './create-form.component.scss',
})
export class CreateFormComponent {
  private readonly router = inject(Router);
  private readonly session = inject(TenantSessionService);
  private readonly store = inject(DynamicFormsStoreService);

  readonly sectionOptions = SECTION_OPTIONS;

  readonly formName = signal('');
  readonly sections = signal<FormSection[]>([]);
  readonly selectedSectionType = signal<SectionType | ''>('');
  readonly meta = signal<FormMetaConfig>({
    assignJobPosition: null,
    assignUsers: null,
    reportJobPosition: null,
    reportUsers: null,
    frequencyJobPosition: null,
    frequencyDate: null,
  });

  readonly fieldModalOpen = signal(false);
  private readonly pendingFieldTarget = signal<{ sectionId: string; rowId: string } | null>(null);

  readonly hasSections = computed(() => this.sections().length > 0);
  readonly canSave = computed(() => this.formName().trim().length > 0 && this.hasSections());

  /** Placeholder options until API integration */
  readonly jobPositionOptions = [
    { label: 'Manager', value: 'manager' },
    { label: 'Supervisor', value: 'supervisor' },
    { label: 'Staff', value: 'staff' },
  ];

  readonly userOptions = [
    { label: 'All Users', value: 'all' },
    { label: 'Assigned Users', value: 'assigned' },
  ];

  onAddSection(): void {
    const type = this.selectedSectionType();
    if (!type) return;

    this.sections.update((list) => [...list, createSection(type)]);
    this.selectedSectionType.set('');
  }

  onSectionTypeChange(value: string): void {
    this.selectedSectionType.set((value || '') as SectionType | '');
    if (value) {
      this.onAddSection();
    }
  }

  updateSection(updated: FormSection): void {
    this.sections.update((list) =>
      list.map((section) => (section.id === updated.id ? updated : section)),
    );
  }

  removeSection(sectionId: string): void {
    this.sections.update((list) => list.filter((s) => s.id !== sectionId));
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
