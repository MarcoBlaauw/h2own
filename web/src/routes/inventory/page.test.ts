import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';

describe('inventory page', () => {
  it('renders the account inventory experience', () => {
    const { getByText } = render(Page, {
      props: {
        data: {
          session: null,
          inventory: { items: [] },
          transactions: { items: [] },
          costs: { items: [], summary: null },
          pools: [],
          chemicals: [],
          productCategories: [],
          vendors: [],
          preferences: null,
          selectedPoolId: null,
        },
      },
    });

    expect(getByText('Inventory')).toBeInTheDocument();
    expect(getByText(/Shared chemical and supply inventory, low-stock alerts, vendor pricing/i)).toBeInTheDocument();
    expect(getByText(/No inventory items tracked yet/i)).toBeInTheDocument();
  });
});
