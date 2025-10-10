import { fireEvent, render } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import Page from './+page.svelte';
import { api } from '$lib/api';

vi.mock('$lib/api', () => {
  const create = vi.fn();
  return {
    api: {
      chemicals: {
        create,
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
  const session = {
    user: {
      id: 'admin-user',
      email: 'admin@example.com',
      role: 'admin',
    },
  };

  const createMock = api.chemicals.create as unknown as Mock;

  beforeEach(() => {
    createMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows validation errors when required fields are missing', async () => {
    const { getByRole, findByRole } = render(Page, {
      props: { data: { categories, loadError: null, session } },
    });

    const submit = getByRole('button', { name: /create chemical/i });
    await fireEvent.click(submit);

    const alert = await findByRole('alert');
    expect(alert.textContent).toContain('Category is required.');
    expect(alert.textContent).toContain('Name is required.');
    expect(createMock).not.toHaveBeenCalled();
  });

  it('submits the form and resets fields on success', async () => {
    createMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 201, headers: { 'Content-Type': 'application/json' } })
    );

    const { getByLabelText, getByRole, findByRole } = render(Page, {
      props: { data: { categories, loadError: null, session } },
    });

    const categorySelect = getByLabelText('Category') as HTMLSelectElement;
    const nameInput = getByLabelText('Name') as HTMLInputElement;
    const doseInput = getByLabelText('Dose per 10k gallons') as HTMLInputElement;
    const costInput = getByLabelText('Average cost per unit') as HTMLInputElement;

    await fireEvent.change(categorySelect, { target: { value: categories[0].categoryId } });
    await fireEvent.input(nameInput, { target: { value: 'Test Chlorine' } });
    await fireEvent.input(doseInput, { target: { value: '12.5' } });
    await fireEvent.input(costInput, { target: { value: '4.5' } });

    const submit = getByRole('button', { name: /create chemical/i });
    await fireEvent.click(submit);

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        categoryId: categories[0].categoryId,
        name: 'Test Chlorine',
        dosePer10kGallons: 12.5,
        averageCostPerUnit: 4.5,
        affectsFc: false,
        affectsPh: false,
        affectsTa: false,
        affectsCya: false,
        isActive: true,
      })
    );

    const status = await findByRole('status');
    expect(status.textContent).toContain('Chemical created successfully.');
    expect(nameInput.value).toBe('');
    expect(categorySelect.value).toBe(categories[0].categoryId);
  });

  it('displays an error when the API rejects the request', async () => {
    createMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Validation failed' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { getByLabelText, getByRole, findByRole } = render(Page, {
      props: { data: { categories, loadError: null, session } },
    });

    const categorySelect = getByLabelText('Category') as HTMLSelectElement;
    const nameInput = getByLabelText('Name') as HTMLInputElement;

    await fireEvent.change(categorySelect, { target: { value: categories[1].categoryId } });
    await fireEvent.input(nameInput, { target: { value: 'Scale Inhibitor' } });

    const submit = getByRole('button', { name: /create chemical/i });
    await fireEvent.click(submit);

    expect(createMock).toHaveBeenCalled();
    const alert = await findByRole('alert');
    expect(alert.textContent).toContain('Validation failed');
  });
});
