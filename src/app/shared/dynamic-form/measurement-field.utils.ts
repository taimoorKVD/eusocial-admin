import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { DynamicField } from '../../interfaces/dynamic-field';
import {
  getDefaultUnitCode,
  getUnitSymbol,
  isMeasurementFieldType,
  MeasurementFieldType,
  MeasurementUnitMode,
  normalizeMeasurementUnitCode,
  normalizeMeasurementUnitMode,
} from './measurement-units';

export interface MeasurementFieldValue {
  value: number | null;
  unit: string | null;
}

export interface MeasurementFieldConfigLike {
  type?: string;
  unitMode?: MeasurementUnitMode | string | null;
  unit?: string | null;
  minValue?: number | null;
  maxValue?: number | null;
  required?: boolean;
}

export function createEmptyMeasurementValue(
  type: MeasurementFieldType,
  unit?: string | null,
): MeasurementFieldValue {
  return {
    value: null,
    unit: normalizeMeasurementUnitCode(type, unit) ?? getDefaultUnitCode(type),
  };
}

export function isMeasurementValueEmpty(value: MeasurementFieldValue | null | undefined): boolean {
  return value?.value === null || value?.value === undefined || Number.isNaN(Number(value.value));
}

export function normalizeMeasurementValue(
  raw: unknown,
  type: MeasurementFieldType,
  options?: { unitMode?: MeasurementUnitMode; unit?: string | null },
): MeasurementFieldValue {
  const unitMode = normalizeMeasurementUnitMode(options?.unitMode);
  const configuredUnit =
    normalizeMeasurementUnitCode(type, options?.unit) ?? getDefaultUnitCode(type);

  if (raw == null || raw === '') {
    return {
      value: null,
      unit: unitMode === 'fixed' ? configuredUnit : configuredUnit,
    };
  }

  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const record = raw as Record<string, unknown>;
    const amountRaw = record['value'] ?? record['amount'] ?? record['quantity'];
    const unitRaw = record['unit'] ?? record['currency'] ?? options?.unit;

    let numeric: number | null = null;
    if (amountRaw !== null && amountRaw !== undefined && amountRaw !== '') {
      const parsed = typeof amountRaw === 'number' ? amountRaw : Number(String(amountRaw).trim());
      numeric = Number.isFinite(parsed) ? parsed : null;
    }

    const unit =
      unitMode === 'fixed'
        ? configuredUnit
        : normalizeMeasurementUnitCode(type, unitRaw as string) ?? configuredUnit;

    return { value: numeric, unit };
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) {
      return {
        value: null,
        unit: configuredUnit,
      };
    }

    // Form Template (section preview) stores { value, unit } as a JSON string —
    // same pattern as range fields. Prefer structured JSON before numeric parse.
    if (trimmed.startsWith('{')) {
      try {
        return normalizeMeasurementValue(JSON.parse(trimmed), type, options);
      } catch {
        // fall through to numeric parse
      }
    }

    const numeric = Number(trimmed);
    return {
      value: Number.isFinite(numeric) ? numeric : null,
      unit: configuredUnit,
    };
  }

  if (typeof raw === 'number') {
    return {
      value: Number.isFinite(raw) ? raw : null,
      unit: configuredUnit,
    };
  }

  return createEmptyMeasurementValue(type, configuredUnit);
}

export function resolveMeasurementMinValue(
  field: MeasurementFieldConfigLike | null | undefined,
): number {
  const raw = field?.minValue;
  if (raw === null || raw === undefined || raw === ('' as unknown)) {
    return 0;
  }
  const numeric = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function resolveMeasurementMaxValue(
  field: MeasurementFieldConfigLike | null | undefined,
): number | null {
  const raw = field?.maxValue;
  if (raw === null || raw === undefined || raw === ('' as unknown)) {
    return null;
  }
  const numeric = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(numeric) ? numeric : null;
}

export function measurementFieldValidator(
  field: DynamicField,
  options?: { required?: boolean; visible?: boolean },
): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const visible = options?.visible ?? true;
    if (!visible) {
      return null;
    }

    if (!isMeasurementFieldType(field.type)) {
      return null;
    }

    const required = options?.required ?? !!field.required;
    const normalized = normalizeMeasurementValue(control.value, field.type, {
      unitMode: normalizeMeasurementUnitMode(field.unitMode),
      unit: field.unit,
    });

    if (isMeasurementValueEmpty(normalized)) {
      return required ? { required: true } : null;
    }

    const amount = normalized.value as number;
    const min = resolveMeasurementMinValue(field);
    if (amount < min) {
      return { measurementBelowMin: { min, actual: amount } };
    }

    const max = resolveMeasurementMaxValue(field);
    if (max != null && amount > max) {
      return { measurementAboveMax: { max, actual: amount } };
    }

    if (!normalized.unit) {
      return { measurementUnitRequired: true };
    }

    return null;
  };
}

export function formatMeasurementDisplay(
  raw: unknown,
  type: MeasurementFieldType,
  options?: { unitMode?: MeasurementUnitMode; unit?: string | null },
): string {
  const normalized = normalizeMeasurementValue(raw, type, options);
  if (isMeasurementValueEmpty(normalized)) {
    return '—';
  }

  const symbol = getUnitSymbol(type, normalized.unit);
  return `${normalized.value} ${symbol}`.trim();
}

export function getMeasurementFieldType(
  type: string | null | undefined,
): MeasurementFieldType | null {
  return isMeasurementFieldType(type) ? type : null;
}
