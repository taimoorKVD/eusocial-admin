import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { DropdownOverlayService } from '../directives/dropdown-panel/dropdown-overlay.service';

export type GlobalFilterValue = Record<string, unknown>;

export interface GlobalFilterField {
  key: string;
  label: string;
  type?: string;
  placeholder?: string;
  options?: any[];
  // options?: Array<{ id: number | string; name: string }>;
  loading?: boolean;
}

@Component({
  selector: 'app-global-filter',
  standalone: false,
  templateUrl: './global-filter.html',
  styleUrl: './global-filter.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GlobalFilterComponent implements OnChanges {
  readonly filterDropdownGroup = 'global-filter';

  @Input() fields: GlobalFilterField[] = [];
  @Output() search = new EventEmitter<GlobalFilterValue>();
  @Output() clear = new EventEmitter<void>();

  filters: GlobalFilterValue = {};
  optionSearch: Record<string, string> = {};

  constructor(
    private overlayService: DropdownOverlayService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    console.log('GlobalFilterComponent changes:', changes);
    if (changes['fields']) {
      this.syncFiltersWithFields();
    }
  }

  get hasFilters(): boolean {
    // return Object.values(this.filters).some((value) => !!value);
     return this.fields.some((field) => {
    const value = this.filters[field.key];

    if (Array.isArray(value)) {
      return value.length > 0;
    }

    return !!value;
  });
  }

  get activeFields(): GlobalFilterField[] {
    // return this.fields.filter((field) => !!this.filters[field.key]);
     return this.fields.filter((field) => {
        const value = this.filters[field.key];

        if (Array.isArray(value)) {
          return value.length > 0;
        }

        return !!value;
      });
  }

  trackByFieldKey(_: number, field: GlobalFilterField): string {
    return field.key;
  }

  onInputChange(field: GlobalFilterField, event: Event): void {
    if (field.type !== 'number') {
      return;
    }

    const input = event.target as HTMLInputElement;
    const sanitized = input.value.replace(/[^0-9]/g, '');

    if (input.value !== sanitized) {
      input.value = sanitized;
    }

    this.filters[field.key] = sanitized;
  }

  onSearch(): void {
    this.search.emit(this.filters);
  }

  getSelectedOptionLabel(field: GlobalFilterField): string {
    const selectedValue = this.filters[field.key];
    const option = field.options?.find((item) => String(item.id) === String(selectedValue));

    return option?.name || '-';
  }

  getSelectDisplayLabel(field: GlobalFilterField): string {
    const selectedLabel = this.getSelectedOptionLabel(field);

    if (selectedLabel !== '-') {
      return selectedLabel;
    }

    return field.placeholder || `Select ${field.label}`;
  }

  onOptionSearch(field: GlobalFilterField, event: Event): void {
    const input = event.target as HTMLInputElement;
    this.optionSearch[field.key] = input.value;
    this.cdr.markForCheck();
  }

  getFilteredOptions(field: GlobalFilterField): Array<{ id: number | string; name: string }> {
    const options = field.options || [];
    const query = (this.optionSearch[field.key] || '').trim().toLowerCase();

    if (!query) {
      return options;
    }

    return options.filter((option) => option.name.toLowerCase().includes(query));
  }

  selectOption(field: GlobalFilterField, option?: { id: number | string; name: string; value?: any }): void {
    if (option) {
      this.filters[field.key] = option.id;
    } else {
      delete this.filters[field.key];
    }

    this.overlayService.close();
    this.cdr.markForCheck();
  }

  onClear(): void {
    this.filters = {};
     this.fields.forEach((field) => {
    if (field.type === 'radio') {
      const allOption = field.options?.find(
        (opt) => this.getOptionValue(opt) === ''
      );

      this.filters[field.key] = allOption
        ? ''
        : undefined;
    }
  });
    this.optionSearch = {};
    this.overlayService.close();
    this.clear.emit();
    this.cdr.markForCheck();
  }

  private syncFiltersWithFields(): void {
    const allowedKeys = new Set(this.fields.map((field) => field.key));

    this.filters = Object.fromEntries(
      Object.entries(this.filters).filter(([key]) => allowedKeys.has(key)),
    );

    this.optionSearch = Object.fromEntries(
      Object.entries(this.optionSearch).filter(([key]) => allowedKeys.has(key)),
    );

    this.fields.forEach((field) => {
    if (
      field.type === 'radio' &&
      this.filters[field.key] === undefined &&
      field.options?.some((option) => this.getOptionValue(option) === '')
    ) {
      this.filters[field.key] = '';
    }
  });

    this.overlayService.close();
    this.cdr.markForCheck();
  }

  getOptionLabel(option: any): string {
    return typeof option === 'object' ? option.label ?? option.name ?? option : option;
  }

  getOptionValue(option: any): any {
    return typeof option === 'object' ? option.value ?? option.id ?? option : option;
  }

  onCheckboxChange(fieldKey: string, option: any, event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = this.getOptionValue(option);
    const existing = (this.filters[fieldKey] as any[]) || [];
    if (input.checked) {
      this.filters[fieldKey] = [...existing, value];
    } else {
      this.filters[fieldKey] = existing.filter((x) => x !== value);
    }
  }

  isChecked(fieldKey: string, option: any): boolean {
    const value = this.getOptionValue(option);
    const selected = Array.isArray(this.filters[fieldKey])
    ? (this.filters[fieldKey] as any[])
    : [];

    return selected.includes(value);

  }
}
