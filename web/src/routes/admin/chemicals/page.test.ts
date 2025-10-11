import { fireEvent, render, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import Page from './+page.svelte';
import { api } from '$lib/api';

vi.mock('$lib/api', () => {
  const create = vi.fn();
  const update = vi.fn();
  const del = vi.fn();
  return {
    api: {
      chemicals: {
        create,
        update,
        del,
        list: vi.fn(),
        listCategories: vi.fn(),
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
      productType: 'chlorine',
      isActive: true,
    },
  ];

  const createMock = api.chemicals.create as unknown as Mock;
  const updateMock = api.chemicals.update as unknown as Mock;
  const deleteMock = api.chemicals.del as unknown as Mock;

  beforeEach(() => {
    createMock.mockReset();
    updateMock.mockReset();
    deleteMock.mockReset();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows validation errors when required fields are missing', async () => {
    const { getByRole, findByRole } = render(Page, {
      props: { data: { session: null, categories, chemicals, loadError: null } },
    });

    const submit = getByRole('button', { name: /create chemical/i });
    await fireEvent.click(submit);

    const alert = await findByRole('alert');
    expect(alert.textContent).toContain('Category is required.');
    expect(alert.textContent).toContain('Name is required.');
    expect(createMock).not.toHaveBeenCalled();
  });

  it('creates a chemical and appends it to the table', async () => {
    const created = {
      productId: 'a6d9e562-3d8a-4b1c-9f5b-6d97a933fb3f',
      categoryId: categories[0].categoryId,
      name: 'New Acid',
      brand: 'PoolCo',
      productType: 'acid',
      isActive: true,
    };

    createMock.mockResolvedValueOnce(
      new Response(JSON.stringify(created), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { getByLabelText, getByRole, findByRole, queryByText } = render(Page, {
      props: { data: { session: null, categories, chemicals, loadError: null } },
    });

    await fireEvent.change(getByLabelText('Category'), { target: { value: categories[0].categoryId } });
    await fireEvent.input(getByLabelText('Name'), { target: { value: created.name } });

    const submit = getByRole('button', { name: /create chemical/i });
    await fireEvent.click(submit);

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: categories[0].categoryId, name: created.name })
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
      props: { data: { session: null, categories, chemicals, loadError: null } },
    });

    await fireEvent.change(getByLabelText('Category'), { target: { value: categories[1].categoryId } });
    await fireEvent.input(getByLabelText('Name'), { target: { value: 'Scale Inhibitor' } });

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

    const { getByRole, getByLabelText, queryByText } = render(Page, {
      props: { data: { session: null, categories, chemicals, loadError: null } },
    });

    await fireEvent.click(getByRole('button', { name: /edit/i }));

    const nameInput = getByLabelText('Name') as HTMLInputElement;
    expect(nameInput.value).toBe(chemicals[0].name);

    await fireEvent.input(nameInput, { target: { value: updated.name } });

    const submit = getByRole('button', { name: /save changes/i });
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
      props: { data: { session: null, categories, chemicals, loadError: null } },
    });

    const toggle = getByRole('button', { name: /deactivate/i });
    await fireEvent.click(toggle);

    expect(updateMock).toHaveBeenCalledWith(chemicals[0].productId, { isActive: false });
    expect(await findByText(/inactive/)).toBeTruthy();
  });

  it('deletes a chemical from the catalog', async () => {
    deleteMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    const { getByRole, queryByText } = render(Page, {
      props: { data: { session: null, categories, chemicals, loadError: null } },
    });

    const deleteButton = getByRole('button', { name: /delete/i });
    await fireEvent.click(deleteButton);

    expect(deleteMock).toHaveBeenCalledWith(chemicals[0].productId);
    await waitFor(() => {
      expect(queryByText(chemicals[0].name)).toBeNull();
    });
  });
});
