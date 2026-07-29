import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  Output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormFieldConfig, FormSelectOption } from '../../models/dynamic-form.models';
import {
  getSelectOptionLabel,
  getSelectOptionValue,
  isDependentLocationSelectLocked,
} from '../../utils/row-location-dependencies.utils';

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
  private static readonly CLOSE_DROPDOWN_EVENT = 'section-field-dropdown-close';

  @Input({ required: true }) field!: FormFieldConfig;
  @Output() valueChange = new EventEmitter<string>();

  readonly selectDropdownOpen = signal(false);
  readonly selectSearchQuery = signal('');
  readonly dropdownPosition = signal<{ top: number; left: number; width: number } | null>(null);

  get filteredSelectOptions(): FormSelectOption[] {
    const options = this.field?.options ?? [];
    const q = this.selectSearchQuery().trim().toLowerCase();
    return q
      ? options.filter((opt) => this.optionLabel(opt).toLowerCase().includes(q))
      : options;
  }

  get selectPlaceholder(): string {
    if (this.isSelectDisabled && !(this.field.options?.length)) {
      return 'Select parent first';
    }
    return this.field.placeholder || `Select ${this.field.label || ''}`.trim() || 'Select';
  }

  get selectDisplayLabel(): string {
    if (!this.field.value) {
      return this.selectPlaceholder;
    }

    const match = (this.field.options ?? []).find(
      (opt) => this.optionValue(opt) === String(this.field.value),
    );
    return match ? this.optionLabel(match) : String(this.field.value);
  }

  /** Dependent State/City with no loaded options stay disabled until parent is selected. */
  get isSelectDisabled(): boolean {
    return !!this.field.readonly || isDependentLocationSelectLocked(this.field);
  }

  optionLabel(option: FormSelectOption): string {
    return getSelectOptionLabel(option);
  }

  optionValue(option: FormSelectOption): string {
    return getSelectOptionValue(option);
  }

  isOptionSelected(option: FormSelectOption): boolean {
    return String(this.field.value ?? '') === this.optionValue(option);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!(event.target as HTMLElement).closest('.field-select-dropdown')) {
      this.closeSelectDropdown();
    }
  }

  @HostListener('document:section-field-dropdown-close')
  onCloseDropdownEvent(): void {
    this.closeSelectDropdown();
  }

  @HostListener('window:scroll')
  @HostListener('window:resize')
  onViewportChange(): void {
    if (this.selectDropdownOpen()) {
      this.closeSelectDropdown();
    }
  }

  toggleSelectDropdown(event: MouseEvent): void {
    if (this.isSelectDisabled) return;
    event.stopPropagation();

    if (this.selectDropdownOpen()) {
      this.closeSelectDropdown();
      return;
    }

    document.dispatchEvent(
      new CustomEvent(SectionFieldPreviewComponent.CLOSE_DROPDOWN_EVENT),
    );

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

  selectOption(option: FormSelectOption): void {
    this.valueChange.emit(this.optionValue(option));
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

  onParameterValueChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.valueChange.emit(input.value);
  }

  onParameterCategoryChange(category: string): void {
    this.field.parameterCategory = category;
    this.field.parameterUnit = '';
  }

  onParameterUnitChange(unit: string): void {
    this.field.parameterUnit = unit;
  }

  onRatingChange(value: number): void {
    this.valueChange.emit(String(value));
  }

  onRangeFromChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const current = this.field.value?.toString().split('-') || ['', ''];
    this.valueChange.emit(`${input.value}-${current[1] || ''}`);
  }

  onRangeToChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const current = this.field.value?.toString().split('-') || ['', ''];
    this.valueChange.emit(`${current[0] || ''}-${input.value}`);
  }

  readonly parameterCategories = [
    { label: 'Currency', value: 'currency' },
    { label: 'Length / Distance', value: 'length' },
    { label: 'Weight / Mass', value: 'weight' },
    { label: 'Volume / Capacity', value: 'volume' },
  ];

  get parameterUnits(): { label: string; value: string }[] {
    switch (this.field.parameterCategory) {
      case 'currency':
        return [
          { label: 'USD', value: 'USD' },
          { label: 'EUR', value: 'EUR' },
          { label: 'GBP', value: 'GBP' },
          { label: 'PKR', value: 'PKR' },
          { label: 'INR', value: 'INR' },
          { label: 'JPY', value: 'JPY' },
          { label: 'CNY', value: 'CNY' },
          { label: 'CAD', value: 'CAD' },
          { label: 'AUD', value: 'AUD' },
        ];
      case 'length':
        return [
          { label: 'Meter (m)', value: 'm' },
          { label: 'Centimeter (cm)', value: 'cm' },
          { label: 'Millimeter (mm)', value: 'mm' },
          { label: 'Kilometer (km)', value: 'km' },
          { label: 'Inch (in)', value: 'in' },
          { label: 'Foot (ft)', value: 'ft' },
          { label: 'Yard (yd)', value: 'yd' },
          { label: 'Mile (mi)', value: 'mi' },
        ];
      case 'weight':
        return [
          { label: 'Kilogram (kg)', value: 'kg' },
          { label: 'Gram (g)', value: 'g' },
          { label: 'Milligram (mg)', value: 'mg' },
          { label: 'Pound (lb)', value: 'lb' },
          { label: 'Ounce (oz)', value: 'oz' },
          { label: 'Ton', value: 'ton' },
        ];
      case 'volume':
        return [
          { label: 'Liter (L)', value: 'L' },
          { label: 'Milliliter (mL)', value: 'mL' },
          { label: 'Gallon (gal)', value: 'gal' },
          { label: 'Quart (qt)', value: 'qt' },
          { label: 'Pint (pt)', value: 'pt' },
          { label: 'Cup', value: 'cup' },
          { label: 'Cubic Meter (m³)', value: 'm3' },
        ];
      default:
        return [];
    }
  }

  get ratingMaxValue(): number {
    return this.field.maxRating || 5;
  }

  get ratingValue(): number {
    return Number(this.field.value || 0);
  }

  get rangeFromValue(): string {
    return this.field.value?.toString().split('-')[0] || '';
  }

  get rangeToValue(): string {
    return this.field.value?.toString().split('-')[1] || '';
  }

  get displayTimestamp(): string {
    if (this.field.value) return this.field.value;
    const now = new Date();
    return now.toLocaleString();
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
