import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { FormField } from '../../form-builder/models/form-field.model';
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

  sidebarConnectedLists: string[] = ['canvasList'];
  canvasConnectedLists: string[] = ['sidebarList'];

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

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.moduleName = params['module'];

      if (this.moduleName === 'users') {
        this.loadSavedSchema();
      }
    });
  }

  onSchemaChange(schema: FormField[]) {
    this.builderSchema = this.normalizeOrder(schema);
  }

  onCanvasDrop(event: CdkDragDrop<FormField[]>) {
    if (event.previousContainer === event.container) {
      const reordered = [...this.builderSchema];
      moveItemInArray(reordered, event.previousIndex, event.currentIndex);
      this.builderSchema = this.normalizeOrder(reordered);
      return;
    }

    const template = event.item.data as Partial<FormField>;
    const field = this.createField(template);
    const updated = [...this.builderSchema];
    const targetIndex = Math.min(Math.max(event.currentIndex, 0), updated.length);

    updated.splice(targetIndex, 0, field);
    this.builderSchema = this.normalizeOrder(updated);
  }

  onSelectField(field: FormField) {
    this.selectedFieldId = field.id;
    this.activeTab = 'settings';
  }

  onDuplicateField(field: FormField) {
    const index = this.builderSchema.findIndex(item => item.id === field.id);
    if (index === -1) {
      return;
    }

    const clone: FormField = this.sanitizeField({
      ...field,
      id: this.generateFieldId(),
      options: [...(field.options || [])],
      condition: field.condition ? { ...field.condition } : { fieldId: '', value: '' }
    });

    const updated = [...this.builderSchema];
    updated.splice(index + 1, 0, clone);
    this.builderSchema = this.normalizeOrder(updated);
    this.onSelectField(clone);
  }

  onDeleteField(field: FormField) {
    this.builderSchema = this.normalizeOrder(this.builderSchema.filter(item => item.id !== field.id));

    if (this.selectedFieldId === field.id) {
      this.selectedFieldId = null;
    }
  }

  setActiveTab(tab: 'fields' | 'settings') {
    this.activeTab = tab;
  }

  updateField(updated: FormField) {
    const index = this.builderSchema.findIndex(field => field.id === updated.id);

    if (index === -1) {
      return;
    }

    this.builderSchema[index] = this.sanitizeField({
      ...updated,
      options: updated.options ? [...updated.options] : [],
      condition: updated.condition ? { ...updated.condition } : { fieldId: '', value: '' }
    });

    this.builderSchema = this.normalizeOrder([...this.builderSchema]);
  }

  buildPayload() {
    const orderedFields = this.normalizeOrder([...this.builderSchema]);

    return {
      schema: {
        sections: [],
        fields: orderedFields.map((field, index) => ({
          ...field,
          id: field.id,
          fieldTypeName: field.type,
          fieldKey: 'name',
          label: field.label,
          name: field.name || this.toFieldName(field.label),
          placeholder: field.placeholder,
          isRequired: field.required,
          isReadonly: false,
          isSystemField: true,
          isEditable: true,
          isDeletable: false,
          layoutConfig: {
            "grid_width_mobile": 12,
            "grid_width_desktop": 6
          },
          defaultValue: field.defaultValue ?? field.value ?? null,
          options: field.options || [],
          validations: field.validations || {},
          sortOrder: index + 1,
          width: field.width ?? 12

          // "fieldTypeId": 2,
          // "helpText": null,
          // "isUnique": false,
          // "isSystemDefault": true,
          // "isSystemField": true,
          // "systemMappingKey": "name",
          // "optionSource": null,
        })),
        conditionalRules: []
      },
      markAsDraft: true
    };
  }

  saveForm() {
    if (this.moduleName !== 'users') {
      return;
    }

    this.builderSchema = this.normalizeOrder([...this.builderSchema]);

    this.formStorageService.saveForm('users', {
      formName: this.formName,
      formId: this.formId,
      fields: this.builderSchema,
      markAsDraft: true
    }).subscribe({
      next: () => {
        console.log('Saved form payload:', this.buildPayload());
      },
      error: (error) => {
        console.error('Failed to save form schema:', error);
      }
    });
  }

  previewPayload() {
    console.log('Preview payload:', this.buildPayload());
  }

  trackById(index: number, item: FormField): string | number {
    return item?.id ?? index;
  }

  private createField(template: Partial<FormField>): FormField {
    return this.sanitizeField({
      id: this.generateFieldId(),
      type: (template.type || 'text') as FormField['type'],
      label: template.label || 'Untitled Field',
      name: template.name || this.toFieldName(template.label || 'field'),
      placeholder: template.placeholder || '',
      required: template.required || false,
      options: [...(template.options || [])],
      value: template.value ?? null,
      defaultValue: template.defaultValue ?? null,
      validations: template.validations ? { ...template.validations } : {},
      width: template.width ?? 12,
      condition: template.condition ? { ...template.condition } : { fieldId: '', value: '' }
    });
  }

  private loadSavedSchema() {
    this.formStorageService.loadForm('users').subscribe({
      next: (saved) => {
        if (!saved) {
          this.builderSchema = [];
          return;
        }

        this.formName = saved.formName || this.formName;
        this.formId = saved.formId ?? null;
        this.builderSchema = this.normalizeOrder(saved.fields || []);
      },
      error: (error) => {
        console.error('Failed to load form schema:', error);
        this.builderSchema = [];
      }
    });
  }

  private normalizeOrder(schema: FormField[]): FormField[] {
    return schema.map((field, index) => this.sanitizeField(field, index + 1));
  }

  private sanitizeField(field: Partial<FormField>, order?: number): FormField {
    const label = typeof field.label === 'string' && field.label.trim()
      ? field.label
      : 'Untitled Field';

    return {
      id: field.id || this.generateFieldId(),
      type: (field.type || 'text') as FormField['type'],
      label,
      name: field.name || this.toFieldName(label),
      placeholder: field.placeholder || '',
      required: field.required || false,
      options: [...(field.options || [])],
      value: field.value ?? null,
      defaultValue: field.defaultValue ?? null,
      validations: field.validations ? { ...field.validations } : {},
      width: field.width ?? 12,
      order: order ?? field.order,
      condition: field.condition ? { ...field.condition } : { fieldId: '', value: '' }
    };
  }

  private generateFieldId(): string {
    return `fld_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  private toFieldName(label: string | null | undefined): string {
    const normalizedLabel = String(label ?? 'field');
    const fieldName = normalizedLabel
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

    return fieldName || 'field';
  }
}
