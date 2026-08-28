import { Injectable } from '@angular/core';
import { forkJoin, Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { loadDynamicDropdownOptions } from '../../../shared/dynamic-listing/dynamic-field-options.loader';
import { shouldIncludeFieldInRuntimeForm } from '../../../shared/conditional-logic';
import { resolveCharacterLimit, supportsCharacterLimit } from '../../../shared/dynamic-form/character-limit.utils';
import {
  DEFAULT_RANGE_STEP,
  normalizeRangeTimeFormat,
  normalizeRangeType,
} from '../../../shared/dynamic-form/range-field.utils';
import { DynamicField, DynamicFieldType } from '../../../interfaces/dynamic-field';
import { FieldOption, FieldType, FormField } from '../../form-builder/models/form-field.model';
import { FieldOptionsService } from '../../form-builder/services/field-options.service';
import { normalizeCheckboxFieldOptions, normalizeStaticSelectFieldOptions } from '../../form-builder/utils/field-options.utils';
import { toFieldName } from '../../form-builder/utils/form-field.factory';
import { resolveBuilderLocationKind } from '../../form-builder/utils/location-field-dependencies.utils';
import {
  cloneImageFiles,
  sanitizeImageFieldConfig,
} from '../../form-builder/utils/image-field.utils';
import { FormStorageService } from './form-storage.service';

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
  constructor(
    private fieldOptionsService: FieldOptionsService,
    private formStorageService: FormStorageService,
  ) {}

  resolveFields(formFields: FormField[]): Observable<DynamicField[]> {
    const visibleFields = (formFields || []).filter((field) =>
      shouldIncludeFieldInRuntimeForm(field),
    );

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
      switchMap((fields) =>
        loadDynamicDropdownOptions(this.formStorageService, fields).pipe(map(() => fields)),
      ),
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
    const imageConfig =
      type === 'image' ? sanitizeImageFieldConfig(field as FormField & Record<string, unknown>) : null;

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
      selectionType:
        type === 'select'
          ? field.optionSource?.type === 'dynamic' &&
            resolveBuilderLocationKind(field.optionSource.endpoint) != null
            ? 'single'
            : field.selectionType || 'single'
          : undefined,
      isShow: field.isShow,
      isReadonly: field.isReadonly,
      allowDecimal:
        type === 'number' || (type === 'range' && normalizeRangeType(field.rangeType) === 'number')
          ? field.allowDecimal === true
          : undefined,
      characterLimit: supportsCharacterLimit(type)
        ? resolveCharacterLimit(type, field.characterLimit)
        : undefined,
      rangeType: type === 'range' ? normalizeRangeType(field.rangeType) : undefined,
      rangeMin: field.rangeMin,
      rangeMax: field.rangeMax,
      rangeStep:
        type === 'range' && normalizeRangeType(field.rangeType) === 'number'
          ? (Number(field.rangeStep) > 0 ? Number(field.rangeStep) : DEFAULT_RANGE_STEP)
          : undefined,
      rangeMinDate: field.rangeMinDate,
      rangeMaxDate: field.rangeMaxDate,
      rangePlaceholderFrom: field.rangePlaceholderFrom,
      rangePlaceholderTo: field.rangePlaceholderTo,
      timeFormat:
        type === 'range' && normalizeRangeType(field.rangeType) === 'time'
          ? normalizeRangeTimeFormat(field.timeFormat)
          : undefined,
      condition: field.condition,
      referenceImages: imageConfig
        ? cloneImageFiles(imageConfig.referenceImages)
        : undefined,
      multiple: imageConfig?.multiple,
      minFiles: imageConfig?.minFiles,
      maxFiles: imageConfig?.maxFiles,
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
