import { Component, Input, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDropList, DragDropModule } from '@angular/cdk/drag-drop';
import { FormField } from '../../models/form-field.model';
import { FIELD_TEMPLATES } from '../../data/field-templates';

@Component({
  selector: 'app-builder',
  standalone: true,
  imports: [CommonModule, DragDropModule],
  templateUrl: './builder.component.html',
  styleUrl: './builder.component.scss',
})
export class BuilderComponent {
  @Input() connectedDropLists: Array<CdkDropList<FormField[]> | string> = [];
  @Input() dropListId = 'sidebarList';
  /** Disables palette drag when form interactions are locked (e.g. bulk delete). */
  @Input() disabled = false;

  @ViewChild('paletteList', { static: true })
  paletteListRef!: CdkDropList<FormField[]>;

  /** Immutable palette — never modified by drag & drop. */
  readonly fieldTemplates = FIELD_TEMPLATES;

  trackByTemplate(_index: number, item: Omit<FormField, 'id'>): string {
    return item.type;
  }
}
