<script lang="ts">
  import { api } from '$lib/api';
  import Card from '$lib/components/ui/Card.svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import type { PageData } from './$types';
  import type { Chemical } from './+page';

  export let data: PageData;

  const categories = data.categories ?? [];
  let chemicals: Chemical[] = data.chemicals ?? [];
  let loadError = data.loadError;

  const categoryLookup = new Map(categories.map((category) => [category.categoryId, category.name]));

  type FormState = {
    categoryId: string;
    name: string;
    brand: string;
    productType: string;
    activeIngredients: string;
    concentrationPercent: string;
    phEffect: string;
    strengthFactor: string;
    dosePer10kGallons: string;
    doseUnit: string;
    affectsFc: boolean;
    affectsPh: boolean;
    affectsTa: boolean;
    affectsCya: boolean;
    fcChangePerDose: string;
    phChangePerDose: string;
    taChangePerDose: string;
    cyaChangePerDose: string;
    formType: string;
    packageSizes: string;
    isActive: boolean;
    averageCostPerUnit: string;
  };

  const defaultFormState: FormState = {
    categoryId: '',
    name: '',
    brand: '',
    productType: '',
    activeIngredients: '',
    concentrationPercent: '',
    phEffect: '',
    strengthFactor: '',
    dosePer10kGallons: '',
    doseUnit: '',
    affectsFc: false,
    affectsPh: false,
    affectsTa: false,
    affectsCya: false,
    fcChangePerDose: '',
    phChangePerDose: '',
    taChangePerDose: '',
    cyaChangePerDose: '',
    formType: '',
    packageSizes: '',
    isActive: true,
    averageCostPerUnit: '',
  };

  let form: FormState = { ...defaultFormState };
  let formMode: 'create' | 'edit' = 'create';
  let editingChemicalId: string | null = null;
  let submitting = false;
  let successMessage = '';
  let formErrors: string[] = [];

  let tableMessage: { type: 'success' | 'error'; text: string } | null = null;
  let toggleBusyIds = new SvelteSet<string>();
  let deleteBusyIds = new SvelteSet<string>();

  const numericFieldLabels: Record<string, string> = {
    concentrationPercent: 'Concentration (%)',
    phEffect: 'pH effect',
    strengthFactor: 'Strength factor',
    dosePer10kGallons: 'Dose per 10k gallons',
    fcChangePerDose: 'FC change per dose',
    phChangePerDose: 'pH change per dose',
    averageCostPerUnit: 'Average cost per unit',
  };

  function toFormValue(value: string | number | null | undefined) {
    if (value === null || value === undefined) return '';
    return typeof value === 'number' ? value.toString() : value;
  }

  function toBoolean(value: boolean | null | undefined, fallback = false) {
    if (value === null || value === undefined) return fallback;
    return value;
  }

  function parseActiveIngredients(input: string) {
    if (!input.trim()) return undefined;
    const entries = input
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const result: Record<string, number> = {};
    for (const entry of entries) {
      const [key, value] = entry.split(':').map((part) => part.trim());
      if (!key || value === undefined) {
        throw new Error('Active ingredients must use the format "ingredient: percentage".');
      }
      const parsed = Number(value);
      if (Number.isNaN(parsed)) {
        throw new Error(`Invalid percentage for ${key}.`);
      }
      result[key] = parsed;
    }

    return Object.keys(result).length > 0 ? result : undefined;
  }

  function parsePackageSizes(input: string) {
    if (!input.trim()) return undefined;
    return input
      .split(/\r?\n|,/)
      .map((value) => value.trim())
      .filter(Boolean);
  }

  function chemicalToFormState(chemical: Chemical): FormState {
    const activeIngredients = chemical.activeIngredients ?? undefined;
    const packageSizes = chemical.packageSizes ?? undefined;

    return {
      categoryId: chemical.categoryId ?? '',
      name: chemical.name ?? '',
      brand: chemical.brand ?? '',
      productType: chemical.productType ?? '',
      activeIngredients: activeIngredients
        ? Object.entries(activeIngredients)
            .map(([ingredient, amount]) => `${ingredient}: ${amount}`)
            .join('\n')
        : '',
      concentrationPercent: toFormValue(chemical.concentrationPercent),
      phEffect: toFormValue(chemical.phEffect),
      strengthFactor: toFormValue(chemical.strengthFactor),
      dosePer10kGallons: toFormValue(chemical.dosePer10kGallons),
      doseUnit: chemical.doseUnit ?? '',
      affectsFc: toBoolean(chemical.affectsFc),
      affectsPh: toBoolean(chemical.affectsPh),
      affectsTa: toBoolean(chemical.affectsTa),
      affectsCya: toBoolean(chemical.affectsCya),
      fcChangePerDose: toFormValue(chemical.fcChangePerDose),
      phChangePerDose: toFormValue(chemical.phChangePerDose),
      taChangePerDose: toFormValue(chemical.taChangePerDose),
      cyaChangePerDose: toFormValue(chemical.cyaChangePerDose),
      formType: chemical.form ?? '',
      packageSizes: packageSizes ? packageSizes.join('\n') : '',
      isActive: toBoolean(chemical.isActive, true),
      averageCostPerUnit: toFormValue(chemical.averageCostPerUnit),
    };
  }

  function resetForm() {
    form = { ...defaultFormState, categoryId: form.categoryId };
    formErrors = [];
  }

  function startCreateMode() {
    formMode = 'create';
    editingChemicalId = null;
    successMessage = '';
    resetForm();
  }

  function beginEdit(chemical: Chemical) {
    formMode = 'edit';
    editingChemicalId = chemical.productId;
    form = chemicalToFormState(chemical);
    successMessage = '';
    formErrors = [];
  }

  function setToggleBusy(id: string, busy: boolean) {
    if (busy) {
      toggleBusyIds.add(id);
    } else {
      toggleBusyIds.delete(id);
    }
  }

  function setDeleteBusy(id: string, busy: boolean) {
    if (busy) {
      deleteBusyIds.add(id);
    } else {
      deleteBusyIds.delete(id);
    }
  }

  function replaceChemical(updated: Chemical) {
    chemicals = chemicals.map((chemical) =>
      chemical.productId === updated.productId ? { ...chemical, ...updated } : chemical
    );
    if (editingChemicalId === updated.productId) {
      form = chemicalToFormState(updated);
    }
  }

  function addChemical(chemical: Chemical) {
    chemicals = [chemical, ...chemicals];
  }

  function removeChemical(productId: string) {
    chemicals = chemicals.filter((chemical) => chemical.productId !== productId);
  }

  function extractErrorsFromResponse(response: Response, fallbackMessage: string) {
    return response
      .json()
      .then((body) => {
        if (body?.message) {
          return [body.message];
        }
        if (Array.isArray(body?.details) && body.details.length > 0) {
          return body.details.map((detail: any) => detail.message ?? detail);
        }
        return [fallbackMessage];
      })
      .catch(() => [fallbackMessage]);
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    formErrors = [];
    successMessage = '';
    tableMessage = null;
    loadError = null;

    if (!form.categoryId) {
      formErrors = [...formErrors, 'Category is required.'];
    }

    if (!form.name.trim()) {
      formErrors = [...formErrors, 'Name is required.'];
    }

    const payload: Record<string, unknown> = {
      categoryId: form.categoryId,
      name: form.name.trim(),
      brand: form.brand.trim() || undefined,
      productType: form.productType.trim() || undefined,
      doseUnit: form.doseUnit.trim() || undefined,
      affectsFc: form.affectsFc,
      affectsPh: form.affectsPh,
      affectsTa: form.affectsTa,
      affectsCya: form.affectsCya,
      form: form.formType.trim() || undefined,
      isActive: form.isActive,
    };

    for (const [field, label] of Object.entries(numericFieldLabels)) {
      const rawValue = (form as Record<string, string | boolean>)[field];
      if (typeof rawValue === 'string' && rawValue.trim()) {
        const parsed = Number(rawValue);
        if (Number.isNaN(parsed)) {
          formErrors = [...formErrors, `${label} must be a valid number.`];
        } else {
          payload[field] = parsed;
        }
      }
    }

    if (form.taChangePerDose.trim()) {
      const parsed = Number(form.taChangePerDose);
      if (!Number.isInteger(parsed)) {
        formErrors = [...formErrors, 'TA change per dose must be an integer.'];
      } else {
        payload.taChangePerDose = parsed;
      }
    }

    if (form.cyaChangePerDose.trim()) {
      const parsed = Number(form.cyaChangePerDose);
      if (!Number.isInteger(parsed)) {
        formErrors = [...formErrors, 'CYA change per dose must be an integer.'];
      } else {
        payload.cyaChangePerDose = parsed;
      }
    }

    try {
      const activeIngredients = parseActiveIngredients(form.activeIngredients);
      if (activeIngredients) {
        payload.activeIngredients = activeIngredients;
      }
    } catch (error) {
      formErrors = [
        ...formErrors,
        error instanceof Error ? error.message : 'Invalid active ingredient format.',
      ];
    }

    const packageSizes = parsePackageSizes(form.packageSizes);
    if (packageSizes) {
      payload.packageSizes = packageSizes;
    }

    if (formErrors.length > 0) {
      return;
    }

    submitting = true;
    try {
      let response: Response;
      if (formMode === 'create') {
        response = await api.chemicals.create(payload);
      } else if (editingChemicalId) {
        response = await api.chemicals.update(editingChemicalId, payload);
      } else {
        throw new Error('No chemical selected for editing.');
      }

      if (!response.ok) {
        const fallback =
          formMode === 'create'
            ? `Failed to create chemical (${response.status})`
            : `Failed to update chemical (${response.status})`;
        formErrors = await extractErrorsFromResponse(response, fallback);
        return;
      }

      const chemical = (await response.json()) as Chemical;

      if (formMode === 'create') {
        addChemical(chemical);
        successMessage = 'Chemical created successfully.';
        resetForm();
      } else {
        replaceChemical(chemical);
        successMessage = 'Chemical updated successfully.';
        startCreateMode();
      }
    } catch (error) {
      formErrors = [
        formMode === 'create'
          ? 'An unexpected error occurred while creating the chemical.'
          : 'An unexpected error occurred while updating the chemical.',
      ];
      console.error(error);
    } finally {
      submitting = false;
    }
  }

  async function handleToggle(chemical: Chemical) {
    tableMessage = null;
    setToggleBusy(chemical.productId, true);
    try {
      const response = await api.chemicals.update(chemical.productId, {
        isActive: !toBoolean(chemical.isActive, true),
      });
      if (!response.ok) {
        const errors = await extractErrorsFromResponse(
          response,
          `Failed to update ${chemical.name} (${response.status})`
        );
        tableMessage = { type: 'error', text: errors.join('\n') };
        return;
      }

      const updated = (await response.json()) as Chemical;
      replaceChemical(updated);
      tableMessage = {
        type: 'success',
        text: `${updated.name} is now ${updated.isActive ? 'active' : 'inactive'}.`,
      };
    } catch (error) {
      console.error(error);
      tableMessage = {
        type: 'error',
        text: `An unexpected error occurred while updating ${chemical.name}.`,
      };
    } finally {
      setToggleBusy(chemical.productId, false);
    }
  }

  async function handleDelete(chemical: Chemical) {
    tableMessage = null;
    if (typeof window !== 'undefined' && !window.confirm(`Delete ${chemical.name}?`)) {
      return;
    }

    setDeleteBusy(chemical.productId, true);
    try {
      const response = await api.chemicals.del(chemical.productId);
      if (!response.ok) {
        const errors = await extractErrorsFromResponse(
          response,
          `Failed to delete ${chemical.name} (${response.status})`
        );
        tableMessage = { type: 'error', text: errors.join('\n') };
        return;
      }

      removeChemical(chemical.productId);
      if (editingChemicalId === chemical.productId) {
        startCreateMode();
      }
      successMessage = '';
      tableMessage = { type: 'success', text: `${chemical.name} was deleted.` };
    } catch (error) {
      console.error(error);
      tableMessage = {
        type: 'error',
        text: `An unexpected error occurred while deleting ${chemical.name}.`,
      };
    } finally {
      setDeleteBusy(chemical.productId, false);
    }
  }
</script>

<svelte:head>
  <title>Admin · Chemicals</title>
</svelte:head>

<section class="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
  <div class="space-y-2">
    <h1 class="text-2xl font-semibold text-content-primary">Chemical catalog</h1>
    <p class="text-sm text-content-secondary">
      Define the chemicals available for recommendations and dosing calculations.
    </p>
    {#if loadError}
      <p class="rounded-lg bg-danger/10 px-3 py-2 text-sm font-medium text-danger" role="alert">
        {loadError}
      </p>
    {/if}
  </div>

  <Card className="shadow-card">
    <div class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-xl font-semibold text-content-primary">Catalog</h2>
        {#if formMode === 'edit'}
          <button class="btn btn-sm btn-outline" type="button" on:click={startCreateMode}>
            Cancel editing
          </button>
        {/if}
      </div>
      {#if tableMessage}
        <p
          class={`rounded-lg px-3 py-2 text-sm font-medium ${
            tableMessage.type === 'success'
              ? 'bg-success/10 text-success'
              : 'bg-danger/10 text-danger'
          }`}
          role={tableMessage.type === 'success' ? 'status' : 'alert'}
        >
          {tableMessage.text}
        </p>
      {/if}
      <div class="overflow-x-auto">
        <table class="min-w-full text-left text-sm text-content-secondary">
          <thead class="border-b border-border/60 text-xs font-semibold uppercase tracking-wide text-content-secondary/80 dark:border-border-strong/60">
            <tr>
              <th class="px-3 py-2">Name</th>
              <th class="px-3 py-2">Category</th>
              <th class="px-3 py-2">Brand</th>
              <th class="px-3 py-2">Type</th>
              <th class="px-3 py-2">Status</th>
              <th class="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border/40">
            {#if chemicals.length > 0}
              {#each chemicals as chemical}
                <tr class={editingChemicalId === chemical.productId ? 'bg-surface/40' : ''}>
                  <td class="px-3 py-3 text-content-primary">{chemical.name}</td>
                  <td class="px-3 py-3">{categoryLookup.get(chemical.categoryId) ?? 'Unknown'}</td>
                  <td class="px-3 py-3">{chemical.brand ?? '—'}</td>
                  <td class="px-3 py-3">{chemical.productType ?? '—'}</td>
                  <td class="px-3 py-3">
                    <span
                      class={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${
                        chemical.isActive ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
                      }`}
                    >
                      <span class={`h-2 w-2 rounded-full ${chemical.isActive ? 'bg-success' : 'bg-warning'}`}></span>
                      {chemical.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td class="px-3 py-3 text-right">
                    <div class="flex items-center justify-end gap-2">
                      <button class="btn btn-xs btn-outline" type="button" on:click={() => beginEdit(chemical)}>
                        Edit
                      </button>
                      <button
                        class="btn btn-xs btn-outline"
                        type="button"
                        disabled={toggleBusyIds.has(chemical.productId)}
                        on:click={() => handleToggle(chemical)}
                      >
                        {toggleBusyIds.has(chemical.productId)
                          ? 'Saving…'
                          : chemical.isActive
                            ? 'Deactivate'
                            : 'Activate'}
                      </button>
                      <button
                        class="btn btn-xs btn-outline-danger"
                        type="button"
                        disabled={deleteBusyIds.has(chemical.productId)}
                        on:click={() => handleDelete(chemical)}
                      >
                        {deleteBusyIds.has(chemical.productId) ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              {/each}
            {:else}
              <tr>
                <td colspan="6" class="px-3 py-6 text-center text-content-secondary/80">No chemicals found.</td>
              </tr>
            {/if}
          </tbody>
        </table>
      </div>
    </div>
  </Card>

  <Card className="shadow-card" status={formErrors.length ? 'danger' : successMessage ? 'success' : 'default'}>
    <form class="space-y-6" novalidate on:submit|preventDefault={handleSubmit}>
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 class="text-xl font-semibold text-content-primary">
          {formMode === 'create' ? 'Add chemical' : 'Edit chemical'}
        </h2>
        {#if formMode === 'edit'}
          <span class="text-sm text-content-secondary">Editing existing record</span>
        {/if}
      </div>
      <div class="form-grid md:grid-cols-2 md:gap-6">
        <div class="form-field">
          <label for="category" class="form-label">Category</label>
          <select
            id="category"
            name="category"
            bind:value={form.categoryId}
            class="form-control form-select"
            required
          >
            <option value="" disabled>Select a category</option>
            {#each categories as category}
              <option value={category.categoryId}>{category.name}</option>
            {/each}
          </select>
        </div>

        <div class="form-field">
          <label for="name" class="form-label">Name</label>
          <input
            id="name"
            name="name"
            class="form-control"
            type="text"
            placeholder="Liquid Chlorine 12.5%"
            bind:value={form.name}
            required
          />
        </div>

        <div class="form-field">
          <label for="brand" class="form-label">Brand</label>
          <input id="brand" name="brand" class="form-control" type="text" bind:value={form.brand} />
        </div>

        <div class="form-field">
          <label for="productType" class="form-label">Product type</label>
          <input
            id="productType"
            name="productType"
            class="form-control"
            type="text"
            bind:value={form.productType}
          />
        </div>

        <div class="form-field md:col-span-2">
          <label for="activeIngredients" class="form-label">
            Active ingredients
          </label>
          <textarea
            id="activeIngredients"
            name="activeIngredients"
            class="form-control form-textarea"
            rows="3"
            placeholder="sodium_hypochlorite: 12.5"
            bind:value={form.activeIngredients}
          ></textarea>
          <p class="form-helper">One per line using "ingredient: percentage".</p>
        </div>

        <div class="form-field">
          <label for="concentrationPercent" class="form-label">Concentration (%)</label>
          <input
            id="concentrationPercent"
            name="concentrationPercent"
            class="form-control"
            type="text"
            bind:value={form.concentrationPercent}
          />
        </div>

        <div class="form-field">
          <label for="phEffect" class="form-label">pH effect</label>
          <input id="phEffect" name="phEffect" class="form-control" type="text" bind:value={form.phEffect} />
        </div>

        <div class="form-field">
          <label for="strengthFactor" class="form-label">Strength factor</label>
          <input
            id="strengthFactor"
            name="strengthFactor"
            class="form-control"
            type="text"
            bind:value={form.strengthFactor}
          />
        </div>

        <div class="form-field">
          <label for="dosePer10kGallons" class="form-label">Dose per 10k gallons</label>
          <input
            id="dosePer10kGallons"
            name="dosePer10kGallons"
            class="form-control"
            type="text"
            bind:value={form.dosePer10kGallons}
          />
        </div>

        <div class="form-field">
          <label for="doseUnit" class="form-label">Dose unit</label>
          <input id="doseUnit" name="doseUnit" class="form-control" type="text" bind:value={form.doseUnit} />
        </div>

        <div class="form-field">
          <label for="averageCostPerUnit" class="form-label">
            Average cost per unit
          </label>
          <input
            id="averageCostPerUnit"
            name="averageCostPerUnit"
            class="form-control"
            type="text"
            bind:value={form.averageCostPerUnit}
          />
        </div>

        <div class="form-field">
          <label for="fcChangePerDose" class="form-label">FC change per dose</label>
          <input
            id="fcChangePerDose"
            name="fcChangePerDose"
            class="form-control"
            type="text"
            bind:value={form.fcChangePerDose}
          />
        </div>

        <div class="form-field">
          <label for="phChangePerDose" class="form-label">pH change per dose</label>
          <input
            id="phChangePerDose"
            name="phChangePerDose"
            class="form-control"
            type="text"
            bind:value={form.phChangePerDose}
          />
        </div>

        <div class="form-field">
          <label for="taChangePerDose" class="form-label">TA change per dose</label>
          <input
            id="taChangePerDose"
            name="taChangePerDose"
            class="form-control"
            type="text"
            bind:value={form.taChangePerDose}
          />
        </div>

        <div class="form-field">
          <label for="cyaChangePerDose" class="form-label">CYA change per dose</label>
          <input
            id="cyaChangePerDose"
            name="cyaChangePerDose"
            class="form-control"
            type="text"
            bind:value={form.cyaChangePerDose}
          />
        </div>

        <div class="form-field">
          <label for="formType" class="form-label">Form</label>
          <input id="formType" name="formType" class="form-control" type="text" bind:value={form.formType} />
        </div>

        <div class="form-field md:col-span-2">
          <label for="packageSizes" class="form-label">Package sizes</label>
          <textarea
            id="packageSizes"
            name="packageSizes"
            class="form-control form-textarea"
            rows="3"
            placeholder="1 gal&#10;2.5 gal"
            bind:value={form.packageSizes}
          ></textarea>
          <p class="form-helper">Separate values with commas or new lines.</p>
        </div>
      </div>

      <fieldset class="form-fieldset">
        <legend class="form-legend">Impacts</legend>
        <label class="form-option">
          <input type="checkbox" bind:checked={form.affectsFc} />
          Affects FC
        </label>
        <label class="form-option">
          <input type="checkbox" bind:checked={form.affectsPh} />
          Affects pH
        </label>
        <label class="form-option">
          <input type="checkbox" bind:checked={form.affectsTa} />
          Affects TA
        </label>
        <label class="form-option">
          <input type="checkbox" bind:checked={form.affectsCya} />
          Affects CYA
        </label>
        <label class="form-option">
          <input type="checkbox" bind:checked={form.isActive} />
          Active
        </label>
      </fieldset>

      {#if formErrors.length > 0}
        <div class="form-feedback" data-state="error" role="alert">
          {#each formErrors as error}
            <p>{error}</p>
          {/each}
        </div>
      {/if}

      {#if successMessage}
        <p class="form-feedback" data-state="success" role="status">
          {successMessage}
        </p>
      {/if}

      <div class="flex flex-wrap items-center gap-3">
        <button class="btn btn-base btn-primary" type="submit" disabled={submitting}>
          {#if submitting}
            Saving…
          {:else if formMode === 'create'}
            Create chemical
          {:else}
            Save changes
          {/if}
        </button>
        {#if formMode === 'edit'}
          <button class="btn btn-base btn-outline" type="button" on:click={startCreateMode}>
            Cancel
          </button>
        {/if}
      </div>
    </form>
  </Card>
</section>
