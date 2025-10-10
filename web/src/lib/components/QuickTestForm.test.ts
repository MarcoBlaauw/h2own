import { describe, expect, it } from 'vitest';
import { buildSubmission, parseFormValues } from './quick-test-form-helpers';

describe('quick test form helpers', () => {
  it('filters out blank measurements and returns skipped labels', () => {
    const result = parseFormValues({ fc: '4.5', tc: '', ph: '', ta: '', cya: '' });
    expect(result.success).toBe(true);
    if (!result.success) return;

    const submission = buildSubmission(result.data);
    expect(submission.payload).toEqual({ fc: 4.5 });
    expect(submission.skipped).toEqual(['TC', 'pH', 'TA', 'CYA']);
  });
});
