import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { FormField } from '../../../form-builder/models/form-field.model';
import {
  findFormField,
  getHiddenFormFields,
} from '../../../form-builder/utils/form-field-operations';

export type FormBuilderTab = 'fields' | 'settings' | 'versions';

@Component({
  selector: 'app-form-builder-workspace',
  standalone: false,
  templateUrl: './form-builder-workspace.component.html',
  styleUrl: './form-builder-workspace.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormBuilderWorkspaceComponent {
  @Input() moduleName = '';
  @Input() schema: FormField[] = [];
  @Input() selectedFieldId: string | null = null;
  @Input() activeTab: FormBuilderTab = 'fields';
  @Input() showPreviewAction = false;
  @Input() paletteListId = 'sidebarList';
  @Input() canvasListId = 'canvasList';

  @Output() selectField = new EventEmitter<FormField>();
  @Output() duplicateField = new EventEmitter<FormField>();
  @Output() deleteField = new EventEmitter<FormField>();
  @Output() updateField = new EventEmitter<FormField>();
  @Output() activeTabChange = new EventEmitter<FormBuilderTab>();
  @Output() save = new EventEmitter<void>();
  @Output() preview = new EventEmitter<void>();
  @Output() restoreVersion = new EventEmitter<FormField[]>();
  @Output() versionsLoadingChange = new EventEmitter<boolean>();
  @Output() dynamicOptionsLoadingChange = new EventEmitter<boolean>();

  get selectedField(): FormField | null {
    return findFormField(this.schema, this.selectedFieldId);
  }

  get hiddenFields(): FormField[] {
    return getHiddenFormFields(this.schema);
  }

  trackByFieldId(_index: number, field: FormField): string {
    return field.id;
  }

  setActiveTab(tab: FormBuilderTab): void {
    if (tab === 'settings' && !this.selectedFieldId) {
      return;
    }

    this.activeTabChange.emit(tab);
  }

  onDuplicateSelectedField(): void {
    const field = this.selectedField;
    if (field) {
      this.duplicateField.emit(field);
    }
  }

  onDeleteSelectedField(): void {
    const field = this.selectedField;
    if (field) {
      this.deleteField.emit(field);
    }
  }
}
