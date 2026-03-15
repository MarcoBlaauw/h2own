export type CanonicalMeasurementUnit = 'ml' | 'g' | 'item';

type UnitDefinition = {
  canonicalUnit: CanonicalMeasurementUnit;
  factor: number;
};

const UNIT_ALIASES: Record<string, UnitDefinition> = {
  ml: { canonicalUnit: 'ml', factor: 1 },
  milliliter: { canonicalUnit: 'ml', factor: 1 },
  milliliters: { canonicalUnit: 'ml', factor: 1 },
  l: { canonicalUnit: 'ml', factor: 1000 },
  liter: { canonicalUnit: 'ml', factor: 1000 },
  liters: { canonicalUnit: 'ml', factor: 1000 },
  litre: { canonicalUnit: 'ml', factor: 1000 },
  litres: { canonicalUnit: 'ml', factor: 1000 },
  gal: { canonicalUnit: 'ml', factor: 3785.411784 },
  gallon: { canonicalUnit: 'ml', factor: 3785.411784 },
  gallons: { canonicalUnit: 'ml', factor: 3785.411784 },
  fl_oz: { canonicalUnit: 'ml', factor: 29.5735295625 },
  oz_fl: { canonicalUnit: 'ml', factor: 29.5735295625 },
  'fl oz': { canonicalUnit: 'ml', factor: 29.5735295625 },
  'fluid ounce': { canonicalUnit: 'ml', factor: 29.5735295625 },
  'fluid ounces': { canonicalUnit: 'ml', factor: 29.5735295625 },
  g: { canonicalUnit: 'g', factor: 1 },
  gram: { canonicalUnit: 'g', factor: 1 },
  grams: { canonicalUnit: 'g', factor: 1 },
  kg: { canonicalUnit: 'g', factor: 1000 },
  kilogram: { canonicalUnit: 'g', factor: 1000 },
  kilograms: { canonicalUnit: 'g', factor: 1000 },
  lb: { canonicalUnit: 'g', factor: 453.59237 },
  lbs: { canonicalUnit: 'g', factor: 453.59237 },
  pound: { canonicalUnit: 'g', factor: 453.59237 },
  pounds: { canonicalUnit: 'g', factor: 453.59237 },
  oz: { canonicalUnit: 'g', factor: 28.349523125 },
  ounce: { canonicalUnit: 'g', factor: 28.349523125 },
  ounces: { canonicalUnit: 'g', factor: 28.349523125 },
  item: { canonicalUnit: 'item', factor: 1 },
  items: { canonicalUnit: 'item', factor: 1 },
  each: { canonicalUnit: 'item', factor: 1 },
  ea: { canonicalUnit: 'item', factor: 1 },
  count: { canonicalUnit: 'item', factor: 1 },
  unit: { canonicalUnit: 'item', factor: 1 },
  units: { canonicalUnit: 'item', factor: 1 },
};

export class MeasurementUnitValidationError extends Error {
  constructor(message = 'Unsupported measurement unit.') {
    super(message);
    this.name = 'MeasurementUnitValidationError';
  }
}

function normalizeUnitToken(rawUnit: string) {
  return rawUnit.trim().toLowerCase().replace(/\./g, '');
}

export function resolveMeasurementUnit(rawUnit: string) {
  const definition = UNIT_ALIASES[normalizeUnitToken(rawUnit)];
  if (!definition) {
    throw new MeasurementUnitValidationError(
      'Unsupported unit. Choose a supported volume, weight, or count unit.'
    );
  }
  return definition;
}

export function normalizeMeasurementValue(value: number, rawUnit: string) {
  const definition = resolveMeasurementUnit(rawUnit);
  return {
    value: value * definition.factor,
    unit: definition.canonicalUnit,
  };
}

export function normalizeMeasurementPrice(value: number, rawUnit: string) {
  const definition = resolveMeasurementUnit(rawUnit);
  if (definition.factor <= 0) {
    throw new MeasurementUnitValidationError('Unsupported unit price conversion.');
  }
  return {
    value: value / definition.factor,
    unit: definition.canonicalUnit,
  };
}
