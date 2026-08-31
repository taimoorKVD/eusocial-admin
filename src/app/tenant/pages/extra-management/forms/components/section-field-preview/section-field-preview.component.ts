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
import {
  getFieldCharacterLimit,
  truncateToCharacterLimit,
} from '../../../../../../shared/dynamic-form/character-limit.utils';
import {
  allowsDecimalPoint,
  getNumberFieldStep,
  sanitizeNumberFieldInput,
} from '../../../../../../shared/dynamic-form/number-field.utils';
import {
  earlierIsoDate,
  getRangePlaceholderFrom,
  getRangePlaceholderTo,
  getRangeSideLabel,
  laterIsoDate,
  normalizeRangeType,
  normalizeRangeValue,
  normalizeTimeTo24h,
  parseRangeNumber,
  resolveRangeStep,
  sanitizeRangeNumberInput,
} from '../../../../../../shared/dynamic-form/range-field.utils';
import {
  composeTimeFrom12h,
  getTimeHour12,
  getTimeMeridiem,
  getTimeMinute,
  normalizeTimeFieldValue,
  TIME_HOUR_OPTIONS_12,
  TIME_MINUTE_OPTIONS,
  TimeMeridiem,
} from '../../../../../../shared/dynamic-form/time-field.utils';
import { FlatpickrDirective } from '../../../../../../shared/directives/flatpickr/flatpickr.directive';

/**
 * Editable FormFieldConfig control — matches section input styling.
 * Select fields reuse the same custom dropdown pattern as Add Section / Item.
 */
@Component({
  selector: 'app-section-field-preview',
  standalone: true,
  imports: [CommonModule, FlatpickrDirective],
  templateUrl: './section-field-preview.component.html',
  styleUrl: './section-field-preview.component.scss',
})
export class SectionFieldPreviewComponent {
  private static readonly CLOSE_DROPDOWN_EVENT = 'section-field-dropdown-close';

  @Input({ required: true }) field!: FormFieldConfig;
  @Input() forceRequired: boolean | null = null;
  @Input() forceDisabled = false;
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

  get isFieldRequired(): boolean {
    return this.forceRequired ?? !!this.field.required;
  }

  get isInteractionDisabled(): boolean {
    return this.forceDisabled || !!this.field.readonly;
  }

  /** Dependent State/City with no loaded options stay disabled until parent is selected. */
  get isSelectDisabled(): boolean {
    return this.isInteractionDisabled || isDependentLocationSelectLocked(this.field);
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
    if (this.isInteractionDisabled) {
      return;
    }

    this.valueChange.emit((event.target as HTMLInputElement | HTMLTextAreaElement).value);
  }

  onTextInput(event: Event): void {
    if (this.isInteractionDisabled) {
      return;
    }

    const input = event.target as HTMLInputElement | HTMLTextAreaElement;
    const limit = this.characterLimit;
    const nextValue =
      limit != null
        ? truncateToCharacterLimit(input.value, limit)
        : input.value;

    if (input.value !== nextValue) {
      input.value = nextValue;
    }

    this.valueChange.emit(nextValue);
  }

  get characterLimit(): number | null {
    return getFieldCharacterLimit(this.field);
  }

  get numberStep(): string {
    return getNumberFieldStep(this.field);
  }

  onNumberInput(event: Event): void {
    if (this.isInteractionDisabled) {
      return;
    }

    const input = event.target as HTMLInputElement;
    const allowDecimal = allowsDecimalPoint(this.field);
    const sanitized = sanitizeNumberFieldInput(input.value, allowDecimal);

    if (input.value !== sanitized) {
      input.value = sanitized;
    }

    this.valueChange.emit(sanitized);
  }

  onRatingChange(value: number): void {
    this.valueChange.emit(String(value));
  }

  onRangeFromChange(event: Event): void {
    this.onRangeSideInput(event, 'from');
  }

  onRangeToChange(event: Event): void {
    this.onRangeSideInput(event, 'to');
  }

  onRangeDateChange(dateStr: string | null, side: 'from' | 'to'): void {
    if (this.isInteractionDisabled) {
      return;
    }

    const current = normalizeRangeValue(this.field.value);
    this.valueChange.emit(
      JSON.stringify({
        ...current,
        [side]: dateStr || null,
      }),
    );
  }

  onRangeSideInput(event: Event, side: 'from' | 'to'): void {
    if (this.isInteractionDisabled) {
      return;
    }

    const input = event.target as HTMLInputElement;
    const current = normalizeRangeValue(this.field.value);
    const rangeType = this.rangeType;
    let nextSide: string | number | null = input.value;

    if (rangeType === 'number') {
      const sanitized = sanitizeRangeNumberInput(
        input.value,
        allowsDecimalPoint(this.field),
      );
      if (input.value !== sanitized) {
        input.value = sanitized;
      }
      nextSide =
        sanitized === '' || sanitized === '-' || sanitized === '.' || sanitized === '-.'
          ? null
          : (parseRangeNumber(sanitized) ?? sanitized);
    } else if (rangeType === 'time') {
      nextSide = normalizeTimeTo24h(input.value);
    } else {
      nextSide = input.value || null;
    }

    this.valueChange.emit(
      JSON.stringify({
        ...current,
        [side]: nextSide,
      }),
    );
  }

  get ratingMaxValue(): number {
    return this.field.maxRating || 5;
  }

  get ratingValue(): number {
    return Number(this.field.value || 0);
  }

  get rangeFromValue(): string {
    const value = normalizeRangeValue(this.field.value);
    if (value.from == null || value.from === '') {
      return '';
    }
    if (this.rangeType === 'time') {
      return normalizeTimeTo24h(value.from) ?? '';
    }
    return String(value.from);
  }

  get rangeToValue(): string {
    const value = normalizeRangeValue(this.field.value);
    if (value.to == null || value.to === '') {
      return '';
    }
    if (this.rangeType === 'time') {
      return normalizeTimeTo24h(value.to) ?? '';
    }
    return String(value.to);
  }

  get rangeType(): 'number' | 'date' | 'time' {
    return normalizeRangeType(this.field.rangeType);
  }

  get rangePlaceholderFrom(): string {
    return getRangePlaceholderFrom(this.field);
  }

  get rangePlaceholderTo(): string {
    return getRangePlaceholderTo(this.field);
  }

  get rangeLabelFrom(): string {
    return getRangeSideLabel(this.field, 'from');
  }

  get rangeLabelTo(): string {
    return getRangeSideLabel(this.field, 'to');
  }

  get rangeFromMinDate(): string | null {
    return this.field.rangeMinDate || null;
  }

  get rangeFromMaxDate(): string | null {
    return earlierIsoDate(this.field.rangeMaxDate, this.rangeToValue) || null;
  }

  get rangeToMinDate(): string | null {
    return laterIsoDate(this.field.rangeMinDate, this.rangeFromValue) || null;
  }

  get rangeToMaxDate(): string | null {
    return this.field.rangeMaxDate || null;
  }

  get rangeStep(): number {
    return resolveRangeStep(this.field);
  }

  get timeHourOptions(): number[] {
    return TIME_HOUR_OPTIONS_12;
  }

  get timeMinuteOptions(): number[] {
    return TIME_MINUTE_OPTIONS;
  }

  get timeHour12(): number | null {
    return getTimeHour12(this.field.value);
  }

  get timeMinute(): number | null {
    return getTimeMinute(this.field.value);
  }

  get timeMeridiem(): TimeMeridiem | null {
    return getTimeMeridiem(this.field.value);
  }

  get timeInputValue(): string {
    return normalizeTimeFieldValue(this.field.value) ?? '';
  }

  onTime24Input(event: Event): void {
    if (this.isInteractionDisabled) {
      return;
    }
    const input = event.target as HTMLInputElement;
    this.valueChange.emit(normalizeTimeFieldValue(input.value) ?? '');
  }

  onTime12PartChange(part: 'hour' | 'minute' | 'meridiem', raw: string): void {
    if (this.isInteractionDisabled) {
      return;
    }

    let hour = getTimeHour12(this.field.value) ?? 12;
    let minute = getTimeMinute(this.field.value) ?? 0;
    let meridiem = getTimeMeridiem(this.field.value) ?? 'AM';

    if (part === 'hour') {
      hour = Number(raw);
    } else if (part === 'minute') {
      minute = Number(raw);
    } else {
      meridiem = String(raw).toUpperCase() === 'PM' ? 'PM' : 'AM';
    }

    this.valueChange.emit(composeTimeFrom12h(hour, minute, meridiem) ?? '');
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
