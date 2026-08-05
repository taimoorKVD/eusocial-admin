import { Injectable } from '@angular/core';
import { forkJoin, Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { DynamicField, DynamicFieldType } from '../../../interfaces/dynamic-field';
import { FieldOption, FieldType, FormField } from '../../form-builder/models/form-field.model';
import { FieldOptionsService } from '../../form-builder/services/field-options.service';
import { normalizeCheckboxFieldOptions, normalizeStaticSelectFieldOptions } from '../../form-builder/utils/field-options.utils';
import { toFieldName } from '../../form-builder/utils/form-field.factory';

const SUPPORTED_TYPES = new Set<DynamicFieldType>([
  'text',
  'email',
  'number',
  'textarea',
  'select',
  'checkbox',
  'radio',
  'date',
  'image',
  'parameter',
  'signature',
  'user-timestamp',
  'rating',
  'range',
  'barcode',
  'qr-code',
]);

@Injectable({
  providedIn: 'root',
})
export class DynamicFormFieldMapperService {
  constructor(private fieldOptionsService: FieldOptionsService) {}

  resolveFields(formFields: FormField[]): Observable<DynamicField[]> {
    const visibleFields = (formFields || []).filter((field) => field.isShow !== false);

    if (!visibleFields.length) {
      return of([]);
    }

    const requests = visibleFields.map((field) =>
      this.fieldOptionsService.getOptions(field.optionSource).pipe(
        map((options) => this.toDynamicField(field, options)),
      ),
    );

    return forkJoin(requests).pipe(
      map((fields) => fields.filter((field): field is DynamicField => field !== null)),
    );
  }

  private toDynamicField(field: FormField, resolvedOptions: FieldOption[]): DynamicField | null {
    const type = this.mapType(field.type);

    if (!type) {
      return null;
    }

    const options =
      resolvedOptions.length > 0
        ? resolvedOptions
        : field.options?.length
          ? field.options
          : [];

    const normalizedOptions = this.normalizeOptions(field, options);

    return {
      id: field.id,
      name: field.name || toFieldName(field.label),
      type,
      label: field.label,
      value: field.value ?? field.defaultValue ?? undefined,
      required: field.required,
      placeholder: field.placeholder,
      width: field.width ?? 12,
      order: field.order,
      options: normalizedOptions,
      optionSource: field.optionSource
        ? {
            type: (field.optionSource.type as 'api' | 'static' | 'dynamic') || 'static',
            endpoint: field.optionSource.endpoint,
            response: {
              labelKey: field.optionSource.response?.labelKey || 'label',
              valueKey: field.optionSource.response?.valueKey || 'value',
              dataPath: field.optionSource.response?.dataPath || 'data',
            },
          }
        : undefined,
      selectionType: type === 'select' ? field.selectionType || 'single' : undefined,
      isShow: field.isShow,
      isReadonly: field.isReadonly,
      condition: field.condition,
    };
  }

  private normalizeOptions(
    field: FormField,
    options: Array<string | FieldOption>
  ): FieldOption[] {
    if (field.type === 'checkbox') {
      return normalizeCheckboxFieldOptions(options);
    }

    if (field.type === 'select') {
      if (field.optionSource?.type === 'dynamic') {
        return options as FieldOption[];
      }

      if (field.optionSource?.type !== 'api') {
        return normalizeStaticSelectFieldOptions(options);
      }
    }

    return options as FieldOption[];
  }

  private mapType(type: FieldType): DynamicFieldType | null {
    if (SUPPORTED_TYPES.has(type as DynamicFieldType)) {
      return type as DynamicFieldType;
    }

    return null;
  }
}
