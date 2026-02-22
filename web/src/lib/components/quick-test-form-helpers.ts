import {
  measurementMetadata,
  quickMeasurementKeys,
  quickTestSchema,
  shortMeasurementLabels,
  type QuickMeasurementKey,
} from '$lib/test-measurements';

type MeasurementValue = string | number | null | undefined;

export { quickTestSchema };
export type MeasurementKey = QuickMeasurementKey;

export type QuickTestSchema = {
  [K in QuickMeasurementKey]?: number;
};

export const testParameterMetadata: Record<
  MeasurementKey,
  {
    label: string;
    unit: string;
    acceptedMin: number;
    acceptedMax: number;
    targetRange: string;
    step?: number;
  }
> = Object.fromEntries(
  quickMeasurementKeys.map((key) => {
    const metadata = measurementMetadata[key];
    return [
      key,
      {
        label: shortMeasurementLabels[key],
        unit: metadata.unit,
        acceptedMin: metadata.acceptedRange.min,
        acceptedMax: metadata.acceptedRange.max,
        targetRange: metadata.targetRange,
        step: metadata.step,
      },
    ];
  })
) as Record<
  MeasurementKey,
  {
    label: string;
    unit: string;
    acceptedMin: number;
    acceptedMax: number;
    targetRange: string;
    step?: number;
  }
>;

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

export function formatHelperText(key: MeasurementKey): string {
  const { unit, acceptedMin, acceptedMax, targetRange, label } = testParameterMetadata[key];
  const accepted = `${acceptedMin}-${acceptedMax} ${unit}`;
  return `${label}: ${unit}, acceptable ${accepted}, target ${targetRange}.`;
}
