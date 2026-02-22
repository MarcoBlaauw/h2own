import { z } from 'zod';

export const testParameterMetadata = {
  fc: {
    label: 'FC',
    unit: 'ppm',
    acceptedMin: 0,
    acceptedMax: 10,
    targetMin: 3,
    targetMax: 5,
  },
  tc: {
    label: 'TC',
    unit: 'ppm',
    acceptedMin: 0,
    acceptedMax: 10,
    targetMin: 3,
    targetMax: 6,
  },
  ph: {
    label: 'pH',
    unit: 'pH',
    acceptedMin: 6.8,
    acceptedMax: 8.2,
    targetMin: 7.2,
    targetMax: 7.6,
  },
  ta: {
    label: 'TA',
    unit: 'ppm',
    acceptedMin: 0,
    acceptedMax: 240,
    targetMin: 80,
    targetMax: 120,
  },
  cya: {
    label: 'CYA',
    unit: 'ppm',
    acceptedMin: 0,
    acceptedMax: 100,
    targetMin: 30,
    targetMax: 50,
  },
} as const;

export type MeasurementKey = keyof typeof testParameterMetadata;

export const measurementLabels = Object.fromEntries(
  Object.entries(testParameterMetadata).map(([key, metadata]) => [key, metadata.label])
) as Record<MeasurementKey, string>;

type MeasurementValue = string | number | null | undefined;

const optionalNumberField = (key: MeasurementKey) => {
  const { label, acceptedMin, acceptedMax } = testParameterMetadata[key];

  return z.preprocess(
    value => {
      if (value === '' || value === null || value === undefined) {
        return undefined;
      }
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed === '') return undefined;
        const parsed = Number(trimmed);
        return Number.isNaN(parsed) ? value : parsed;
      }
      return value;
    },
    z
      .number({
        invalid_type_error: `${label} must be a number.`,
      })
      .min(acceptedMin, `${label} must be at least ${acceptedMin} ${testParameterMetadata[key].unit}.`)
      .max(acceptedMax, `${label} must be at most ${acceptedMax} ${testParameterMetadata[key].unit}.`)
      .optional()
  );
};

export const quickTestSchema = z.object({
  fc: optionalNumberField('fc'),
  tc: optionalNumberField('tc'),
  ph: optionalNumberField('ph'),
  ta: optionalNumberField('ta'),
  cya: optionalNumberField('cya'),
});

export type QuickTestSchema = z.infer<typeof quickTestSchema>;

export interface SubmissionResult {
  payload: Record<string, number>;
  skipped: string[];
}

export function buildSubmission(data: QuickTestSchema): SubmissionResult {
  const entries = (Object.entries(data) as [MeasurementKey, number | undefined][]).filter(
    (entry): entry is [MeasurementKey, number] => entry[1] !== undefined
  );
  const payload = Object.fromEntries(entries) as Record<string, number>;
  const skipped = (Object.entries(data) as [MeasurementKey, number | undefined][]) // preserve key order
    .filter(([, value]) => value === undefined)
    .map(([key]) => measurementLabels[key]);

  return { payload, skipped };
}

export function parseFormValues(values: Record<MeasurementKey, MeasurementValue>) {
  return quickTestSchema.safeParse(values);
}

export function formatHelperText(key: MeasurementKey): string {
  const { unit, acceptedMin, acceptedMax, targetMin, targetMax, label } = testParameterMetadata[key];
  const accepted = `${acceptedMin}–${acceptedMax} ${unit}`;
  const target = `${targetMin}–${targetMax} ${unit}`;
  return `${label}: ${unit}, acceptable ${accepted}, target ${target}.`;
}
