import { FormField } from '../../form-builder/models/form-field.model';
import { generateFieldId } from '../../form-builder/utils/form-field.factory';
import {
  largestFittingBuilderWidth,
  normalizeBuilderWidthUnits,
  rowHasAvailableColumnSpace,
  rowRemainingGridUnits,
  ROW_WIDTH_UNITS,
} from '../../pages/extra-management/forms/utils/field-builder-adapter.utils';
import { DynamicField } from '../../../interfaces/dynamic-field';
import { DynamicFormSectionLayout } from '../../../shared/dynamic-form/dynamic-form.component';

/** Setup Form Builder row (fields are FormField references by identity). */
export interface SetupFormRow {
  id: string;
  fields: FormField[];
}

/** Setup Form Builder section — typically one default section. */
export interface SetupFormSection {
  id: string;
  name: string;
  rows: SetupFormRow[];
}

/** Persisted layout under schema.sections (field ids only; fields stay flat). */
export interface SetupStoredLayoutRow {
  id: string;
  fieldIds: string[];
}

export interface SetupStoredLayoutSection {
  id: string;
  name: string;
  type: 'custom';
  rows: SetupStoredLayoutRow[];
}

export function createSetupRowId(): string {
  return generateFieldId().replace(/^field_/, 'row_');
}

export function createSetupSectionId(): string {
  return generateFieldId().replace(/^field_/, 'section_');
}

/**
 * Backward-compatible default when no row layout is stored:
 * pack fields into rows by remaining grid units (same 4/6/12 rules as Form Template),
 * preserving field order and existing widths.
 */
export function buildDefaultSetupSections(fields: FormField[]): SetupFormSection[] {
  const normalized = fields.map((field) => ({
    ...field,
    width: normalizeBuilderWidthUnits(field.width),
  }));

  const rows: SetupFormRow[] = [];
  let current: FormField[] = [];

  for (const field of normalized) {
    const width = normalizeBuilderWidthUnits(field.width);
    const canFit =
      current.length === 0 ||
      (current.length < 3 && rowRemainingGridUnits(current) >= width);

    if (!canFit) {
      rows.push({ id: createSetupRowId(), fields: current });
      current = [];
    }

    current.push(field);
  }

  if (current.length) {
    rows.push({ id: createSetupRowId(), fields: current });
  }

  if (!rows.length) {
    rows.push({ id: createSetupRowId(), fields: [] });
  }

  return [
    {
      id: createSetupSectionId(),
      name: '',
      rows,
    },
  ];
}

/** Flatten sections → ordered FormField[] (API fields array). */
export function flattenSetupSections(sections: SetupFormSection[]): FormField[] {
  const fields: FormField[] = [];
  for (const section of sections) {
    for (const row of section.rows) {
      for (const field of row.fields) {
        fields.push({
          ...field,
          width: normalizeBuilderWidthUnits(field.width),
        });
      }
    }
  }
  return fields.map((field, index) => ({ ...field, order: index }));
}

/** Serialize layout for schema.sections (ids only). */
export function serializeSetupSections(
  sections: SetupFormSection[],
): SetupStoredLayoutSection[] {
  return sections.map((section) => ({
    id: section.id,
    name: section.name,
    type: 'custom' as const,
    rows: section.rows.map((row) => ({
      id: row.id,
      fieldIds: row.fields.map((field) => field.id),
    })),
  }));
}

/**
 * Hydrate builder sections from stored layout + flat fields.
 * Missing / invalid layout → safe default (one field per row).
 */
export function hydrateSetupSections(
  fields: FormField[],
  storedSections: unknown,
): SetupFormSection[] {
  const byId = new Map(fields.map((field) => [field.id, field] as const));
  if (!Array.isArray(storedSections) || storedSections.length === 0) {
    return buildDefaultSetupSections(fields);
  }

  const used = new Set<string>();
  const sections: SetupFormSection[] = [];

  for (const raw of storedSections) {
    if (!raw || typeof raw !== 'object') {
      continue;
    }
    const section = raw as Record<string, unknown>;
    const rowsRaw = Array.isArray(section['rows']) ? section['rows'] : [];
    const rows: SetupFormRow[] = [];

    for (const rowRaw of rowsRaw) {
      if (!rowRaw || typeof rowRaw !== 'object') {
        continue;
      }
      const row = rowRaw as Record<string, unknown>;
      const fieldIds = Array.isArray(row['fieldIds'])
        ? (row['fieldIds'] as unknown[]).map(String)
        : Array.isArray(row['fields'])
          ? (row['fields'] as unknown[])
              .map((item) => {
                if (item && typeof item === 'object' && 'id' in item) {
                  return String((item as { id: unknown }).id);
                }
                return '';
              })
              .filter(Boolean)
          : [];

      const rowFields: FormField[] = [];
      for (const id of fieldIds) {
        const field = byId.get(id);
        if (field && !used.has(id)) {
          rowFields.push({
            ...field,
            width: normalizeBuilderWidthUnits(field.width),
          });
          used.add(id);
        }
      }
      if (rowFields.length) {
        rows.push({
          id: String(row['id'] || createSetupRowId()),
          fields: rowFields,
        });
      }
    }

    if (rows.length) {
      sections.push({
        id: String(section['id'] || createSetupSectionId()),
        name: typeof section['name'] === 'string' ? section['name'] : '',
        rows,
      });
    }
  }

  // Append any fields missing from stored layout (do not drop them).
  const orphans = fields.filter((field) => !used.has(field.id));
  if (orphans.length) {
    const orphanRows = orphans.map((field) => ({
      id: createSetupRowId(),
      fields: [
        {
          ...field,
          width: normalizeBuilderWidthUnits(field.width),
        },
      ],
    }));
    if (sections.length) {
      sections[0] = {
        ...sections[0],
        rows: [...sections[0].rows, ...orphanRows],
      };
    } else {
      return buildDefaultSetupSections(fields);
    }
  }

  return sections.length ? sections : buildDefaultSetupSections(fields);
}

/** Update a field in place across sections (settings edits). */
export function updateFieldInSetupSections(
  sections: SetupFormSection[],
  updated: FormField,
): SetupFormSection[] {
  return sections.map((section) => ({
    ...section,
    rows: section.rows.map((row) => ({
      ...row,
      fields: row.fields.map((field) =>
        field.id === updated.id
          ? {
              ...updated,
              width: normalizeBuilderWidthUnits(updated.width),
            }
          : field,
      ),
    })),
  }));
}

export function removeFieldFromSetupSections(
  sections: SetupFormSection[],
  fieldId: string,
): SetupFormSection[] {
  return sections
    .map((section) => ({
      ...section,
      rows: section.rows
        .map((row) => ({
          ...row,
          fields: row.fields.filter((field) => field.id !== fieldId),
        }))
        .filter((row) => row.fields.length > 0),
    }))
    .filter((section) => section.rows.length > 0);
}

export function findSetupFieldRow(
  sections: SetupFormSection[],
  fieldId: string,
): { sectionId: string; rowId: string; row: SetupFormRow } | null {
  for (const section of sections) {
    for (const row of section.rows) {
      if (row.fields.some((field) => field.id === fieldId)) {
        return { sectionId: section.id, rowId: row.id, row };
      }
    }
  }
  return null;
}

export function setupRowCanAddColumn(row: SetupFormRow): boolean {
  return rowHasAvailableColumnSpace(row.fields);
}

export function setupRowRemainingUnits(row: SetupFormRow): number {
  return rowRemainingGridUnits(row.fields);
}

export function setupRowUsedFlexBasis(row: SetupFormRow): string {
  const used = Math.max(0, 12 - setupRowRemainingUnits(row));
  if (used <= 0) {
    return '100%';
  }
  return `calc(${(used / 12) * 100}% - 0.5rem)`;
}

export function setupRowAddColumnFlexBasis(row: SetupFormRow): string {
  const remaining = setupRowRemainingUnits(row);
  if (remaining <= 0) {
    return '0%';
  }
  return `calc(${(remaining / 12) * 100}% - 0.5rem)`;
}

export function clampWidthForRemaining(
  remaining: number,
  requested?: number | null,
): number {
  const fitting = largestFittingBuilderWidth(remaining);
  if (fitting <= 0) {
    return ROW_WIDTH_UNITS.full;
  }
  const want = normalizeBuilderWidthUnits(requested);
  return Math.min(want, fitting);
}

/** Build DynamicForm layoutSections from stored layout + resolved fields. */
export function buildDynamicLayoutSections(
  fields: DynamicField[],
  storedSections: unknown,
): DynamicFormSectionLayout[] {
  const builderLike: FormField[] = fields.map((field) => ({
    ...(field as unknown as FormField),
    id: field.id,
    width: field.width ?? 12,
  }));
  const sections = hydrateSetupSections(builderLike, storedSections);
  const byId = new Map(fields.map((field) => [field.id, field] as const));

  return sections
    .map((section) => ({
      id: section.id,
      name: section.name,
      rows: section.rows
        .map((row) =>
          row.fields
            .map((field) => byId.get(field.id))
            .filter((field): field is DynamicField => !!field),
        )
        .filter((row) => row.length > 0),
    }))
    .filter((section) => section.rows.length > 0);
}
