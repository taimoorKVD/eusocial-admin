import { DynamicField, DynamicFormValue } from '../../../../interfaces/dynamic-field';
import {
  formatListingCellValue,
  getListingImageSrcs,
} from '../../../../shared/dynamic-listing/dynamic-listing.helpers';
import { getSignatureDisplayUrl } from '../../../../shared/dynamic-form/signature-field.utils';

export interface TypeformReviewImagePreview {
  url: string;
  alt: string;
}

export interface TypeformReviewItemView {
  field: DynamicField;
  label: string;
  display: string;
  imagePreviews: TypeformReviewImagePreview[];
  signaturePreviewUrl: string | null;
}

export function buildTypeformReviewItems(
  fields: DynamicField[],
  visibleIds: readonly string[],
  values: DynamicFormValue,
): TypeformReviewItemView[] {
  const fieldMap = new Map(fields.map((field) => [field.id, field]));

  return visibleIds
    .map((fieldId) => {
      const field = fieldMap.get(fieldId);
      if (!field) {
        return null;
      }

      const record: Record<string, unknown> = {
        [field.name]: values[field.name],
      };

      return {
        field,
        label: field.label,
        display: formatTypeformReviewValue(field, values),
        imagePreviews: getTypeformReviewImagePreviews(field, values),
        signaturePreviewUrl: getTypeformReviewSignaturePreview(field, values),
      };
    })
    .filter((item): item is TypeformReviewItemView => !!item);
}

export function formatTypeformReviewValue(
  field: DynamicField,
  values: DynamicFormValue,
): string {
  const record: Record<string, unknown> = {
    [field.name]: values[field.name],
  };

  return formatListingCellValue(record, field);
}

export function getTypeformReviewImagePreviews(
  field: DynamicField,
  values: DynamicFormValue,
): TypeformReviewImagePreview[] {
  if (field.type !== 'image') {
    return [];
  }

  const record: Record<string, unknown> = {
    [field.name]: values[field.name],
  };

  return getListingImageSrcs(record, field).map((url, index) => ({
    url,
    alt: `${field.label} ${index + 1}`,
  }));
}

function getTypeformReviewSignaturePreview(
  field: DynamicField,
  values: DynamicFormValue,
): string | null {
  if (field.type !== 'signature') {
    return null;
  }

  const url = getSignatureDisplayUrl(values[field.name]);
  return url || null;
}
