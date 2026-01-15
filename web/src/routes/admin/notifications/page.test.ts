import { fireEvent, render, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import Page from './+page.svelte';
import { api } from '$lib/api';

vi.mock('$lib/api', () => {
  const list = vi.fn();
  const create = vi.fn();
  const update = vi.fn();
  const preview = vi.fn();
  return {
    api: {
      notificationTemplates: {
        list,
        create,
        update,
      },
      notifications: {
        preview,
      },
    },
  };
});

describe('admin notifications page', () => {
  const templates = [
    {
      templateId: '0cbe0c37-9e7a-4aab-bc7a-bc631f4b7f6d',
      name: 'Pool update',
      channel: 'email',
      subject: 'Weekly update',
      bodyTemplate: 'Hello {{user.name}}',
      isActive: true,
      createdAt: '2024-02-01T00:00:00.000Z',
    },
  ];

  const createMock = api.notificationTemplates.create as unknown as Mock;
  const updateMock = api.notificationTemplates.update as unknown as Mock;
  const previewMock = api.notifications.preview as unknown as Mock;

  beforeEach(() => {
    createMock.mockReset();
    updateMock.mockReset();
    previewMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows validation errors when required fields are missing', async () => {
    const { getByRole, findByRole } = render(Page, {
      props: { data: { session: null, templates, loadError: null } },
    });

    const submit = getByRole('button', { name: /create template/i });
    await fireEvent.click(submit);

    const alert = await findByRole('alert');
    expect(alert.textContent).toContain('Name is required.');
    expect(alert.textContent).toContain('Body template is required.');
    expect(createMock).not.toHaveBeenCalled();
  });

  it('creates a template and adds it to the list', async () => {
    const created = {
      templateId: '55b0c44f-22e4-4c3f-8b8a-3dfd6d2a9f65',
      name: 'Reminder',
      channel: 'email',
      subject: 'Heads up',
      bodyTemplate: 'Reminder body',
      isActive: true,
      createdAt: '2024-02-10T00:00:00.000Z',
    };

    createMock.mockResolvedValueOnce(
      new Response(JSON.stringify(created), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { getByLabelText, getByRole, findByRole, queryByText } = render(Page, {
      props: { data: { session: null, templates, loadError: null } },
    });

    await fireEvent.input(getByLabelText('Name'), { target: { value: created.name } });
    await fireEvent.input(getByLabelText('Subject'), { target: { value: created.subject } });
    await fireEvent.input(getByLabelText('Body template'), { target: { value: created.bodyTemplate } });

    const submit = getByRole('button', { name: /create template/i });
    await fireEvent.click(submit);

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: created.name,
        subject: created.subject,
        bodyTemplate: created.bodyTemplate,
      })
    );

    const status = await findByRole('status');
    expect(status.textContent).toContain('Template created.');
    await waitFor(() => {
      expect(queryByText(created.name)).toBeTruthy();
    });
  });

  it('renders a preview from the selected template', async () => {
    previewMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ subject: 'Preview', body: 'Hello Alex' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { getByRole, getByText, getByLabelText, findByText } = render(Page, {
      props: { data: { session: null, templates, loadError: null } },
    });

    await fireEvent.change(getByLabelText('Template'), { target: { value: templates[0].templateId } });
    const renderButton = getByRole('button', { name: /render preview/i });
    await fireEvent.click(renderButton);

    expect(previewMock).toHaveBeenCalledWith({
      templateId: templates[0].templateId,
      data: { user: { name: 'Alex' } },
    });
    expect(await findByText('Hello Alex')).toBeTruthy();
    expect(getByText('Preview')).toBeTruthy();
  });
});
