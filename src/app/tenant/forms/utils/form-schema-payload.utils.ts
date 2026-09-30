import { FormField } from '../../form-builder/models/form-field.model';
import {
  normalizeFieldOrder,
  toFieldName,
} from '../../form-builder/utils/form-field.factory';
import {
  resolveCharacterLimit,
  supportsCharacterLimit,
} from '../../../shared/dynamic-form/character-limit.utils';
import {
  DEFAULT_RANGE_STEP,
  normalizeRangeTimeFormat,
  normalizeRangeType,
} from '../../../shared/dynamic-form/range-field.utils';
import { resolveBuilderLocationKind } from '../../form-builder/utils/location-field-dependencies.utils';

export function buildFormSchemaPayload(fields: FormField[]) {
  const orderedFields = normalizeFieldOrder([...fields]);

  return {
    schema: {
      sections: [],
      fields: orderedFields.map((field, index) => ({
        ...field,
        id: field.id,
        fieldTypeName: field.fieldTypeName || field.type,
        fieldKey: 'name',
        label: field.label,
        name: toFieldName(field.label),
        placeholder: field.placeholder,
        isRequired: field.required,
        isShow: field.isShow !== false,
        optionSource: field.optionSource,
        selectionType:
          field.type === 'select'
            ? field.optionSource?.type === 'dynamic' &&
              resolveBuilderLocationKind(field.optionSource.endpoint) != null
              ? 'single'
              : field.selectionType || 'single'
            : undefined,
        referenceImages:
          field.type === 'image' ? field.referenceImages || [] : undefined,
        multiple: field.type === 'image' ? field.multiple === true : undefined,
        minFiles: field.type === 'image' ? field.minFiles : undefined,
        maxFiles: field.type === 'image' ? field.maxFiles : undefined,
        allowDecimal:
          field.type === 'number' ||
          (field.type === 'range' && normalizeRangeType(field.rangeType) === 'number') ||
          field.type === 'price' ||
          field.type === 'length' ||
          field.type === 'mass' ||
          field.type === 'volume' ||
          field.type === 'temperature'
            ? field.type === 'price' ||
              field.type === 'length' ||
              field.type === 'mass' ||
              field.type === 'volume' ||
              field.type === 'temperature'
              ? true
              : field.allowDecimal === true
            : undefined,
        characterLimit: supportsCharacterLimit(field.type)
          ? resolveCharacterLimit(field.type, field.characterLimit)
          : undefined,
        rangeType: field.type === 'range' ? normalizeRangeType(field.rangeType) : undefined,
        rangeMin: field.rangeMin,
        rangeMax: field.rangeMax,
        rangeStep:
          field.type === 'range' && normalizeRangeType(field.rangeType) === 'number'
            ? (Number(field.rangeStep) > 0 ? Number(field.rangeStep) : DEFAULT_RANGE_STEP)
            : undefined,
        rangeMinDate: field.rangeMinDate,
        rangeMaxDate: field.rangeMaxDate,
        minDate: field.type === 'date' ? field.minDate : undefined,
        maxDate: field.type === 'date' ? field.maxDate : undefined,
        rangePlaceholderFrom: field.rangePlaceholderFrom,
        rangePlaceholderTo: field.rangePlaceholderTo,
        timeFormat:
          field.type === 'range' && normalizeRangeType(field.rangeType) === 'time'
            ? normalizeRangeTimeFormat(field.timeFormat)
            : undefined,
        isReadonly: field.isReadonly === true,
        isSystemField: true,
        isEditable: field.isEditable !== false,
        isDeletable: false,
        layoutConfig: {
          grid_width_mobile: 12,
          grid_width_desktop: 6,
        },
        defaultValue: field.defaultValue ?? field.value ?? null,
        options: field.options || [],
        validations: field.validations || {},
        sortOrder: index + 1,
        width: field.width ?? 12,
      })),
      conditionalRules: [],
    },
    markAsDraft: false,
  };
}

export function serializeSchemaFields(fields: FormField[]): string {
  return JSON.stringify(buildFormSchemaPayload(fields).schema.fields);
}
