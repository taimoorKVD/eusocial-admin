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
import { isFormFieldBulkDeletable } from '../../utils/form-field-operations';

@Component({
  selector: 'app-form-canvas',
  standalone: true,
  imports: [CommonModule, DragDropModule, FormFieldPreviewComponent],
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

  @Output() dropped = new EventEmitter<CdkDragDrop<FormField[]>>();
  @Output() selectField = new EventEmitter<FormField>();
  @Output() toggleFieldSelection = new EventEmitter<FormField>();

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
