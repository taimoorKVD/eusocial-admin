import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  VisualFormFile,
  VisualFormSection,
} from '../../models/dynamic-form.models';

@Component({
  selector: 'app-visual-form-section',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './visual-form-section.component.html',
  styleUrl: './visual-form-section.component.scss',
})
export class VisualFormSectionComponent {
  readonly maxInstructions = 100;
  readonly maxFileSizeKb = 500;
  readonly acceptedTypes = ['.jpg', '.jpeg', '.png'];

  @Input({ required: true }) section!: VisualFormSection;
  @Output() sectionChange = new EventEmitter<VisualFormSection>();
  @Output() removeSection = new EventEmitter<string>();

  onInstructionsChange(value: string): void {
    const instructions = value.slice(0, this.maxInstructions);
    this.emitConfig({ instructions });
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const selected = Array.from(input.files ?? []);
    if (!selected.length) return;

    const valid: VisualFormFile[] = [];
    for (const file of selected) {
      const ext = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`;
      const sizeKb = file.size / 1024;
      if (!this.acceptedTypes.includes(ext)) continue;
      if (sizeKb > this.maxFileSizeKb) continue;
      valid.push({ name: file.name, size: file.size });
    }

    if (valid.length) {
      this.emitConfig({
        files: [...this.section.configuration.files, ...valid],
      });
    }

    input.value = '';
  }

  removeFile(index: number): void {
    const files = this.section.configuration.files.filter((_, i) => i !== index);
    this.emitConfig({ files });
  }

  private emitConfig(partial: Partial<VisualFormSection['configuration']>): void {
    this.sectionChange.emit({
      ...this.section,
      configuration: {
        ...this.section.configuration,
        ...partial,
      },
    });
  }
}
