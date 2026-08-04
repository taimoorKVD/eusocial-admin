import { FormField } from '../models/form-field.model';
import { getLocationFieldDeleteBlockReason } from './location-field-dependencies.utils';
import {
  isFormFieldBulkDeletable,
  removeFormFields,
} from './form-field-operations';

export interface BulkFieldDeleteResolution {
  /** Deletable field ids from the request (protected fields excluded). */
  deletableIds: string[];
  /** Location-dependency (or similar) block after simulating the bulk remove. */
  blockReason: string | null;
}

/**
 * Resolve which requested ids are safe to delete together.
 * Protected (`isEditable === false`) fields are never included.
 * Location dependents are evaluated against the schema after removing
 * all selected deletable fields so Country+State+City can go together.
 */
export function resolveBulkFieldDelete(
  fieldIds: Iterable<string>,
  schema: FormField[]
): BulkFieldDeleteResolution {
  const requested = fieldIds instanceof Set ? fieldIds : new Set(fieldIds);
  const deletableIds = schema
    .filter(field => requested.has(field.id) && isFormFieldBulkDeletable(field))
    .map(field => field.id);

  if (deletableIds.length === 0) {
    return { deletableIds: [], blockReason: null };
  }

  const toDelete = new Set(deletableIds);
  const remaining = schema.filter(field => !toDelete.has(field.id));

  for (const field of schema) {
    if (!toDelete.has(field.id)) {
      continue;
    }

    const blockReason = getLocationFieldDeleteBlockReason(field, remaining);
    if (blockReason) {
      return { deletableIds, blockReason };
    }
  }

  return { deletableIds, blockReason: null };
}

export function applyBulkFieldDelete(
  fieldIds: Iterable<string>,
  schema: FormField[]
): { schema: FormField[]; deletedCount: number; blockReason: string | null } {
  const { deletableIds, blockReason } = resolveBulkFieldDelete(fieldIds, schema);

  if (blockReason || deletableIds.length === 0) {
    return {
      schema,
      deletedCount: 0,
      blockReason,
    };
  }

  return {
    schema: removeFormFields(deletableIds, schema),
    deletedCount: deletableIds.length,
    blockReason: null,
  };
}
