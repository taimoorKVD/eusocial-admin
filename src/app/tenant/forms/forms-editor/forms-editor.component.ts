import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { FormField } from '../../form-builder/models/form-field.model';
import {
  createFieldFromTemplate,
  normalizeFieldOrder,
  sanitizeField,
} from '../../form-builder/utils/form-field.factory';
import { FormStorageService } from '../services/form-storage.service';

@Component({
  selector: 'app-forms-editor',
  standalone: false,
  templateUrl: './forms-editor.component.html',
  styleUrl: './forms-editor.component.scss',
})
export class FormsEditorComponent {
  moduleName = '';
  builderSchema: FormField[] = [];
  selectedFieldId: string | null = null;
  activeTab: 'fields' | 'settings' = 'fields';
  formName = 'Users Dynamic Form';
  formId: string | number | null = null;
  isLoading = false;

  /** Connected list IDs (palette ↔ canvas). */
  readonly paletteListId = 'sidebarList';
  readonly canvasListId = 'canvasList';

  constructor(
    private route: ActivatedRoute,
    private formStorageService: FormStorageService
  ) {}

  get selectedField(): FormField | null {
    if (!this.selectedFieldId) {
      return null;
    }

    return this.builderSchema.find(field => field.id === this.selectedFieldId) || null;
  }

  get hiddenFields(): FormField[] {
    return this.builderSchema.filter(field => field.isShow === false);
  }

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.moduleName = params['module'];

      if (this.moduleName === 'users') {
        this.loadSavedSchema();
      }
    });
  }

  /**
   * CDK drop handler — official connected-list pattern:
   * - same container: reorder with moveItemInArray
   * - palette → canvas: clone template (never transferArrayItem)
   */
  onCanvasDrop(event: CdkDragDrop<FormField[]>): void {
    if (event.previousContainer === event.container) {
      const reordered = [...this.builderSchema];
      moveItemInArray(reordered, event.previousIndex, event.currentIndex);
      this.builderSchema = normalizeFieldOrder(reordered);
      return;
    }

    const template = event.item.data as Partial<FormField>;
    const field = createFieldFromTemplate(template);
    const updated = [...this.builderSchema];
    const insertIndex = Math.min(
      Math.max(event.currentIndex, 0),
      updated.length
    );

    updated.splice(insertIndex, 0, field);
    this.builderSchema = normalizeFieldOrder(updated);
    this.onSelectField(field);
  }

  onSelectField(field: FormField): void {
    this.selectedFieldId = field.id;
    this.activeTab = 'settings';
  }

  trackByFieldId(_index: number, field: FormField): string {
    return field.id;
  }

  onDuplicateField(field: FormField): void {
    const index = this.builderSchema.findIndex(item => item.id === field.id);
    if (index === -1) {
      return;
    }

    const clone = createFieldFromTemplate({
      ...field,
      label: `${field.label} Copy`,
    });

    const updated = [...this.builderSchema];
    updated.splice(index + 1, 0, clone);
    this.builderSchema = normalizeFieldOrder(updated);
    this.onSelectField(clone);
  }

  onDeleteField(field: FormField): void {
    this.builderSchema = normalizeFieldOrder(
      this.builderSchema.filter(item => item.id !== field.id)
    );

    if (this.selectedFieldId === field.id) {
      this.selectedFieldId = null;
      this.activeTab = 'fields';
    }
  }

  setActiveTab(tab: 'fields' | 'settings'): void {
    if (tab === 'settings' && !this.selectedFieldId) {
      return;
    }

    this.activeTab = tab;
  }

  updateField(updated: FormField): void {
    const index = this.builderSchema.findIndex(field => field.id === updated.id);

    if (index === -1) {
      return;
    }

    this.builderSchema[index] = sanitizeField({
      ...updated,
      isShow: updated.isShow !== false,
      isReadonly: updated.isReadonly === true,
      options: [...(updated.options || [])],
      optionSource: updated.optionSource
        ? { ...updated.optionSource }
        : undefined,
      condition: updated.condition
        ? { ...updated.condition }
        : { fieldId: '', value: '' },
    });

    this.builderSchema = normalizeFieldOrder([...this.builderSchema]);
    this.selectedFieldId = updated.id;
    this.activeTab = 'settings';
  }

  buildPayload() {
    const orderedFields = normalizeFieldOrder([...this.builderSchema]);

    return {
      schema: {
        sections: [],
        fields: orderedFields.map((field, index) => ({
          ...field,
          id: field.id,
          fieldTypeName: field.fieldTypeName || field.type,
          fieldKey: 'name',
          label: field.label,
          name: field.name || field.label,
          placeholder: field.placeholder,
          isRequired: field.required,
          isShow: field.isShow !== false,
          optionSource: field.optionSource,
          isReadonly: field.isReadonly === true,
          isSystemField: true,
          isEditable: true,
          isDeletable: false,
          layoutConfig: {
            grid_width_mobile: 12,
            grid_width_desktop: 6,
          },
          defaultValue: field.defaultValue ?? field.value ?? null,
          options: field.options || [],
          validations: field.validations || {},
          sortOrder: index + 1,
          width: field.width ?? 12,
        })),
        conditionalRules: [],
      },
      markAsDraft: true,
    };
  }

  saveForm(): void {
    if (this.moduleName !== 'users') {
      return;
    }

    this.isLoading = true;
    this.builderSchema = normalizeFieldOrder([...this.builderSchema]);

    this.formStorageService
      .saveForm('users', {
        formName: this.formName,
        formId: this.formId,
        fields: this.builderSchema,
        markAsDraft: true,
      })
      .subscribe({
        next: () => {
          console.log('Saved form payload:', this.buildPayload());
          this.isLoading = false;
        },
        error: error => {
          console.error('Failed to save form schema:', error);
          this.isLoading = false;
        },
      });
  }

  previewPayload(): void {
    console.log('Preview payload:', this.buildPayload());
  }

  private loadSavedSchema(): void {
    this.formStorageService.loadForm('users').subscribe({
      next: saved => {
        if (!saved) {
          this.builderSchema = [];
          return;
        }

        this.formName = saved.formName || this.formName;
        this.formId = saved.formId ?? null;
        this.builderSchema = normalizeFieldOrder(saved.fields || []);
      },
      error: error => {
        console.error('Failed to load form schema:', error);
        this.builderSchema = [];
      },
    });
  }
}
