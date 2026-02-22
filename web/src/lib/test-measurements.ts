import { z } from 'zod';

export const measurementOrder = ['fc', 'tc', 'ph', 'ta', 'cya', 'ch', 'salt', 'temp'] as const;

export type MeasurementKey = (typeof measurementOrder)[number];

interface MeasurementMetadata {
  label: string;
  unit: string;
  acceptedRange: { min: number; max: number };
  targetRange: string;
  rationale: string;
  step?: number;
}

export const measurementMetadata: Record<MeasurementKey, MeasurementMetadata> = {
  fc: {
    label: 'Free Chlorine (FC)',
    unit: 'ppm',
    acceptedRange: { min: 0, max: 20 },
    targetRange: '2.0–4.0 ppm',
    rationale: 'Sanitizer that actively kills algae and pathogens.',
    step: 0.1,
  },
  tc: {
    label: 'Total Chlorine (TC)',
    unit: 'ppm',
    acceptedRange: { min: 0, max: 20 },
    targetRange: '2.0–4.0 ppm',
    rationale: 'Tracks total sanitizer; compare against FC to estimate combined chlorine.',
    step: 0.1,
  },
  ph: {
    label: 'pH',
    unit: 'pH',
    acceptedRange: { min: 6.8, max: 8.6 },
    targetRange: '7.2–7.8',
    rationale: 'Controls swimmer comfort, equipment protection, and sanitizer effectiveness.',
    step: 0.1,
  },
  ta: {
    label: 'Total Alkalinity (TA)',
    unit: 'ppm',
    acceptedRange: { min: 0, max: 300 },
    targetRange: '80–120 ppm',
    rationale: 'Buffers pH to reduce rapid swings.',
  },
  cya: {
    label: 'Cyanuric Acid (CYA)',
    unit: 'ppm',
    acceptedRange: { min: 0, max: 200 },
    targetRange: '30–50 ppm',
    rationale: 'Protects chlorine from UV breakdown in outdoor pools.',
  },
  ch: {
    label: 'Calcium Hardness (CH)',
    unit: 'ppm',
    acceptedRange: { min: 0, max: 1000 },
    targetRange: '200–400 ppm',
    rationale: 'Helps prevent plaster etching and scale formation.',
  },
  salt: {
    label: 'Salt',
    unit: 'ppm',
    acceptedRange: { min: 0, max: 6000 },
    targetRange: '2700–3400 ppm',
    rationale: 'Keeps salt chlorinators within their efficient generation range.',
  },
  temp: {
    label: 'Water Temperature',
    unit: '°F',
    acceptedRange: { min: 32, max: 110 },
    targetRange: '78–84°F',
    rationale: 'Temperature influences chlorine demand and swimmer comfort.',
    step: 0.1,
  },
};

const optionalMeasurement = (key: MeasurementKey) => {
  const { min, max } = measurementMetadata[key].acceptedRange;
  return z.preprocess(
    value => {
      if (value === '' || value === null || value === undefined) return undefined;
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed === '') return undefined;
        const parsed = Number(trimmed);
        return Number.isNaN(parsed) ? value : parsed;
      }
      return value;
    },
    z
      .number()
      .min(min, `${measurementMetadata[key].label} must be at least ${min} ${measurementMetadata[key].unit}.`)
      .max(max, `${measurementMetadata[key].label} must be at most ${max} ${measurementMetadata[key].unit}.`)
      .optional()
  );
};

export const quickMeasurementKeys = ['fc', 'tc', 'ph', 'ta', 'cya'] as const;
export type QuickMeasurementKey = (typeof quickMeasurementKeys)[number];

export const quickTestSchema = z.object({
  fc: optionalMeasurement('fc'),
  tc: optionalMeasurement('tc'),
  ph: optionalMeasurement('ph'),
  ta: optionalMeasurement('ta'),
  cya: optionalMeasurement('cya'),
});

export const optionalCollectedAt = z.preprocess(
  value => {
    if (value === '' || value === null || value === undefined) return undefined;
    if (typeof value === 'string' && value.trim() === '') return undefined;
    return value;
  },
  z.string().datetime().optional()
);

export const fullTestSchema = z.object({
  fc: optionalMeasurement('fc'),
  tc: optionalMeasurement('tc'),
  ph: optionalMeasurement('ph'),
  ta: optionalMeasurement('ta'),
  cya: optionalMeasurement('cya'),
  ch: optionalMeasurement('ch'),
  salt: optionalMeasurement('salt'),
  temp: optionalMeasurement('temp'),
  collectedAt: optionalCollectedAt,
});

export type FullTestSchema = z.infer<typeof fullTestSchema>;

export const shortMeasurementLabels: Record<QuickMeasurementKey, string> = {
  fc: 'FC',
  tc: 'TC',
  ph: 'pH',
  ta: 'TA',
  cya: 'CYA',
};
