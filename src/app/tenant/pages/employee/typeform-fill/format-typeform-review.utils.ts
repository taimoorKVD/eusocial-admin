import { DynamicField, DynamicFormValue } from '../../../../interfaces/dynamic-field';
import { formatListingCellValue } from '../../../../shared/dynamic-listing/dynamic-listing.helpers';

export function formatTypeformReviewValue(
  field: DynamicField,
  values: DynamicFormValue,
): string {
  const record: Record<string, unknown> = {
    [field.name]: values[field.name],
  };

  return formatListingCellValue(record, field);
}
