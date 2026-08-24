import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { DynamicField } from '../../interfaces/dynamic-field';
import { FormStorageService } from '../../tenant/forms/services/form-storage.service';

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

export function applyApiDropdownOptionsToField(
  field: DynamicField,
  response: Record<string, unknown>,
): void {
  const dataPath = field.optionSource?.response?.dataPath ?? 'data';
  const labelKey = field.optionSource?.response?.labelKey ?? 'label';
  const valueKey = field.optionSource?.response?.valueKey ?? 'value';
  const data = (response[dataPath] as Record<string, unknown>[]) || [];

  field.options = data.map((item) => ({
    name: item[labelKey] as string,
    label: item[labelKey],
    value: item[valueKey],
    id: item[valueKey],
  })) as DynamicField['options'];
}

export function loadDynamicDropdownOptions(
  formStorageService: FormStorageService,
  fields: DynamicField[],
): Observable<void> {
  normalizeStaticSelectOptions(fields);

  const dropdownRequests = fields
    .filter(
      (field) =>
        field.type === 'select' &&
        (field.optionSource?.type === 'api' || field.optionSource?.type === 'dynamic') &&
        field.optionSource?.endpoint &&
        !isLazyLocationEndpoint(field.optionSource.endpoint),
    )
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
