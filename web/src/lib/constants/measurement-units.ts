export type MeasurementSystem = 'imperial' | 'metric';
export type CanonicalMeasurementUnit = 'ml' | 'g' | 'item';
export type MeasurementDimension = 'volume' | 'weight' | 'count';
export type SupportedMeasurementUnit =
  | 'package'
  | 'gal'
  | 'l'
  | 'fl_oz'
  | 'lb'
  | 'kg'
  | 'oz'
  | 'g'
  | 'item';

type UnitDefinition = {
  canonicalUnit: CanonicalMeasurementUnit;
  factor: number;
  dimension: MeasurementDimension;
  label: string;
};

const UNIT_DEFINITIONS: Record<Exclude<SupportedMeasurementUnit, 'package'>, UnitDefinition> = {
  gal: { canonicalUnit: 'ml', factor: 3785.411784, dimension: 'volume', label: 'Gallons' },
  l: { canonicalUnit: 'ml', factor: 1000, dimension: 'volume', label: 'Liters' },
  fl_oz: { canonicalUnit: 'ml', factor: 29.5735295625, dimension: 'volume', label: 'Fluid ounces' },
  lb: { canonicalUnit: 'g', factor: 453.59237, dimension: 'weight', label: 'Pounds' },
  kg: { canonicalUnit: 'g', factor: 1000, dimension: 'weight', label: 'Kilograms' },
  oz: { canonicalUnit: 'g', factor: 28.349523125, dimension: 'weight', label: 'Ounces' },
  g: { canonicalUnit: 'g', factor: 1, dimension: 'weight', label: 'Grams' },
  item: { canonicalUnit: 'item', factor: 1, dimension: 'count', label: 'Items' },
};

const UNIT_ALIASES: Record<string, Exclude<SupportedMeasurementUnit, 'package'>> = {
  gal: 'gal',
  gallon: 'gal',
  gallons: 'gal',
  l: 'l',
  liter: 'l',
  liters: 'l',
  litre: 'l',
  litres: 'l',
  fl_oz: 'fl_oz',
  oz_fl: 'fl_oz',
  'fl oz': 'fl_oz',
  'fluid ounce': 'fl_oz',
  'fluid ounces': 'fl_oz',
  lb: 'lb',
  lbs: 'lb',
  pound: 'lb',
  pounds: 'lb',
  kg: 'kg',
  kilogram: 'kg',
  kilograms: 'kg',
  oz: 'oz',
  ounce: 'oz',
  ounces: 'oz',
  g: 'g',
  gram: 'g',
  grams: 'g',
  item: 'item',
  items: 'item',
  each: 'item',
  ea: 'item',
  count: 'item',
  unit: 'item',
  units: 'item',
};

function normalizeToken(value: string | null | undefined) {
  return value?.trim().toLowerCase().replace(/\./g, '') ?? '';
}

export function normalizeMeasurementUnit(
  rawUnit: string | null | undefined,
): Exclude<SupportedMeasurementUnit, 'package'> | null {
  return UNIT_ALIASES[normalizeToken(rawUnit)] ?? null;
}

export function inferMeasurementDimension(
  rawUnit: string | null | undefined,
): MeasurementDimension | null {
  const normalized = normalizeMeasurementUnit(rawUnit);
  return normalized ? UNIT_DEFINITIONS[normalized].dimension : null;
}

export function convertToCanonical(value: number, rawUnit: string) {
  const normalized = normalizeMeasurementUnit(rawUnit);
  if (!normalized) return null;
  const definition = UNIT_DEFINITIONS[normalized];
  return {
    value: value * definition.factor,
    unit: definition.canonicalUnit,
    dimension: definition.dimension,
  };
}

export function convertFromCanonical(
  value: number,
  canonicalUnit: string | null | undefined,
  targetUnit: Exclude<SupportedMeasurementUnit, 'package'>,
) {
  const definition = UNIT_DEFINITIONS[targetUnit];
  if (definition.canonicalUnit !== canonicalUnit) return null;
  return value / definition.factor;
}

export function getPreferredDisplayUnit(
  rawUnit: string | null | undefined,
  measurementSystem: MeasurementSystem,
  context: 'inventory' | 'dosing' = 'inventory',
): Exclude<SupportedMeasurementUnit, 'package'> | null {
  const normalized = normalizeMeasurementUnit(rawUnit);
  if (!normalized) return null;
  const dimension = UNIT_DEFINITIONS[normalized].dimension;
  if (dimension === 'count') return 'item';
  if (dimension === 'weight') {
    if (context === 'dosing') return measurementSystem === 'metric' ? 'g' : 'oz';
    return measurementSystem === 'metric' ? 'kg' : 'lb';
  }
  if (context === 'dosing') return measurementSystem === 'metric' ? 'l' : 'fl_oz';
  return measurementSystem === 'metric' ? 'l' : 'gal';
}

export function formatMeasurementValue(
  value: string | number | null | undefined,
  rawUnit: string | null | undefined,
  measurementSystem: MeasurementSystem,
  context: 'inventory' | 'dosing' = 'inventory',
) {
  if (value === null || value === undefined || value === '') return '—';
  const numeric = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(numeric)) return String(value);
  const preferredUnit = getPreferredDisplayUnit(rawUnit, measurementSystem, context);
  if (!preferredUnit) {
    return `${numeric.toFixed(2)}${rawUnit ? ` ${rawUnit}` : ''}`;
  }
  const normalized = normalizeMeasurementUnit(rawUnit);
  const canonical = normalized ? UNIT_DEFINITIONS[normalized].canonicalUnit : null;
  const converted = convertFromCanonical(numeric, canonical, preferredUnit);
  const displayValue = converted ?? numeric;
  return `${displayValue.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${UNIT_DEFINITIONS[preferredUnit].label.toLowerCase()}`;
}

export function getMeasurementUnitOptions(
  rawUnit: string | null | undefined,
  measurementSystem: MeasurementSystem,
  context: 'inventory' | 'dosing' = 'inventory',
) {
  const dimension = inferMeasurementDimension(rawUnit) ?? 'count';
  if (dimension === 'count') {
    return [{ value: 'item', label: 'Items' }];
  }
  if (dimension === 'weight') {
    return context === 'dosing'
      ? measurementSystem === 'metric'
        ? [
            { value: 'g', label: 'Grams' },
            { value: 'kg', label: 'Kilograms' },
          ]
        : [
            { value: 'oz', label: 'Ounces' },
            { value: 'lb', label: 'Pounds' },
          ]
      : measurementSystem === 'metric'
        ? [
            { value: 'kg', label: 'Kilograms' },
            { value: 'g', label: 'Grams' },
          ]
        : [
            { value: 'lb', label: 'Pounds' },
            { value: 'oz', label: 'Ounces' },
          ];
  }
  return context === 'dosing'
    ? measurementSystem === 'metric'
      ? [
          { value: 'l', label: 'Liters' },
          { value: 'fl_oz', label: 'Fluid ounces' },
          { value: 'gal', label: 'Gallons' },
        ]
      : [
          { value: 'fl_oz', label: 'Fluid ounces' },
          { value: 'gal', label: 'Gallons' },
          { value: 'l', label: 'Liters' },
        ]
    : measurementSystem === 'metric'
      ? [
          { value: 'l', label: 'Liters' },
          { value: 'gal', label: 'Gallons' },
        ]
      : [
          { value: 'gal', label: 'Gallons' },
          { value: 'l', label: 'Liters' },
        ];
}
