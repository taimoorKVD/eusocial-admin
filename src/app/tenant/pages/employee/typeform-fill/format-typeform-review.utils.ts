import { DynamicField, DynamicFormValue } from '../../../../interfaces/dynamic-field';
import { EmployeeAssignmentDetail, EmployeeAssignmentSectionView } from '../../../../interfaces/employee-assignment';
import { resolveAllConditionalEffects } from '../../../../shared/conditional-logic';
import {
  formatListingCellValue,
  getCheckboxValues,
  getListingImageSrcs,
} from '../../../../shared/dynamic-listing/dynamic-listing.helpers';
import { getSignatureDisplayUrl, hasSignatureValue } from '../../../../shared/dynamic-form/signature-field.utils';
import { filterAnswerImages } from '../../../form-builder/utils/image-field.utils';
import { buildVisibleQuestionIds } from './typeform-question-navigator';

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
  checkboxItems: string[];
  isEmpty: boolean;
}

export interface CompletedFormSectionView {
  id: string;
  name: string;
  items: TypeformReviewItemView[];
}

export const COMPLETED_FORM_EMPTY_LABEL = 'Not provided';

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

      const display = formatTypeformReviewValue(field, values);
      const imagePreviews = getTypeformReviewImagePreviews(field, values);
      const signaturePreviewUrl = getTypeformReviewSignaturePreview(field, values);
      const checkboxItems =
        field.type === 'checkbox' ? getCheckboxValues(record, field) : [];

      return {
        field,
        label: field.label,
        display,
        imagePreviews,
        signaturePreviewUrl,
        checkboxItems,
        isEmpty: isReviewItemEmpty(display, imagePreviews, signaturePreviewUrl, checkboxItems),
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

/**
 * Voice Reply "Heard" panel text for the current field value.
 * Display-only — does not change FormControl / submission shapes.
 */
export function formatHeardDisplayValue(
  field: DynamicField,
  value: unknown,
): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  if (field.type === 'image') {
    return formatHeardImageValue(value);
  }

  if (field.type === 'signature') {
    return hasSignatureValue(value) ? 'Signature captured' : '';
  }

  const formatted = formatTypeformReviewValue(field, { [field.name]: value });
  if (!formatted.trim() || formatted === '—') {
    return '';
  }

  // Guard against accidental object stringification from listing fallbacks.
  if (formatted.includes('[object Object]')) {
    return '';
  }

  return formatted;
}

function formatHeardImageValue(value: unknown): string {
  const images = filterAnswerImages(value);
  if (!images.length) {
    return '';
  }

  const fileNames = images
    .map((image) => String(image.fileName || '').trim())
    .filter(Boolean);

  if (images.length === 1) {
    return fileNames[0] || 'Image uploaded';
  }

  if (fileNames.length === images.length && fileNames.length <= 3) {
    return fileNames.join(', ');
  }

  return `${images.length} images uploaded`;
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

function isReviewItemEmpty(
  display: string,
  imagePreviews: TypeformReviewImagePreview[],
  signaturePreviewUrl: string | null,
  checkboxItems: string[],
): boolean {
  if (imagePreviews.length || signaturePreviewUrl || checkboxItems.length) {
    return false;
  }

  return !display.trim() || display === '—';
}

export function answersToFormValues(
  fields: DynamicField[],
  answers: Record<string, unknown>,
): DynamicFormValue {
  const values: DynamicFormValue = {};

  for (const field of fields) {
    if (field.id && Object.prototype.hasOwnProperty.call(answers, field.id)) {
      values[field.name] = answers[field.id];
    } else if (field.value !== undefined) {
      values[field.name] = field.value;
    }
  }

  return values;
}

export function buildCompletedFormReviewItems(
  fields: DynamicField[],
  answers: Record<string, unknown>,
): TypeformReviewItemView[] {
  const values = answersToFormValues(fields, answers);
  const effects = resolveAllConditionalEffects(fields, answers);
  const visibleIds = buildVisibleQuestionIds(fields, effects);

  return buildTypeformReviewItems(fields, visibleIds, values);
}

export function buildCompletedFormSectionViews(
  sections: EmployeeAssignmentSectionView[],
  answers: Record<string, unknown>,
): CompletedFormSectionView[] {
  return sections
    .map((section) => ({
      id: section.id,
      name: section.name,
      items: buildCompletedFormReviewItems(section.fields, answers),
    }))
    .filter((section) => section.items.length > 0);
}

export function readAssignmentSubmittedAt(detail: EmployeeAssignmentDetail): string | null {
  const submission = asRecord(detail.raw['submission']);
  const candidates = [
    detail.raw['submittedAt'],
    detail.raw['submitted_at'],
    submission['submittedAt'],
    submission['submitted_at'],
    submission['createdAt'],
    submission['created_at'],
  ];

  for (const candidate of candidates) {
    const text = candidate == null ? '' : String(candidate).trim();
    if (text) {
      return text;
    }
  }

  return null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
