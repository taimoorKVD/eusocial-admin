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

  @Output() dropped = new EventEmitter<CdkDragDrop<FormField[]>>();
  @Output() selectField = new EventEmitter<FormField>();

  @ViewChild('canvasList', { static: true })
  canvasListRef!: CdkDropList<FormField[]>;

  isDraggingField = false;

  onDrop(event: CdkDragDrop<FormField[]>): void {
    this.dropped.emit(event);
  }

  onFieldClick(field: FormField): void {
    if (this.isDraggingField) {
      return;
    }

    this.selectField.emit(field);
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

  /** UI-only hide — field stays in schema, DOM, and CDK data. */
  isFieldHidden(field: FormField): boolean {
    return field.isShow === false;
  }
}
