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
import { take } from 'rxjs/operators';
import { LocationCacheService } from '../../services/location-cache.service';
import { DropdownOverlayService } from '../directives/dropdown-panel/dropdown-overlay.service';
import {
  LOCATION_FILTER_OPTION_PAGE_SIZE,
  buildClearedFilters,
  filterOptionsByQuery,
  getFilterLocationFields,
  getOptionLabel,
  getOptionValue,
  getSelectDisplayLabel,
  getSelectedOptionLabel,
  getVisibleFilterOptions,
  hasActiveFilterValue,
  hasMoreFilterOptions,
  isCheckboxOptionSelected,
  isEmptyFilterValue,
  isPaginatedLocationFilterField,
  mapLocationRecordsToFilterOptions,
  resolveFilterLocationEndpoint,
  sanitizeNumericInput,
  syncFiltersWithFields,
  toggleCheckboxFilterValue,
} from './global-filter.helpers';
import {
  FilterLocationFields,
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
  private readonly locationCache = inject(LocationCacheService);

  readonly filterDropdownGroup = 'global-filter';

  readonly fields = input<GlobalFilterField[]>([]);
  readonly search = output<GlobalFilterValue>();
  readonly clear = output<void>();

  readonly filters = signal<GlobalFilterValue>({});
  readonly optionSearch = signal<Record<string, string>>({});
  /** Visible option count per State/City field key (batches of 100). */
  readonly optionVisibleLimit = signal<Record<string, number>>({});
  /**
   * Dependent location option overrides. Keys present here replace field.options
   * (e.g. empty State/City until a parent is selected, or filtered child lists).
   */
  readonly locationOptionOverrides = signal<Record<string, GlobalFilterOption[]>>({});

  readonly locationFields = computed<FilterLocationFields>(() =>
    getFilterLocationFields(this.fields()),
  );

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
      this.optionVisibleLimit.update((current) => {
        const allowedKeys = new Set(
          fields.filter(isPaginatedLocationFilterField).map((field) => field.key),
        );
        return Object.fromEntries(
          Object.entries(current).filter(([key]) => allowedKeys.has(key)),
        );
      });
      this.initializeLocationDependencies(fields);
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

  getEffectiveOptions(field: GlobalFilterField): GlobalFilterOption[] {
    const overrides = this.locationOptionOverrides();

    if (Object.prototype.hasOwnProperty.call(overrides, field.key)) {
      return overrides[field.key];
    }

    return field.options ?? [];
  }

  getSelectedOptionLabel(field: GlobalFilterField): string {
    return getSelectedOptionLabel(
      field,
      this.filters(),
      this.getEffectiveOptions(field),
    );
  }

  getSelectDisplayLabel(field: GlobalFilterField): string {
    return getSelectDisplayLabel(
      field,
      this.filters(),
      this.getEffectiveOptions(field),
    );
  }

  onOptionSearch(field: GlobalFilterField, event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value;

    this.optionSearch.update((current) => ({ ...current, [field.key]: value }));

    if (!value.trim() && isPaginatedLocationFilterField(field)) {
      this.resetOptionVisibleLimit(field.key);
    }
  }

  getFilteredOptions(field: GlobalFilterField): GlobalFilterOption[] {
    const options = this.getEffectiveOptions(field);
    const query = this.optionSearch()[field.key] ?? '';

    return filterOptionsByQuery(options, query);
  }

  getVisibleOptions(field: GlobalFilterField): GlobalFilterOption[] {
    const query = this.optionSearch()[field.key] ?? '';
    const limit =
      this.optionVisibleLimit()[field.key] ?? LOCATION_FILTER_OPTION_PAGE_SIZE;

    return getVisibleFilterOptions(
      this.getEffectiveOptions(field),
      field,
      query,
      limit,
    );
  }

  hasMoreOptions(field: GlobalFilterField): boolean {
    const query = this.optionSearch()[field.key] ?? '';
    const limit =
      this.optionVisibleLimit()[field.key] ?? LOCATION_FILTER_OPTION_PAGE_SIZE;

    return hasMoreFilterOptions(
      this.getEffectiveOptions(field),
      field,
      query,
      limit,
    );
  }

  onSelectDropdownOpen(field: GlobalFilterField, isOpening: boolean): void {
    if (isOpening && isPaginatedLocationFilterField(field)) {
      this.resetOptionVisibleLimit(field.key);
    }
  }

  loadMoreOptions(field: GlobalFilterField, event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    if (!isPaginatedLocationFilterField(field)) {
      return;
    }

    this.optionVisibleLimit.update((current) => {
      const currentLimit =
        current[field.key] ?? LOCATION_FILTER_OPTION_PAGE_SIZE;

      return {
        ...current,
        [field.key]: currentLimit + LOCATION_FILTER_OPTION_PAGE_SIZE,
      };
    });
  }

  selectOption(field: GlobalFilterField, option?: GlobalFilterOption): void {
    const kind = resolveFilterLocationEndpoint(field.endpoint);
    const { country, state, city } = this.locationFields();

    this.filters.update((current) => {
      const next = { ...current };

      if (option) {
        next[field.key] = option.id;
      } else {
        delete next[field.key];
      }

      if (kind === 'countries') {
        if (state) {
          delete next[state.key];
        }
        if (city) {
          delete next[city.key];
        }
      } else if (kind === 'states' && city) {
        delete next[city.key];
      }

      return next;
    });

    if (kind === 'countries') {
      this.clearChildOptionSearch(state, city);
      this.handleCountrySelection(option?.id, state, city);
    } else if (kind === 'states') {
      this.clearChildOptionSearch(null, city);
      this.handleStateSelection(option?.id, city);
    }

    this.overlayService.close();
  }

  onClear(): void {
    this.filters.set(buildClearedFilters(this.fields()));
    this.optionSearch.set({});
    this.optionVisibleLimit.set({});
    this.initializeLocationDependencies(this.fields());
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

  private initializeLocationDependencies(fields: GlobalFilterField[]): void {
    const { country, state, city } = getFilterLocationFields(fields);
    const overrides: Record<string, GlobalFilterOption[]> = {};

    // Scenario 1: Country + State → State empty until country is chosen.
    if (state && country) {
      overrides[state.key] = [];
    }

    // City stays empty until its parent (State or Country) is chosen.
    if (city && (state || country)) {
      overrides[city.key] = [];
    }

    this.locationOptionOverrides.set(overrides);
    this.refreshLocationOptionsFromFilters(country, state, city);
  }

  private refreshLocationOptionsFromFilters(
    country: GlobalFilterField | null,
    state: GlobalFilterField | null,
    city: GlobalFilterField | null,
  ): void {
    const filters = this.filters();

    if (state && country) {
      const countryValue = filters[country.key];
      if (!isEmptyFilterValue(countryValue)) {
        this.loadStateOptions(state, countryValue);
      }
    }

    if (!city) {
      return;
    }

    if (state) {
      const stateValue = filters[state.key];
      if (!isEmptyFilterValue(stateValue)) {
        this.loadCityOptionsForState(city, stateValue);
      }
      return;
    }

    if (country) {
      const countryValue = filters[country.key];
      if (!isEmptyFilterValue(countryValue)) {
        this.loadCityOptionsForCountry(city, countryValue);
      }
    }
  }

  private handleCountrySelection(
    countryValue: unknown,
    state: GlobalFilterField | null,
    city: GlobalFilterField | null,
  ): void {
    if (state) {
      if (isEmptyFilterValue(countryValue)) {
        this.setLocationOverride(state.key, []);
      } else {
        this.loadStateOptions(state, countryValue);
      }

      if (city) {
        this.setLocationOverride(city.key, []);
        this.resetOptionVisibleLimit(city.key);
      }

      this.resetOptionVisibleLimit(state.key);
      return;
    }

    if (city) {
      if (isEmptyFilterValue(countryValue)) {
        this.setLocationOverride(city.key, []);
      } else {
        this.loadCityOptionsForCountry(city, countryValue);
      }

      this.resetOptionVisibleLimit(city.key);
    }
  }

  private handleStateSelection(
    stateValue: unknown,
    city: GlobalFilterField | null,
  ): void {
    if (!city) {
      return;
    }

    if (isEmptyFilterValue(stateValue)) {
      this.setLocationOverride(city.key, []);
    } else {
      this.loadCityOptionsForState(city, stateValue);
    }

    this.resetOptionVisibleLimit(city.key);
  }

  private loadStateOptions(stateField: GlobalFilterField, countryValue: unknown): void {
    this.locationCache
      .getStatesForCountry(countryValue)
      .pipe(take(1))
      .subscribe((records) => {
        this.setLocationOverride(
          stateField.key,
          mapLocationRecordsToFilterOptions(stateField, records),
        );
      });
  }

  private loadCityOptionsForState(cityField: GlobalFilterField, stateValue: unknown): void {
    this.locationCache
      .getCitiesForState(stateValue)
      .pipe(take(1))
      .subscribe((records) => {
        this.setLocationOverride(
          cityField.key,
          mapLocationRecordsToFilterOptions(cityField, records),
        );
      });
  }

  private loadCityOptionsForCountry(
    cityField: GlobalFilterField,
    countryValue: unknown,
  ): void {
    this.locationCache
      .getCitiesForCountry(countryValue)
      .pipe(take(1))
      .subscribe((records) => {
        this.setLocationOverride(
          cityField.key,
          mapLocationRecordsToFilterOptions(cityField, records),
        );
      });
  }

  private setLocationOverride(fieldKey: string, options: GlobalFilterOption[]): void {
    this.locationOptionOverrides.update((current) => ({
      ...current,
      [fieldKey]: options,
    }));
  }

  private clearChildOptionSearch(
    state: GlobalFilterField | null,
    city: GlobalFilterField | null,
  ): void {
    this.optionSearch.update((current) => {
      const next = { ...current };

      if (state) {
        delete next[state.key];
      }
      if (city) {
        delete next[city.key];
      }

      return next;
    });
  }

  private resetOptionVisibleLimit(fieldKey: string): void {
    this.optionVisibleLimit.update((current) => ({
      ...current,
      [fieldKey]: LOCATION_FILTER_OPTION_PAGE_SIZE,
    }));
  }
}
