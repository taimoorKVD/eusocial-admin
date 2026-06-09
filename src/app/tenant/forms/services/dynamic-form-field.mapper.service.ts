import { Injectable } from '@angular/core';
import { forkJoin, Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { DynamicField, DynamicFieldType } from '../../../interfaces/dynamic-field';
import { FieldOption, FieldType, FormField } from '../../form-builder/models/form-field.model';
import { FieldOptionsService } from '../../form-builder/services/field-options.service';
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
      options,
    };
  }

  private mapType(type: FieldType): DynamicFieldType | null {
    if (SUPPORTED_TYPES.has(type as DynamicFieldType)) {
      return type as DynamicFieldType;
    }

    return null;
  }
}
