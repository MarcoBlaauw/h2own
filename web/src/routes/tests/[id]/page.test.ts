import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';

describe('test detail page', () => {
  it('renders test details when data is available', () => {
    const test = {
      sessionId: '3f8f2ed1-5dd7-4c47-8b49-920c053f1d1a',
      poolId: 'd2c4b3f1-0f06-4c5f-b8d0-0a1ad5b90e0b',
      testedAt: '2024-04-10T12:30:00.000Z',
      freeChlorinePpm: '3.5',
      totalChlorinePpm: '4.1',
      phLevel: '7.4',
      totalAlkalinityPpm: 90,
      cyanuricAcidPpm: 40,
      calciumHardnessPpm: 250,
      saltPpm: 3200,
      waterTempF: 78,
      cc: 0.2,
      notes: 'Clear and balanced.',
    };

    const { getByText } = render(Page, {
      props: { data: { test, loadError: null } },
    });

    expect(getByText('Test details')).toBeTruthy();
    expect(getByText(test.sessionId)).toBeTruthy();
    expect(getByText('3.50 ppm')).toBeTruthy();
    expect(getByText('4.10 ppm')).toBeTruthy();
    expect(getByText('7.40')).toBeTruthy();
    expect(getByText('0.20 ppm')).toBeTruthy();
    expect(getByText('90 ppm')).toBeTruthy();
    expect(getByText('Clear and balanced.')).toBeTruthy();
  });

  it('renders a fallback when the test is missing', () => {
    const { getByRole, getByText } = render(Page, {
      props: { data: { test: null, loadError: 'Test not found.' } },
    });

    expect(getByRole('alert').textContent).toContain('Test not found.');
    expect(getByText('No test data available.')).toBeTruthy();
  });
});
