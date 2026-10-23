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

export type FormBuilderTab = 'fields' | 'settings' | 'versions' | 'logic';

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
  /**
   * Optional override for palette CDK connections (setup multi-row canvases).
   * When empty, palette connects only to `canvasListId`.
   */
  @Input() paletteConnectedDropLists: string[] = [];
  /** Scoped to user/item/vendor setup Edit Form Builder. */
  @Input() enforceUniqueDynamicModules = false;
  /**
   * Locks palette drag, field customization, and tab switches to settings.
   * Used by setup-user / setup-item / setup-vendor Bulk Delete mode.
   */
  @Input() interactionLocked = false;
  /**
   * Setup-user / setup-item / setup-vendor only: Form Template–like rail
   * proportions, Versions outside the default tabs, Field Settings header.
   * Leave false for legacy forms-editor.
   */
  @Input() setupChrome = false;
  /** Setup row-capacity Width in row options for the selected field. */
  @Input() availableRowWidthPresets: Array<'third' | 'half' | 'full'> = [
    'third',
    'half',
    'full',
  ];
  @Input() rowWidthCapacityHint: string | null = null;

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
  /** Emitted when setup chrome closes Field Settings (deselect). */
  @Output() clearSelection = new EventEmitter<void>();

  get selectedField(): FormField | null {
    return findFormField(this.schema, this.selectedFieldId);
  }

  get hiddenFields(): FormField[] {
    return getHiddenFormFields(this.schema);
  }

  trackByFieldId(_index: number, field: FormField): string {
    return field.id;
  }

  fieldTypeEyebrow(field: FormField): string {
    const raw = (field.fieldTypeName || field.type || 'field').toString();
    return raw.replace(/[-_]/g, ' ').trim().toUpperCase();
  }

  get resolvedPaletteConnectedDropLists(): string[] {
    return this.paletteConnectedDropLists.length
      ? this.paletteConnectedDropLists
      : [this.canvasListId];
  }

  setActiveTab(tab: FormBuilderTab): void {
    if (this.interactionLocked && tab === 'settings') {
      return;
    }

    if (tab === 'settings' && !this.selectedFieldId) {
      return;
    }

    this.activeTabChange.emit(tab);
  }

  closeSettingsPanel(): void {
    if (this.interactionLocked) {
      return;
    }
    this.clearSelection.emit();
    this.activeTabChange.emit('fields');
  }

  onDuplicateSelectedField(): void {
    if (this.interactionLocked) {
      return;
    }

    const field = this.selectedField;
    if (field) {
      this.duplicateField.emit(field);
    }
  }

  onDeleteSelectedField(): void {
    if (this.interactionLocked) {
      return;
    }

    const field = this.selectedField;
    if (field) {
      this.deleteField.emit(field);
    }
  }
}
