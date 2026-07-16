import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  Output,
  computed,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormFieldConfig } from '../../models/dynamic-form.models';

/**
 * Editable FormFieldConfig control — matches section input styling.
 * Select fields reuse the same custom dropdown pattern as Add Section / Item.
 */
@Component({
  selector: 'app-section-field-preview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './section-field-preview.component.html',
  styleUrl: './section-field-preview.component.scss',
})
export class SectionFieldPreviewComponent {
  @Input({ required: true }) field!: FormFieldConfig;
  @Output() valueChange = new EventEmitter<string>();

  readonly selectDropdownOpen = signal(false);
  readonly selectSearchQuery = signal('');
  readonly dropdownPosition = signal<{ top: number; left: number; width: number } | null>(null);

  readonly filteredSelectOptions = computed(() => {
    const options = this.field?.options ?? [];
    const q = this.selectSearchQuery().trim().toLowerCase();
    return q ? options.filter((opt) => opt.toLowerCase().includes(q)) : options;
  });

  get selectPlaceholder(): string {
    return this.field.placeholder || `Select ${this.field.label || ''}`.trim() || 'Select';
  }

  get selectDisplayLabel(): string {
    return this.field.value || this.selectPlaceholder;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!(event.target as HTMLElement).closest('.field-select-dropdown')) {
      this.closeSelectDropdown();
    }
  }

  @HostListener('window:scroll')
  @HostListener('window:resize')
  onViewportChange(): void {
    if (this.selectDropdownOpen()) {
      this.closeSelectDropdown();
    }
  }

  toggleSelectDropdown(event: MouseEvent): void {
    if (this.field.readonly) return;
    event.stopPropagation();

    if (this.selectDropdownOpen()) {
      this.closeSelectDropdown();
      return;
    }

    const host = (event.target as HTMLElement).closest('.field-select-dropdown');
    if (host) {
      const rect = host.getBoundingClientRect();
      this.dropdownPosition.set({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }

    this.selectSearchQuery.set('');
    this.selectDropdownOpen.set(true);
  }

  selectOption(value: string): void {
    this.valueChange.emit(value);
    this.closeSelectDropdown();
  }

  clearSelection(event: MouseEvent): void {
    event.stopPropagation();
    this.valueChange.emit('');
  }

  onSelectSearch(event: Event): void {
    this.selectSearchQuery.set((event.target as HTMLInputElement).value);
  }

  onInput(event: Event): void {
    this.valueChange.emit((event.target as HTMLInputElement | HTMLTextAreaElement).value);
  }

  onCheckboxToggle(checked: boolean): void {
    this.valueChange.emit(checked ? 'true' : 'false');
  }

  onOptionCheckboxToggle(option: string, checked: boolean): void {
    const selected = this.selectedOptions();
    const next = checked
      ? [...selected, option]
      : selected.filter((item) => item !== option);
    this.valueChange.emit(next.join(','));
  }

  onRadioSelect(option: string): void {
    this.valueChange.emit(option);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    this.valueChange.emit(file?.name ?? '');
  }

  isOptionChecked(option: string): boolean {
    return this.selectedOptions().includes(option);
  }

  private closeSelectDropdown(): void {
    this.selectDropdownOpen.set(false);
    this.selectSearchQuery.set('');
    this.dropdownPosition.set(null);
  }

  private selectedOptions(): string[] {
    const raw = this.field.value ?? '';
    if (!raw.trim()) return [];
    return raw.split(',').map((part) => part.trim()).filter(Boolean);
  }
}
