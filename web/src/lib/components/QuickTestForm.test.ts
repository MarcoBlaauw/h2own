import { render, fireEvent } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import QuickTestForm from './QuickTestForm.svelte';
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

describe('QuickTestForm component', () => {
  it('renders helper text from field metadata', () => {
    const { getByText } = render(QuickTestForm, {
      props: { poolId: 'pool-123' },
    });

    expect(getByText('FC: ppm, acceptable 0–10 ppm, target 3–5 ppm.')).toBeTruthy();
    expect(getByText('pH: pH, acceptable 6.8–8.2 pH, target 7.2–7.6 pH.')).toBeTruthy();
  });

  it('displays a meaningful validation error when the submission fails validation', async () => {
    const { getByLabelText, findAllByRole } = render(QuickTestForm, {
      props: { poolId: 'pool-123' },
    });

    const fcInput = getByLabelText('FC') as HTMLInputElement;
    fcInput.value = '-1';
    await fireEvent.input(fcInput);
    expect(fcInput.value).toBe('-1');

    const form = document.querySelector('form');
    expect(form).toBeTruthy();
    await fireEvent.submit(form as HTMLFormElement);

    const alerts = await findAllByRole('alert');
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts.some(alert => alert.textContent?.includes('FC must be at least 0 ppm.'))).toBe(true);
    expect(alerts.some(alert => alert.textContent?.includes('Validation failed: FC must be at least 0 ppm.'))).toBe(true);
  });
});
