import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { DynamicField, DynamicFieldOption } from '../../interfaces/dynamic-field';
import { FormStorageService } from '../../tenant/forms/services/form-storage.service';
import { getOptionValue } from '../dynamic-form/dynamic-form.builder';

function isLazyLocationEndpoint(endpoint?: string | null): boolean {
  if (!endpoint) {
    return false;
  }

  const normalized = endpoint
    .trim()
    .toLowerCase()
    .replace(/^\/+/, '')
    .split('?')[0]
    .replace(/\/+$/, '');

  return normalized === 'states' || normalized === 'cities';
}

/** True when a dynamic select has builder-saved option selections. */
export function hasSavedDynamicSelectOptions(field: DynamicField): boolean {
  return (
    field.optionSource?.type === 'dynamic' &&
    Array.isArray(field.options) &&
    field.options.length > 0
  );
}

export function shouldFetchSelectOptionsFromApi(field: DynamicField): boolean {
  if (field.type !== 'select' || !field.optionSource?.endpoint) {
    return false;
  }

  if (isLazyLocationEndpoint(field.optionSource.endpoint)) {
    return false;
  }

  if (field.optionSource.type === 'api') {
    return true;
  }

  if (field.optionSource.type === 'dynamic') {
    return true;
  }

  return false;
}

export function normalizeStaticSelectOptions(fields: DynamicField[]): void {
  for (const field of fields) {
    if (field.type === 'select' && !field.optionSource && Array.isArray(field.options)) {
      field.options = field.options.map((option) =>
        typeof option === 'string'
          ? {
              name: option,
              label: option,
              value: option,
              id: option,
            }
          : {
            name: option.label,
            label: option.label,
            value: option.value,
            id: option.value,
          }
      );
    }
  }
}

function mapApiResponseToOptions(
  field: DynamicField,
  response: Record<string, unknown>,
): DynamicFieldOption[] {
  const dataPath = field.optionSource?.response?.dataPath ?? 'data';
  const labelKey = field.optionSource?.response?.labelKey ?? 'label';
  const valueKey = field.optionSource?.response?.valueKey ?? 'value';
  const data = (response[dataPath] as Record<string, unknown>[]) || [];

  return data
    .map((item) => {
      const label = item[labelKey];
      const value = item[valueKey];

      if (label == null || value == null) {
        return null;
      }

      return {
        name: String(label),
        label,
        value: value as string | number,
        id: value as string | number,
      } as DynamicFieldOption & { name: string; id: string | number };
    })
    .filter((option): option is DynamicFieldOption & { name: string; id: string | number } =>
      option !== null,
    );
}

/**
 * At form-fill time, dynamic selects intersect builder-saved selections with the
 * current API response. Labels come from the API; options removed from the API
 * are no longer shown.
 */
export function applyApiDropdownOptionsToField(
  field: DynamicField,
  response: Record<string, unknown>,
): void {
  const apiOptions = mapApiResponseToOptions(field, response);

  if (field.optionSource?.type === 'dynamic' && hasSavedDynamicSelectOptions(field)) {
    const apiByValue = new Map(
      apiOptions.map((option) => [String(option.value), option]),
    );

    field.options = (field.options || [])
      .map((savedOption, index) => {
        const savedValue = getOptionValue(savedOption, index);
        if (savedValue === '' || savedValue == null) {
          return null;
        }

        return apiByValue.get(String(savedValue)) ?? null;
      })
      .filter((option): option is DynamicFieldOption => option !== null);

    return;
  }

  field.options = apiOptions as DynamicField['options'];
}

export function loadDynamicDropdownOptions(
  formStorageService: FormStorageService,
  fields: DynamicField[],
): Observable<void> {
  normalizeStaticSelectOptions(fields);

  const dropdownRequests = fields
    .filter((field) => shouldFetchSelectOptionsFromApi(field))
    .map((field) =>
      formStorageService.getEndpointApi<Record<string, unknown>>(field.optionSource!.endpoint!).pipe(
        map((response) => ({ field, response })),
        catchError(() => of({ field, response: null })),
      ),
    );

  if (!dropdownRequests.length) {
    return of(undefined);
  }

  return forkJoin(dropdownRequests).pipe(
    map((results) => {
      results.forEach(({ field, response }) => {
        if (!response) {
          return;
        }
        applyApiDropdownOptionsToField(field, response);
      });
    }),
  );
}
