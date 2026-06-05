import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FormField } from '../../models/form-field.model';

@Component({
  selector: 'app-form-field-preview',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './form-field-preview.component.html',
})
export class FormFieldPreviewComponent {
  @Input({ required: true }) field!: FormField;
}
