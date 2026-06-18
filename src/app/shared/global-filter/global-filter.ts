import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { DropdownOverlayService } from '../directives/dropdown-panel/dropdown-overlay.service';
import {
  buildClearedFilters,
  filterOptionsByQuery,
  getOptionLabel,
  getOptionValue,
  getSelectDisplayLabel,
  getSelectedOptionLabel,
  hasActiveFilterValue,
  isCheckboxOptionSelected,
  sanitizeNumericInput,
  syncFiltersWithFields,
  toggleCheckboxFilterValue,
} from './global-filter.helpers';
import {
  GlobalFilterField,
  GlobalFilterOption,
  GlobalFilterValue,
} from './global-filter.types';

export type { GlobalFilterField, GlobalFilterOption, GlobalFilterValue } from './global-filter.types';

@Component({
  selector: 'app-global-filter',
  standalone: false,
  templateUrl: './global-filter.html',
  styleUrl: './global-filter.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GlobalFilterComponent {
  private readonly overlayService = inject(DropdownOverlayService);

  readonly filterDropdownGroup = 'global-filter';

  readonly fields = input<GlobalFilterField[]>([]);
  readonly search = output<GlobalFilterValue>();
  readonly clear = output<void>();

  readonly filters = signal<GlobalFilterValue>({});
  readonly optionSearch = signal<Record<string, string>>({});

  readonly hasFilters = computed(() => {
    const filters = this.filters();
    return this.fields().some((field) => hasActiveFilterValue(filters[field.key]));
  });

  readonly activeFields = computed(() => {
    const filters = this.filters();
    return this.fields().filter((field) => hasActiveFilterValue(filters[field.key]));
  });

  constructor() {
    effect(() => {
      const fields = this.fields();
      this.filters.update((current) => syncFiltersWithFields(fields, current));
      this.optionSearch.update((current) => {
        const allowedKeys = new Set(fields.map((field) => field.key));
        return Object.fromEntries(
          Object.entries(current).filter(([key]) => allowedKeys.has(key)),
        );
      });
      this.overlayService.close();
    });
  }

  setFilterValue(key: string, value: unknown): void {
    this.filters.update((current) => ({ ...current, [key]: value }));
  }

  onInputChange(field: GlobalFilterField, event: Event): void {
    if (field.type !== 'number') {
      return;
    }

    const input = event.target as HTMLInputElement;
    const sanitized = sanitizeNumericInput(input.value);

    if (input.value !== sanitized) {
      input.value = sanitized;
    }

    this.setFilterValue(field.key, sanitized);
  }

  onSearch(): void {
    this.search.emit(this.filters());
  }

  getSelectedOptionLabel(field: GlobalFilterField): string {
    return getSelectedOptionLabel(field, this.filters());
  }

  getSelectDisplayLabel(field: GlobalFilterField): string {
    return getSelectDisplayLabel(field, this.filters());
  }

  onOptionSearch(field: GlobalFilterField, event: Event): void {
    const input = event.target as HTMLInputElement;
    this.optionSearch.update((current) => ({ ...current, [field.key]: input.value }));
  }

  getFilteredOptions(field: GlobalFilterField): GlobalFilterOption[] {
    const options = field.options ?? [];
    const query = this.optionSearch()[field.key] ?? '';

    return filterOptionsByQuery(options, query);
  }

  selectOption(field: GlobalFilterField, option?: GlobalFilterOption): void {
    if (option) {
      this.setFilterValue(field.key, option.id);
    } else {
      this.filters.update((current) => {
        const next = { ...current };
        delete next[field.key];
        return next;
      });
    }

    this.overlayService.close();
  }

  onClear(): void {
    this.filters.set(buildClearedFilters(this.fields()));
    this.optionSearch.set({});
    this.overlayService.close();
    this.clear.emit();
  }

  getOptionLabel(option: GlobalFilterOption | string | number): string {
    return getOptionLabel(option);
  }

  getOptionValue(option: GlobalFilterOption | string | number): unknown {
    return getOptionValue(option);
  }

  onCheckboxChange(fieldKey: string, option: GlobalFilterOption | string | number, event: Event): void {
    const input = event.target as HTMLInputElement;
    this.filters.update((current) =>
      toggleCheckboxFilterValue(current, fieldKey, option, input.checked),
    );
  }

  isChecked(fieldKey: string, option: GlobalFilterOption | string | number): boolean {
    return isCheckboxOptionSelected(this.filters(), fieldKey, option);
  }
}
