import { fireEvent, render, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import Page from './+page.svelte';
import { api } from '$lib/api';

vi.mock('$lib/api', () => {
  const create = vi.fn();
  const update = vi.fn();
  const del = vi.fn();
  const listVendors = vi.fn();
  const createVendor = vi.fn();
  const updateVendor = vi.fn();
  const syncPrices = vi.fn();
  const importPrices = vi.fn();
  return {
    api: {
      chemicals: {
        create,
        update,
        del,
        list: vi.fn(),
        listCategories: vi.fn(),
      },
      adminVendors: {
        list: listVendors,
        create: createVendor,
        update: updateVendor,
        syncPrices,
        importPrices,
      },
    },
  };
});

describe('admin chemicals page', () => {
  const categories = [
    { categoryId: '11111111-1111-1111-1111-111111111111', name: 'Sanitizers' },
    { categoryId: '22222222-2222-2222-2222-222222222222', name: 'Balancers' },
  ];

  const chemicals = [
    {
      productId: 'c6ffb1fd-5ee3-4a6f-a581-d848e87f6761',
      categoryId: categories[0].categoryId,
      name: 'Liquid Chlorine',
      brand: 'GenericCo',
      productType: 'liquid_chlorine',
      isActive: true,
    },
  ];

  const createMock = api.chemicals.create as unknown as Mock;
  const updateMock = api.chemicals.update as unknown as Mock;
  const deleteMock = api.chemicals.del as unknown as Mock;
  const createVendorMock = api.adminVendors.create as unknown as Mock;
  const updateVendorMock = api.adminVendors.update as unknown as Mock;
  const syncVendorPricesMock = api.adminVendors.syncPrices as unknown as Mock;
  const importVendorPricesMock = api.adminVendors.importPrices as unknown as Mock;
  const vendors = [
    {
      vendorId: 'v6ffb1fd-5ee3-4a6f-a581-d848e87f6761',
      name: 'Home Depot',
      slug: 'home-depot',
      websiteUrl: 'https://www.homedepot.com',
      provider: 'manual',
      isActive: true,
    },
  ];

  const baseData = () => ({
    session: null,
    categories,
    chemicals,
    vendors,
    importHistory: [],
    syncRuns: [],
    loadError: null,
  });

  beforeEach(() => {
    createMock.mockReset();
    updateMock.mockReset();
    deleteMock.mockReset();
    createVendorMock.mockReset();
    updateVendorMock.mockReset();
    syncVendorPricesMock.mockReset();
    importVendorPricesMock.mockReset();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows validation errors when required fields are missing', async () => {
    const { getByRole, findByRole } = render(Page, {
      props: { data: baseData() },
    });

    await fireEvent.click(getByRole('button', { name: /add catalog item/i }));
    const submit = getByRole('button', { name: /create chemical/i });
    await fireEvent.click(submit);

    const alert = await findByRole('alert');
    expect(alert.textContent).toContain('Category is required.');
    expect(alert.textContent).toContain('Name is required.');
    expect(createMock).not.toHaveBeenCalled();
  });

  it('filters product type options by category', async () => {
    const { getByLabelText, getByRole } = render(Page, {
      props: { data: baseData() },
    });

    await fireEvent.click(getByRole('button', { name: /add catalog item/i }));
    await fireEvent.change(getByLabelText('Category'), { target: { value: categories[1].categoryId } });

    const productType = getByLabelText('Product type') as HTMLSelectElement;
    const optionValues = Array.from(productType.options).map((option) => option.value);

    expect(optionValues).toContain('muriatic_acid');
    expect(optionValues).not.toContain('liquid_chlorine');
  });

  it('creates a chemical and appends it to the table', async () => {
    const created = {
      productId: 'a6d9e562-3d8a-4b1c-9f5b-6d97a933fb3f',
      categoryId: categories[1].categoryId,
      name: 'New Acid',
      brand: 'PoolCo',
      productType: 'muriatic_acid',
      isActive: true,
    };

    createMock.mockResolvedValueOnce(
      new Response(JSON.stringify(created), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { getByLabelText, getByRole, findByRole, queryByText } = render(Page, {
      props: { data: baseData() },
    });

    await fireEvent.click(getByRole('button', { name: /add catalog item/i }));
    await fireEvent.change(getByLabelText('Category'), { target: { value: categories[1].categoryId } });
    await fireEvent.input(getByLabelText('Name', { selector: '#name' }), { target: { value: created.name } });
    await fireEvent.change(getByLabelText('Product type'), { target: { value: created.productType } });

    const submit = getByRole('button', { name: /create chemical/i });
    await fireEvent.click(submit);

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        categoryId: categories[1].categoryId,
        name: created.name,
        productType: created.productType,
      })
    );

    const status = await findByRole('status');
    expect(status.textContent).toContain('Chemical created successfully.');
    await waitFor(() => {
      expect(queryByText(created.name)).toBeTruthy();
    });
  });

  it('displays an error when the API rejects create', async () => {
    createMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Validation failed' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { getByLabelText, getByRole, findByRole } = render(Page, {
      props: { data: baseData() },
    });

    await fireEvent.click(getByRole('button', { name: /add catalog item/i }));
    await fireEvent.change(getByLabelText('Category'), { target: { value: categories[1].categoryId } });
    await fireEvent.input(getByLabelText('Name', { selector: '#name' }), { target: { value: 'Scale Inhibitor' } });

    const submit = getByRole('button', { name: /create chemical/i });
    await fireEvent.click(submit);

    const alert = await findByRole('alert');
    expect(alert.textContent).toContain('Validation failed');
  });

  it('allows editing an existing chemical', async () => {
    const updated = { ...chemicals[0], name: 'Updated Chlorine', isActive: false };
    updateMock.mockResolvedValueOnce(
      new Response(JSON.stringify(updated), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { getAllByRole, getByLabelText, queryByText } = render(Page, {
      props: { data: baseData() },
    });

    await fireEvent.click(getAllByRole('button', { name: /^Edit$/i })[1]!);

    const nameInput = getByLabelText('Name', { selector: '#name' }) as HTMLInputElement;
    expect(nameInput.value).toBe(chemicals[0].name);

    await fireEvent.input(nameInput, { target: { value: updated.name } });

    const submit = getAllByRole('button', { name: /save changes/i })[0]!;
    await fireEvent.click(submit);

    expect(updateMock).toHaveBeenCalledWith(chemicals[0].productId, expect.objectContaining({ name: updated.name }));
    await waitFor(() => {
      expect(queryByText(updated.name)).toBeTruthy();
    });
  });

  it('toggles the active state of a chemical', async () => {
    const toggled = { ...chemicals[0], isActive: false };
    updateMock.mockResolvedValueOnce(
      new Response(JSON.stringify(toggled), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { getByRole, findByText } = render(Page, {
      props: { data: baseData() },
    });

    const toggle = getByRole('button', { name: /deactivate/i });
    await fireEvent.click(toggle);

    expect(updateMock).toHaveBeenCalledWith(chemicals[0].productId, { isActive: false });
    expect(await findByText(/inactive/)).toBeTruthy();
  });

  it('deletes a chemical from the catalog', async () => {
    deleteMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    const { getByRole, queryByText, findByText } = render(Page, {
      props: { data: baseData() },
    });

    const deleteButton = getByRole('button', { name: /delete/i });
    await fireEvent.click(deleteButton);

    expect(deleteMock).toHaveBeenCalledWith(chemicals[0].productId);
    expect(await findByText(/no catalog items found/i)).toBeTruthy();
    expect(queryByText(chemicals[0].brand!)).toBeNull();
  });

  it('creates a vendor and appends it to the vendor table', async () => {
    const createdVendor = {
      vendorId: 'new-vendor-id',
      name: 'Amazon',
      slug: 'amazon',
      websiteUrl: 'https://www.amazon.com',
      provider: 'manual',
      isActive: true,
    };

    createVendorMock.mockResolvedValueOnce(
      new Response(JSON.stringify(createdVendor), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const { getByLabelText, getByRole, findByRole, queryByText } = render(Page, {
      props: { data: baseData() },
    });

    await fireEvent.click(getByRole('button', { name: /add vendor/i }));
    await fireEvent.input(getByLabelText('Name', { selector: '#vendor-name' }), {
      target: { value: createdVendor.name },
    });
    await fireEvent.input(getByLabelText('Website URL'), {
      target: { value: createdVendor.websiteUrl },
    });

    await fireEvent.click(getByRole('button', { name: /create vendor/i }));

    expect(createVendorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: createdVendor.name,
        websiteUrl: createdVendor.websiteUrl,
      }),
    );
    expect((await findByRole('status')).textContent).toContain('Vendor created successfully.');
    await waitFor(() => {
      expect(queryByText(createdVendor.websiteUrl)).toBeTruthy();
    });
  });

  it('triggers vendor price sync from the vendor table', async () => {
    syncVendorPricesMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: 'unsupported',
          message: 'home-depot price sync is not configured yet. Vendor registry and price records are ready for a future adapter.',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const { getByRole, findByRole } = render(Page, {
      props: { data: baseData() },
    });

    await fireEvent.click(getByRole('button', { name: /sync prices/i }));

    expect(syncVendorPricesMock).toHaveBeenCalledWith(vendors[0].vendorId);
    expect((await findByRole('status')).textContent).toContain('price sync is not configured yet');
  });

  it('submits a dry-run vendor price import', async () => {
    importVendorPricesMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: 'dry_run',
          message: 'Dry run complete. 1 prices would be created, 0 updated, 0 skipped.',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const { getByLabelText, getByRole, findByRole } = render(Page, {
      props: { data: baseData() },
    });

    await fireEvent.change(getByLabelText('Vendor'), { target: { value: vendors[0].vendorId } });
    await fireEvent.input(getByLabelText('Import payload'), {
      target: {
        value:
          'productName,brand,vendorSku,unitPrice,currency,packageSize,unitLabel,isPrimary\nChampion Muriatic Acid,Champion,CH516,10.49,USD,1 gal,jug,true',
      },
    });
    await fireEvent.click(getByRole('button', { name: /preview import/i }));

    expect(importVendorPricesMock).toHaveBeenCalledWith(
      vendors[0].vendorId,
      expect.objectContaining({
        format: 'csv',
        dryRun: true,
      }),
    );
    expect((await findByRole('status')).textContent).toContain('Dry run complete');
  });

  it('loads the CSV sample template into the import payload', async () => {
    const { getByRole, getByLabelText } = render(Page, {
      props: {
        data: {
          session: null,
          categories,
          chemicals,
          vendors,
          importHistory: [],
          syncRuns: [],
          loadError: null,
        },
      },
    });

    await fireEvent.click(getByRole('button', { name: /use csv sample/i }));

    const payload = getByLabelText('Import payload') as HTMLTextAreaElement;
    expect(payload.value).toContain('productId,productName,brand,vendorSku');
    expect(payload.value).toContain('Champion Muriatic Acid');
  });
});
