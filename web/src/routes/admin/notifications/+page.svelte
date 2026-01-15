<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import { api } from '$lib/api';
  import type { PageData } from './$types';
  import type { NotificationTemplate } from './+page';

  export let data: PageData;

  let templates: NotificationTemplate[] = data.templates ?? [];
  let loadError = data.loadError;

  type FormState = {
    name: string;
    channel: 'email' | 'sms' | 'push' | 'in_app';
    subject: string;
    bodyTemplate: string;
    isActive: boolean;
  };

  const defaultForm: FormState = {
    name: '',
    channel: 'email',
    subject: '',
    bodyTemplate: '',
    isActive: true,
  };

  let form: FormState = { ...defaultForm };
  let formMode: 'create' | 'edit' = 'create';
  let editingTemplateId: string | null = null;
  let submitting = false;
  let formErrors: string[] = [];
  let submitMessage: { type: 'success' | 'error'; text: string } | null = null;

  let previewTemplateId = '';
  let previewData = '{\n  "user": { "name": "Alex" }\n}';
  let previewResult: { subject: string | null; body: string } | null = null;
  let previewError: string | null = null;
  let previewLoading = false;

  const resetForm = (options: { keepMessage?: boolean } = {}) => {
    form = { ...defaultForm };
    formErrors = [];
    if (!options.keepMessage) {
      submitMessage = null;
    }
    editingTemplateId = null;
    formMode = 'create';
  };

  const startEdit = (template: NotificationTemplate) => {
    formMode = 'edit';
    editingTemplateId = template.templateId;
    form = {
      name: template.name ?? '',
      channel: (template.channel as FormState['channel']) ?? 'email',
      subject: template.subject ?? '',
      bodyTemplate: template.bodyTemplate ?? '',
      isActive: template.isActive ?? true,
    };
    submitMessage = null;
    formErrors = [];
  };

  const validateForm = () => {
    const errors: string[] = [];
    if (!form.name.trim()) errors.push('Name is required.');
    if (!form.channel) errors.push('Channel is required.');
    if (!form.bodyTemplate.trim()) errors.push('Body template is required.');
    formErrors = errors;
    return errors.length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    submitting = true;
    submitMessage = null;

    const payload = {
      name: form.name.trim(),
      channel: form.channel,
      subject: form.subject.trim() || undefined,
      bodyTemplate: form.bodyTemplate.trim(),
      isActive: form.isActive,
    };

    try {
      const res =
        formMode === 'edit' && editingTemplateId
          ? await api.notificationTemplates.update(editingTemplateId, payload)
          : await api.notificationTemplates.create(payload);

      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        submitMessage = {
          type: 'error',
          text: errorBody.error ?? errorBody.message ?? `Request failed (${res.status}).`,
        };
        return;
      }

      const saved = (await res.json()) as NotificationTemplate;
      if (formMode === 'edit') {
        templates = templates.map((item) =>
          item.templateId === saved.templateId ? saved : item
        );
        submitMessage = { type: 'success', text: 'Template updated.' };
      } else {
        templates = [saved, ...templates];
        submitMessage = { type: 'success', text: 'Template created.' };
        resetForm({ keepMessage: true });
      }
    } catch (error) {
      submitMessage = { type: 'error', text: 'Unable to save template.' };
    } finally {
      submitting = false;
    }
  };

  const handlePreview = async () => {
    if (!previewTemplateId) {
      previewError = 'Select a template to preview.';
      return;
    }
    previewLoading = true;
    previewError = null;
    previewResult = null;
    let parsedData: Record<string, unknown> = {};
    try {
      parsedData = previewData.trim() ? JSON.parse(previewData) : {};
    } catch {
      previewError = 'Preview data must be valid JSON.';
      previewLoading = false;
      return;
    }

    try {
      const res = await api.notifications.preview({
        templateId: previewTemplateId,
        data: parsedData,
      });
      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        previewError = errorBody.error ?? errorBody.message ?? `Preview failed (${res.status}).`;
        return;
      }
      previewResult = await res.json();
    } catch (error) {
      previewError = 'Unable to render preview.';
    } finally {
      previewLoading = false;
    }
  };
</script>

<section class="space-y-6">
  <header>
    <h1 class="text-2xl font-semibold text-content-primary">Notification templates</h1>
    <p class="mt-1 text-sm text-content-secondary">
      Manage templates and preview messages before sending.
    </p>
  </header>

  {#if loadError}
    <Card status="warning">
      <p class="text-sm">{loadError}</p>
    </Card>
  {/if}

  <div class="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
    <Card>
      <h2 class="text-lg font-semibold text-content-primary">
        {formMode === 'edit' ? 'Edit template' : 'Create template'}
      </h2>
      <div class="mt-4 grid gap-4">
        <label class="text-sm font-medium text-content-secondary">
          Name
          <input class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" bind:value={form.name} />
        </label>
        <label class="text-sm font-medium text-content-secondary">
          Channel
          <select class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" bind:value={form.channel}>
            <option value="email">Email</option>
            <option value="sms">SMS</option>
            <option value="push">Push</option>
            <option value="in_app">In-app</option>
          </select>
        </label>
        <label class="text-sm font-medium text-content-secondary">
          Subject
          <input class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" bind:value={form.subject} />
        </label>
        <label class="text-sm font-medium text-content-secondary">
          Body template
          <textarea
            class="mt-1 min-h-[140px] w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            bind:value={form.bodyTemplate}
          ></textarea>
        </label>
        <label class="inline-flex items-center gap-2 text-sm text-content-secondary">
          <input type="checkbox" class="rounded border-border" bind:checked={form.isActive} />
          Active template
        </label>
      </div>

      {#if formErrors.length > 0}
        <div class="mt-3 text-sm text-danger" role="alert">
          {formErrors.join(' ')}
        </div>
      {/if}

      {#if submitMessage}
        <p
          class={`mt-3 text-sm ${submitMessage.type === 'success' ? 'text-success' : 'text-danger'}`}
          role={submitMessage.type === 'success' ? 'status' : 'alert'}
        >
          {submitMessage.text}
        </p>
      {/if}

      <div class="mt-4 flex flex-wrap gap-2">
        <button class="btn btn-primary" on:click={handleSubmit} disabled={submitting}>
          {formMode === 'edit' ? 'Save changes' : 'Create template'}
        </button>
        {#if formMode === 'edit'}
          <button class="btn btn-secondary" on:click={() => resetForm()}>Cancel</button>
        {/if}
      </div>
    </Card>

    <Card>
      <h2 class="text-lg font-semibold text-content-primary">Preview</h2>
      <div class="mt-4 space-y-3">
        <label class="text-sm font-medium text-content-secondary">
          Template
          <select class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" bind:value={previewTemplateId}>
            <option value="">Select a template</option>
            {#each templates as template}
              <option value={template.templateId}>{template.name}</option>
            {/each}
          </select>
        </label>
        <label class="text-sm font-medium text-content-secondary">
          Preview data (JSON)
          <textarea
            class="mt-1 min-h-[140px] w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm font-mono"
            bind:value={previewData}
          ></textarea>
        </label>
      </div>
      <div class="mt-4">
        <button class="btn btn-tonal" on:click={handlePreview} disabled={previewLoading}>
          {previewLoading ? 'Rendering...' : 'Render preview'}
        </button>
      </div>

      {#if previewError}
        <p class="mt-3 text-sm text-danger" role="alert">{previewError}</p>
      {/if}

      {#if previewResult}
        <div class="mt-4 rounded-xl border border-border/60 bg-surface-subtle p-4">
          <p class="text-xs uppercase tracking-wide text-content-secondary">Subject</p>
          <p class="mt-1 text-sm text-content-primary">{previewResult.subject ?? '—'}</p>
          <p class="mt-3 text-xs uppercase tracking-wide text-content-secondary">Body</p>
          <p class="mt-1 whitespace-pre-wrap text-sm text-content-primary">{previewResult.body}</p>
        </div>
      {/if}
    </Card>
  </div>

  <Card>
    <h2 class="text-lg font-semibold text-content-primary">Templates</h2>
    <div class="mt-4 space-y-3">
      {#if templates.length === 0}
        <p class="text-sm text-content-secondary">No templates yet.</p>
      {:else}
        {#each templates as template}
          <div class="surface-panel flex items-center justify-between gap-4">
            <div>
              <div class="font-medium text-content-primary">{template.name}</div>
              <div class="text-xs text-content-secondary/80">
                {template.channel} · {template.isActive ? 'Active' : 'Inactive'}
              </div>
            </div>
            <div class="flex gap-2">
              <button class="btn btn-sm btn-tonal" on:click={() => startEdit(template)}>
                Edit
              </button>
              <button
                class="btn btn-sm btn-secondary"
                on:click={() => {
                  previewTemplateId = template.templateId;
                }}
              >
                Preview
              </button>
            </div>
          </div>
        {/each}
      {/if}
    </div>
  </Card>
</section>
