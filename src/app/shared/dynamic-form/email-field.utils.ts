import { Validators } from '@angular/forms';

/**
 * Required email format for Form Builder Email fields only.
 * Applied via getFieldValidators when field.type === 'email'.
 */
export const EMAIL_FIELD_PATTERN =
  /^([a-z0-9]+(?:[._-][a-z0-9]+)*)@([a-z0-9]+(?:[.-][a-z0-9]+)*\.[a-z]{2,})$/i;

/** Pattern validator for Email fields. Empty values stay valid (optional fields). */
export const emailFieldPatternValidator = Validators.pattern(EMAIL_FIELD_PATTERN);
