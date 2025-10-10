import { z } from 'zod';

export const measurementLabels = {
  fc: 'FC',
  tc: 'TC',
  ph: 'pH',
  ta: 'TA',
  cya: 'CYA',
} as const;

type MeasurementKey = keyof typeof measurementLabels;

type MeasurementValue = string | number | null | undefined;

const optionalNumberField = z.preprocess(
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
  z.number().min(0).optional()
);

export const quickTestSchema = z.object({
  fc: optionalNumberField,
  tc: optionalNumberField,
  ph: optionalNumberField,
  ta: optionalNumberField,
  cya: optionalNumberField,
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
