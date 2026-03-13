import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';

describe('inventory page', () => {
  it('renders the inventory placeholder contract', () => {
    const { getByText } = render(Page);

    expect(getByText('Inventory')).toBeInTheDocument();
    expect(getByText(/Inventory workflows are staged next/i)).toBeInTheDocument();
    expect(getByText(/Shared chemical\/equipment inventory tracking/i)).toBeInTheDocument();
  });
});
