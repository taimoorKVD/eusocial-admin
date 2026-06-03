import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormField } from '../../form-builder/models/form-field.model';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
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

  constructor(
    private route: ActivatedRoute,
    private formStorageService: FormStorageService
  ) {}

  get selectedField(): FormField | null {
    if (!this.selectedFieldId) return null;
    return this.builderSchema.find(f => f.id === this.selectedFieldId) || null;
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

    const clone: FormField = {
      ...field,
      id: this.generateFieldId(),
      options: [...(field.options || [])],
      condition: field.condition ? { ...field.condition } : { fieldId: '', value: '' }
    };

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

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.moduleName = params['module'];
      if (this.moduleName === 'users') {
        this.loadSavedSchema();
      }
    });
  }

  updateField(updated: FormField) {
    const index = this.builderSchema.findIndex(
      f => f.id === updated.id
    );

    if (index === -1) return;

    this.builderSchema[index] = {
      ...updated,
      options: updated.options ? [...updated.options] : [],
      condition: updated.condition
        ? { ...updated.condition }
        : { fieldId: '', value: '' }
    };

    this.builderSchema = this.normalizeOrder([...this.builderSchema]);
  }

  buildPayload() {
    return {
      moduleName: 'users',
      formName: this.formName,
      formId: this.formId,
      fields: this.builderSchema.map((field, index) => ({
        ...field,
        id: field.id,
        type: field.type,
        label: field.label,
        name: field.name || this.toFieldName(field.label),
        placeholder: field.placeholder,
        required: field.required,
        defaultValue: field.defaultValue ?? field.value ?? null,
        options: field.options || [],
        validations: field.validations || {},
        order: index + 1,
        width: field.width ?? 12
      }))
    };
  }

  saveForm() {
    if (this.moduleName !== 'users') {
      return;
    }

    this.formStorageService.saveForm('users', {
      formName: this.formName,
      formId: this.formId,
      fields: this.builderSchema
    });

    console.log('Saved form payload:', this.buildPayload());
  }

  previewPayload() {
    console.log('Preview payload:', this.buildPayload());
  }

  private createField(template: Partial<FormField>): FormField {
    return {
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
      condition: template.condition
        ? { ...template.condition }
        : { fieldId: '', value: '' }
    };
  }

  private loadSavedSchema() {
    const saved = this.formStorageService.loadForm('users');
    if (!saved) {
      this.builderSchema = [];
      return;
    }

    this.formName = saved.formName || this.formName;
    this.formId = saved.formId ?? null;
    this.builderSchema = this.normalizeOrder(saved.fields || []);
  }

  private normalizeOrder(schema: FormField[]): FormField[] {
    return schema.map((field, index) => ({
      ...field,
      order: index + 1,
      options: [...(field.options || [])],
      condition: field.condition ? { ...field.condition } : { fieldId: '', value: '' },
      validations: field.validations ? { ...field.validations } : {}
    }));
  }

  private generateFieldId(): string {
    return `fld_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  private toFieldName(label: string): string {
    return label
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }
}
