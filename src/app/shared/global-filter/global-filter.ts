import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, Output, SimpleChanges } from '@angular/core';

export type GlobalFilterValue = Record<string, unknown>;

export interface GlobalFilterField {
  key: string;
  label: string;
  type?: string;
  placeholder?: string;
  options?: Array<{ id: number | string; name: string }>;
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
  @Input() fields: GlobalFilterField[] = [];
  @Output() search = new EventEmitter<GlobalFilterValue>();
  @Output() clear = new EventEmitter<void>();

  filters: GlobalFilterValue = {};
  openDropdownKey: string | null = null;
  optionSearch: Record<string, string> = {};

  constructor(
    private elementRef: ElementRef,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['fields']) {
      this.syncFiltersWithFields();
    }
  }

  get hasFilters(): boolean {
    return Object.values(this.filters).some(value => !!value);
  }

  get activeFields(): GlobalFilterField[] {
    return this.fields.filter(field => !!this.filters[field.key]);
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
    const option = field.options?.find(item => String(item.id) === String(selectedValue));

    return option?.name || '-';
  }

  getSelectDisplayLabel(field: GlobalFilterField): string {
    const selectedLabel = this.getSelectedOptionLabel(field);

    if (selectedLabel !== '-') {
      return selectedLabel;
    }

    return field.placeholder || `Select ${field.label}`;
  }

  toggleDropdown(field: GlobalFilterField): void {
    this.openDropdownKey = this.openDropdownKey === field.key ? null : field.key;
    this.cdr.markForCheck();
  }

  isDropdownOpen(field: GlobalFilterField): boolean {
    return this.openDropdownKey === field.key;
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

    return options.filter(option => option.name.toLowerCase().includes(query));
  }

  selectOption(field: GlobalFilterField, option?: { id: number | string; name: string }): void {
    if (option) {
      this.filters[field.key] = option.id;
    } else {
      delete this.filters[field.key];
    }

    this.openDropdownKey = null;
    this.cdr.markForCheck();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as Node;

    if (!this.elementRef.nativeElement.contains(target)) {
      if (this.openDropdownKey) {
        this.openDropdownKey = null;
        this.cdr.markForCheck();
      }
    }
  }


  onClear(): void {
    this.filters = {};
    this.optionSearch = {};
    this.openDropdownKey = null;
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

    if (this.openDropdownKey && !allowedKeys.has(this.openDropdownKey)) {
      this.openDropdownKey = null;
    }

    this.cdr.markForCheck();
  }
}
