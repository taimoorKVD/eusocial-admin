import { FormField } from '../../form-builder/models/form-field.model';
import {
  normalizeFieldOrder,
  toFieldName,
} from '../../form-builder/utils/form-field.factory';

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
