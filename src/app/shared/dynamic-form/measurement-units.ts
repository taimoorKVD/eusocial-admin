export type MeasurementFieldType = 'price' | 'length' | 'mass' | 'volume' | 'temperature';

export type MeasurementUnitMode = 'fixed' | 'selectable';

export interface MeasurementUnit {
  code: string;
  label: string;
  symbol: string;
}

export const MEASUREMENT_FIELD_TYPES: readonly MeasurementFieldType[] = [
  'price',
  'length',
  'mass',
  'volume',
  'temperature',
] as const;

export const DEFAULT_MEASUREMENT_UNIT_MODE: MeasurementUnitMode = 'fixed';

export const PRICE_UNITS: readonly MeasurementUnit[] = [
  { code: 'USD', label: 'US Dollar', symbol: '$' },
  { code: 'EUR', label: 'Euro', symbol: '€' },
  { code: 'GBP', label: 'British Pound', symbol: '£' },
  { code: 'PKR', label: 'Pakistani Rupee', symbol: 'Rs' },
  { code: 'AED', label: 'UAE Dirham', symbol: 'AED' },
  { code: 'SAR', label: 'Saudi Riyal', symbol: 'SAR' },
  { code: 'INR', label: 'Indian Rupee', symbol: '₹' },
  { code: 'CAD', label: 'Canadian Dollar', symbol: 'CA$' },
  { code: 'AUD', label: 'Australian Dollar', symbol: 'A$' },
  { code: 'JPY', label: 'Japanese Yen', symbol: '¥' },
  { code: 'CNY', label: 'Chinese Yuan', symbol: 'CN¥' },
  { code: 'CHF', label: 'Swiss Franc', symbol: 'CHF' },
] as const;

export const LENGTH_UNITS: readonly MeasurementUnit[] = [
  { code: 'mm', label: 'Millimeter', symbol: 'mm' },
  { code: 'cm', label: 'Centimeter', symbol: 'cm' },
  { code: 'm', label: 'Meter', symbol: 'm' },
  { code: 'km', label: 'Kilometer', symbol: 'km' },
  { code: 'in', label: 'Inch', symbol: 'in' },
  { code: 'ft', label: 'Foot', symbol: 'ft' },
  { code: 'yd', label: 'Yard', symbol: 'yd' },
  { code: 'mi', label: 'Mile', symbol: 'mi' },
  { code: 'nmi', label: 'Nautical Mile', symbol: 'nmi' },
] as const;

export const MASS_UNITS: readonly MeasurementUnit[] = [
  { code: 'mg', label: 'Milligram', symbol: 'mg' },
  { code: 'g', label: 'Gram', symbol: 'g' },
  { code: 'kg', label: 'Kilogram', symbol: 'kg' },
  { code: 't', label: 'Metric Ton', symbol: 't' },
  { code: 'oz', label: 'Ounce', symbol: 'oz' },
  { code: 'lb', label: 'Pound', symbol: 'lb' },
  { code: 'st', label: 'Stone', symbol: 'st' },
  { code: 'ton', label: 'Ton (US)', symbol: 'ton' },
] as const;

export const VOLUME_UNITS: readonly MeasurementUnit[] = [
  { code: 'mL', label: 'Milliliter', symbol: 'mL' },
  { code: 'cL', label: 'Centiliter', symbol: 'cL' },
  { code: 'dL', label: 'Deciliter', symbol: 'dL' },
  { code: 'L', label: 'Liter', symbol: 'L' },
  { code: 'cm3', label: 'Cubic Centimeter', symbol: 'cm³' },
  { code: 'm3', label: 'Cubic Meter', symbol: 'm³' },
  { code: 'us_fl_oz', label: 'US Fluid Ounce', symbol: 'fl oz' },
  { code: 'us_cup', label: 'US Cup', symbol: 'cup' },
  { code: 'us_pint', label: 'US Pint', symbol: 'pt' },
  { code: 'us_quart', label: 'US Quart', symbol: 'qt' },
  { code: 'us_gallon', label: 'US Gallon', symbol: 'gal' },
  { code: 'imp_fl_oz', label: 'Imperial Fluid Ounce', symbol: 'fl oz' },
  { code: 'imp_pint', label: 'Imperial Pint', symbol: 'pt' },
  { code: 'imp_quart', label: 'Imperial Quart', symbol: 'qt' },
  { code: 'imp_gallon', label: 'Imperial Gallon', symbol: 'gal' },
] as const;

export const TEMPERATURE_UNITS: readonly MeasurementUnit[] = [
  { code: 'C', label: 'Celsius', symbol: '°C' },
  { code: 'F', label: 'Fahrenheit', symbol: '°F' },
  { code: 'K', label: 'Kelvin', symbol: 'K' },
] as const;

const DEFAULT_UNITS: Record<MeasurementFieldType, string> = {
  price: 'USD',
  length: 'm',
  mass: 'kg',
  volume: 'L',
  temperature: 'C',
};

export function isMeasurementFieldType(type: unknown): type is MeasurementFieldType {
  return (
    type === 'price' ||
    type === 'length' ||
    type === 'mass' ||
    type === 'volume' ||
    type === 'temperature'
  );
}

export function getUnitsForFieldType(type: MeasurementFieldType): readonly MeasurementUnit[] {
  switch (type) {
    case 'price':
      return PRICE_UNITS;
    case 'length':
      return LENGTH_UNITS;
    case 'mass':
      return MASS_UNITS;
    case 'volume':
      return VOLUME_UNITS;
    case 'temperature':
      return TEMPERATURE_UNITS;
    default:
      return [];
  }
}

export function getDefaultUnitCode(type: MeasurementFieldType): string {
  return DEFAULT_UNITS[type];
}

export function getUnitByCode(
  type: MeasurementFieldType,
  code: string | null | undefined,
): MeasurementUnit | null {
  if (!code) {
    return null;
  }
  const normalized = String(code).trim();
  return (
    getUnitsForFieldType(type).find(
      (unit) => unit.code.toLowerCase() === normalized.toLowerCase(),
    ) ?? null
  );
}

export function normalizeMeasurementUnitCode(
  type: MeasurementFieldType,
  code: string | null | undefined,
): string | null {
  const match = getUnitByCode(type, code);
  return match?.code ?? null;
}

export function getUnitLabel(
  type: MeasurementFieldType,
  code: string | null | undefined,
): string {
  return getUnitByCode(type, code)?.label ?? String(code ?? '');
}

export function getUnitSymbol(
  type: MeasurementFieldType,
  code: string | null | undefined,
): string {
  return getUnitByCode(type, code)?.symbol ?? String(code ?? '');
}

export function normalizeMeasurementUnitMode(raw: unknown): MeasurementUnitMode {
  return raw === 'selectable' ? 'selectable' : DEFAULT_MEASUREMENT_UNIT_MODE;
}
