import { CdkDragDrop, moveItemInArray, transferArrayItem  } from '@angular/cdk/drag-drop';
import { Component, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { CdkDropList } from '@angular/cdk/drag-drop';
import { FormField } from '../../models/form-field.model';
import { FIELD_TEMPLATES } from '../../data/field-templates';
import { v4 as uuidv4 } from 'uuid';

@Component({
  selector: 'app-builder',
  standalone: false,
  templateUrl: './builder.component.html',
  styleUrl: './builder.component.scss',
})
export class BuilderComponent {
  @Output() schemaChange = new EventEmitter<FormField[]>();
  @Input() connectedDropLists: Array<CdkDropList<any> | string> = [];
  @ViewChild('sidebarList', { static: true }) sidebarListRef!: CdkDropList;
  fieldTemplates = FIELD_TEMPLATES;

  // Canvas schema (REAL FORM STRUCTURE)
  formFields: FormField[] = [];

  // Selected field for settings panel
  selectedField: FormField | null = null;

  // =========================
  // DROP HANDLER (CDK)
  // =========================
drop(event: CdkDragDrop<FormField[]>) {

  if (event.previousContainer === event.container) {
    moveItemInArray(
      this.formFields,
      event.previousIndex,
      event.currentIndex
    );
  } else {
    transferArrayItem(
      event.previousContainer.data,
      this.formFields,
      event.previousIndex,
      event.currentIndex
    );
  }

  this.formFields = [...this.formFields];
  this.schemaChange.emit(this.formFields);
}

  // =========================
  // SELECT FIELD
  // =========================
selectField(field: FormField) {
  this.selectedField = {
    ...field,
    condition: field.condition ?? { fieldId: '', value: '' }
  };
}

isVisible(field: FormField): boolean {

  if (!field.condition?.fieldId) return true;

  const target = this.formFields.find(
    f => f.id === field.condition!.fieldId
  );

  if (!target) return true;

  return target.value === field.condition.value;
}

  // =========================
  // LIVE UPDATE FROM SETTINGS PANEL
  // =========================
  updateField(updated: FormField) {

    const index = this.formFields.findIndex(f => f.id === updated.id);

    if (index === -1) return;

    // SAFE UPDATE (IMMUTABLE STYLE)
    this.formFields[index] = {
      ...updated,
      options: updated.options ? [...updated.options] : []
    };

    // force Angular change detection refresh
    this.formFields = [...this.formFields];

    // keep selected field in sync
    this.selectedField = this.formFields[index];
  }

  deleteField(id: string) {
  this.formFields = this.formFields.filter(f => f.id !== id);

  // clear selection if deleted field was selected
  if (this.selectedField?.id === id) {
    this.selectedField = null;
  }
}

duplicateField(field: FormField) {

  const copy: FormField = {
    ...field,
    id: uuidv4(),
    label: field.label + ' Copy',
    options: field.options ? [...field.options] : []
  };

  const index = this.formFields.findIndex(f => f.id === field.id);

  this.formFields.splice(index + 1, 0, copy);

  this.formFields = [...this.formFields];
}

saveSchema() {
  const json = JSON.stringify(this.formFields, null, 2);
  localStorage.setItem('form_schema', json);

  console.log('Schema saved:', json);
}

loadSchema() {
  const data = localStorage.getItem('form_schema');

  if (!data) return;

  this.formFields = JSON.parse(data);

  this.selectedField = null;
}

  // =========================
  // TRACK BY ID (PERFORMANCE)
  // =========================
trackById(index: number, item: FormField): string {
  return item?.id ?? index.toString();
}

trackByTemplate(index: number, item: Omit<FormField, 'id'>): string {
  return `${item.type}-${item.label}-${index}`;
}
}
