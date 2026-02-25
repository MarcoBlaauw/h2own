import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import AdSlot from './AdSlot.svelte';

describe('AdSlot', () => {
  it('renders nothing when disabled', () => {
    const { queryByLabelText, queryByText } = render(AdSlot, {
      props: {
        enabled: false,
        placement: 'overview_footer',
      },
    });

    expect(queryByLabelText('Sponsored content')).toBeNull();
    expect(queryByText('Ad slot reserved for non-paying subscribers.')).toBeNull();
  });

  it('renders sponsored placeholder when enabled', () => {
    const { getByLabelText, getByText } = render(AdSlot, {
      props: {
        enabled: true,
        label: 'Sponsored',
        placement: 'visitor_landing',
      },
    });

    expect(getByLabelText('Sponsored content')).toBeTruthy();
    expect(getByText('visitor_landing')).toBeTruthy();
    expect(getByText('Ad slot reserved for non-paying subscribers.')).toBeTruthy();
  });
});
