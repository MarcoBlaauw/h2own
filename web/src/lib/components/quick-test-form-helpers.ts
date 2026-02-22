import {
  quickTestSchema,
  shortMeasurementLabels,
  type QuickMeasurementKey,
} from '$lib/test-measurements';

type MeasurementValue = string | number | null | undefined;

export { quickTestSchema };

export type QuickTestSchema = {
  [K in QuickMeasurementKey]?: number;
};

export interface SubmissionResult {
  payload: Record<string, number>;
  skipped: string[];
}

export function buildSubmission(data: QuickTestSchema): SubmissionResult {
  const entries = (Object.entries(data) as [QuickMeasurementKey, number | undefined][]).filter(
    (entry): entry is [QuickMeasurementKey, number] => entry[1] !== undefined
  );
  const payload = Object.fromEntries(entries) as Record<string, number>;
  const skipped = (Object.entries(data) as [QuickMeasurementKey, number | undefined][])
    .filter(([, value]) => value === undefined)
    .map(([key]) => shortMeasurementLabels[key]);

  return { payload, skipped };
}

export function parseFormValues(values: Record<QuickMeasurementKey, MeasurementValue>) {
  return quickTestSchema.safeParse(values);
}
