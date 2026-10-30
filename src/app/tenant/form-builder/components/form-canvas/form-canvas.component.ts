import {
  Component,
  EventEmitter,
  Input,
  Output,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  CdkDragDrop,
  CdkDropList,
  DragDropModule,
} from '@angular/cdk/drag-drop';
import { FormField } from '../../models/form-field.model';
import { FormFieldPreviewComponent } from '../form-field-preview/form-field-preview.component';
import { AutomationRuleIconComponent } from '../../icons/automation-rule-icon.component';
import { LogicMapIconComponent } from '../../icons/logic-map-icon.component';
import { isFormFieldBulkDeletable } from '../../utils/form-field-operations';

@Component({
  selector: 'app-form-canvas',
  standalone: true,
  imports: [
    CommonModule,
    DragDropModule,
    FormFieldPreviewComponent,
    LogicMapIconComponent,
    AutomationRuleIconComponent,
  ],
  templateUrl: './form-canvas.component.html',
  styleUrl: './form-canvas.component.scss',
})
export class FormCanvasComponent {
  @Input() schema: FormField[] = [];
  @Input() selectedFieldId: string | null = null;
  @Input() connectedDropLists: Array<CdkDropList<FormField[]> | string> = [];
  @Input() dropListId = 'canvasList';
  /** When true, show multi-select checkboxes and disable drag/drop. */
  @Input() selectionMode = false;
  /** Field ids currently selected for bulk actions. */
  @Input() selectedFieldIds: string[] = [];
  /** Disables drag/drop and field click-to-edit (e.g. bulk delete mode). */
  @Input() interactionsDisabled = false;
  /**
   * Form Template only: show Conditional Logic / Automation Rules shortcuts
   * under each field. Other Form Builder hosts leave this false.
   */
  @Input() showFieldQuickActions = false;
  /**
   * Form Template Build only: Figma field-card chrome (drag grip + filled
   * preview controls). Setup modules and other hosts leave this false.
   */
  @Input() formTemplateBuildUi = false;
  /**
   * Form Template Build rows: lay fields out in one horizontal band using each
   * field's 12-col `width` (Width in row). Other hosts keep the default 2-col grid.
   */
  @Input() widthAwareLayout = false;
  /**
   * Setup modules (flat canvas): wrap fields and size each as a fraction of the
   * full row (units/12). Leave false for Form Template per-row canvases.
   */
  @Input() widthAwareFlow = false;
  /** Field ids with configured Conditional Logic (Form Template). */
  @Input() fieldsWithConditionalLogic: readonly string[] = [];
  /** Field ids referenced by Automation Rules (Form Template). */
  @Input() fieldsWithAutomationRules: readonly string[] = [];

  /** Normalize Width-in-row units to 4 / 6 / 12. */
  fieldWidthUnits(field: FormField): number {
    const width = field.width ?? 12;
    if (width <= 4) {
      return 4;
    }
    if (width <= 6) {
      return 6;
    }
    return 12;
  }

  /** Total Width-in-row units currently occupied in this canvas row. */
  private rowUsedUnits(): number {
    const used = this.schema.reduce(
      (sum, field) => sum + this.fieldWidthUnits(field),
      0,
    );
    return Math.max(used, 1);
  }

  /**
   * Flex basis for Width in row.
   * - Flow (setup flat canvas): absolute % of full row (units/12), wraps.
   * - Row (Form Template): relative to siblings; parent sizes the canvas band.
   */
  fieldWidthFlexBasis(field: FormField): string {
    const units = this.fieldWidthUnits(field);
    if (this.widthAwareFlow) {
      return `calc(${(units / 12) * 100}% - 0.5rem)`;
    }
    const used = this.rowUsedUnits();
    const gapOffset = this.schema.length > 1 ? '0.5rem' : '0px';
    return `calc(${(units / used) * 100}% - ${gapOffset})`;
  }

  @Output() dropped = new EventEmitter<CdkDragDrop<FormField[]>>();
  @Output() selectField = new EventEmitter<FormField>();
  @Output() toggleFieldSelection = new EventEmitter<FormField>();
  @Output() openConditionalLogic = new EventEmitter<FormField>();
  @Output() openAutomationRules = new EventEmitter<FormField>();

  @ViewChild('canvasList', { static: true })
  canvasListRef!: CdkDropList<FormField[]>;

  isDraggingField = false;

  get isDragDropDisabled(): boolean {
    return this.selectionMode || this.interactionsDisabled;
  }

  onDrop(event: CdkDragDrop<FormField[]>): void {
    if (this.isDragDropDisabled) {
      return;
    }

    this.dropped.emit(event);
  }

  onFieldClick(field: FormField): void {
    if (this.isDraggingField) {
      return;
    }

    if (this.selectionMode) {
      if (this.isFieldDeletable(field)) {
        this.toggleFieldSelection.emit(field);
      }
      return;
    }

    if (this.interactionsDisabled) {
      return;
    }

    this.selectField.emit(field);
  }

  onCheckboxChange(field: FormField, event: Event): void {
    event.stopPropagation();

    if (!this.selectionMode || !this.isFieldDeletable(field)) {
      return;
    }

    this.toggleFieldSelection.emit(field);
  }

  onCheckboxClick(event: Event): void {
    event.stopPropagation();
  }

  onQuickActionClick(event: Event, field: FormField, action: 'condition' | 'automation'): void {
    event.preventDefault();
    event.stopPropagation();

    if (this.selectionMode || this.interactionsDisabled || this.isDraggingField) {
      return;
    }

    if (action === 'condition') {
      this.openConditionalLogic.emit(field);
      return;
    }

    this.openAutomationRules.emit(field);
  }

  onQuickActionMouseDown(event: Event): void {
    event.stopPropagation();
  }

  hasConditionalLogic(field: FormField): boolean {
    return this.fieldsWithConditionalLogic.includes(field.id);
  }

  hasAutomationRules(field: FormField): boolean {
    return this.fieldsWithAutomationRules.includes(field.id);
  }

  onFieldDragStarted(): void {
    this.isDraggingField = true;
  }

  onFieldDragEnded(): void {
    setTimeout(() => {
      this.isDraggingField = false;
    });
  }

  trackByFieldId(_index: number, field: FormField): string {
    return field.id;
  }

  isFieldDeletable(field: FormField): boolean {
    return isFormFieldBulkDeletable(field);
  }

  isFieldSelected(field: FormField): boolean {
    return this.selectedFieldIds.includes(field.id);
  }

  /** UI-only hide — field stays in schema, DOM, and CDK data. */
  isFieldHidden(field: FormField): boolean {
    return false;
    // return field.isShow === false;
  }
}
