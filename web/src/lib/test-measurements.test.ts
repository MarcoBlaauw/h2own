import { describe, expect, it } from 'vitest';
import { fullTestSchema, measurementMetadata, quickTestSchema } from './test-measurements';

describe('test measurement schemas', () => {
  it('keeps quick and full schema ranges aligned for shared fields', () => {
    const quickResult = quickTestSchema.safeParse({ fc: '21' });
    const fullResult = fullTestSchema.safeParse({ fc: '21' });

    expect(quickResult.success).toBe(false);
    expect(fullResult.success).toBe(false);
  });

  it('accepts all supported metrics at boundary values', () => {
    const result = fullTestSchema.safeParse({
      fc: measurementMetadata.fc.acceptedRange.min,
      tc: measurementMetadata.tc.acceptedRange.max,
      ph: measurementMetadata.ph.acceptedRange.min,
      ta: measurementMetadata.ta.acceptedRange.max,
      cya: measurementMetadata.cya.acceptedRange.min,
      ch: measurementMetadata.ch.acceptedRange.max,
      salt: measurementMetadata.salt.acceptedRange.min,
      temp: measurementMetadata.temp.acceptedRange.max,
      collectedAt: new Date().toISOString(),
    });

    expect(result.success).toBe(true);
  });
});
