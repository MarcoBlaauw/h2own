<script lang="ts">
  import type { PageData } from './$types';
  import { api } from '$lib/api';

  export let data: PageData;

  const categories = data.categories ?? [];
  let loadError = data.loadError;

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
  let submitting = false;
  let successMessage = '';
  let formErrors: string[] = [];

  const numericFieldLabels: Record<string, string> = {
    concentrationPercent: 'Concentration (%)',
    phEffect: 'pH effect',
    strengthFactor: 'Strength factor',
    dosePer10kGallons: 'Dose per 10k gallons',
    fcChangePerDose: 'FC change per dose',
    phChangePerDose: 'pH change per dose',
    averageCostPerUnit: 'Average cost per unit',
  };

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

  function resetForm() {
    form = { ...defaultFormState, categoryId: form.categoryId };
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    formErrors = [];
    successMessage = '';
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
      formErrors = [...formErrors, error instanceof Error ? error.message : 'Invalid active ingredient format.'];
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
      const response = await api.chemicals.create(payload);
      if (!response.ok) {
        let message = `Failed to create chemical (${response.status})`;
        try {
          const body = await response.json();
          if (body?.message) {
            message = body.message;
          } else if (Array.isArray(body?.details) && body.details.length > 0) {
            message = body.details.map((detail: any) => detail.message ?? detail).join('\n');
          }
        } catch (err) {
          // ignore JSON parse errors and use default message
        }
        formErrors = [message];
        return;
      }

      successMessage = 'Chemical created successfully.';
      resetForm();
    } catch (error) {
      formErrors = ['An unexpected error occurred while creating the chemical.'];
    } finally {
      submitting = false;
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

  <form
    class="space-y-6 rounded-2xl border border-border bg-surface-raised p-6 shadow-card dark:border-border-strong dark:bg-surface-inset"
    novalidate
    on:submit|preventDefault={handleSubmit}
  >
    <div class="grid gap-6 md:grid-cols-2">
      <div class="flex flex-col gap-2">
        <label for="category" class="text-sm font-medium text-content-secondary">Category</label>
        <select
          id="category"
          name="category"
          bind:value={form.categoryId}
          class="select"
          required
        >
          <option value="" disabled>Select a category</option>
          {#each categories as category}
            <option value={category.categoryId}>{category.name}</option>
          {/each}
        </select>
      </div>

      <div class="flex flex-col gap-2">
        <label for="name" class="text-sm font-medium text-content-secondary">Name</label>
        <input
          id="name"
          name="name"
          class="input"
          type="text"
          placeholder="Liquid Chlorine 12.5%"
          bind:value={form.name}
          required
        />
      </div>

      <div class="flex flex-col gap-2">
        <label for="brand" class="text-sm font-medium text-content-secondary">Brand</label>
        <input id="brand" name="brand" class="input" type="text" bind:value={form.brand} />
      </div>

      <div class="flex flex-col gap-2">
        <label for="productType" class="text-sm font-medium text-content-secondary">Product type</label>
        <input id="productType" name="productType" class="input" type="text" bind:value={form.productType} />
      </div>

      <div class="flex flex-col gap-2 md:col-span-2">
        <label for="activeIngredients" class="text-sm font-medium text-content-secondary">
          Active ingredients
        </label>
        <textarea
          id="activeIngredients"
          name="activeIngredients"
          class="textarea"
          rows="3"
          placeholder="sodium_hypochlorite: 12.5"
          bind:value={form.activeIngredients}
        ></textarea>
        <p class="text-xs text-content-secondary/80">One per line using "ingredient: percentage".</p>
      </div>

      <div class="flex flex-col gap-2">
        <label for="concentrationPercent" class="text-sm font-medium text-content-secondary">Concentration (%)</label>
        <input
          id="concentrationPercent"
          name="concentrationPercent"
          class="input"
          type="text"
          bind:value={form.concentrationPercent}
        />
      </div>

      <div class="flex flex-col gap-2">
        <label for="phEffect" class="text-sm font-medium text-content-secondary">pH effect</label>
        <input id="phEffect" name="phEffect" class="input" type="text" bind:value={form.phEffect} />
      </div>

      <div class="flex flex-col gap-2">
        <label for="strengthFactor" class="text-sm font-medium text-content-secondary">Strength factor</label>
        <input id="strengthFactor" name="strengthFactor" class="input" type="text" bind:value={form.strengthFactor} />
      </div>

      <div class="flex flex-col gap-2">
        <label for="dosePer10kGallons" class="text-sm font-medium text-content-secondary">Dose per 10k gallons</label>
        <input
          id="dosePer10kGallons"
          name="dosePer10kGallons"
          class="input"
          type="text"
          bind:value={form.dosePer10kGallons}
        />
      </div>

      <div class="flex flex-col gap-2">
        <label for="doseUnit" class="text-sm font-medium text-content-secondary">Dose unit</label>
        <input id="doseUnit" name="doseUnit" class="input" type="text" bind:value={form.doseUnit} />
      </div>

      <div class="flex flex-col gap-2">
        <label for="averageCostPerUnit" class="text-sm font-medium text-content-secondary">
          Average cost per unit
        </label>
        <input
          id="averageCostPerUnit"
          name="averageCostPerUnit"
          class="input"
          type="text"
          bind:value={form.averageCostPerUnit}
        />
      </div>

      <div class="flex flex-col gap-2">
        <label for="fcChangePerDose" class="text-sm font-medium text-content-secondary">FC change per dose</label>
        <input
          id="fcChangePerDose"
          name="fcChangePerDose"
          class="input"
          type="text"
          bind:value={form.fcChangePerDose}
        />
      </div>

      <div class="flex flex-col gap-2">
        <label for="phChangePerDose" class="text-sm font-medium text-content-secondary">pH change per dose</label>
        <input
          id="phChangePerDose"
          name="phChangePerDose"
          class="input"
          type="text"
          bind:value={form.phChangePerDose}
        />
      </div>

      <div class="flex flex-col gap-2">
        <label for="taChangePerDose" class="text-sm font-medium text-content-secondary">TA change per dose</label>
        <input
          id="taChangePerDose"
          name="taChangePerDose"
          class="input"
          type="text"
          bind:value={form.taChangePerDose}
        />
      </div>

      <div class="flex flex-col gap-2">
        <label for="cyaChangePerDose" class="text-sm font-medium text-content-secondary">CYA change per dose</label>
        <input
          id="cyaChangePerDose"
          name="cyaChangePerDose"
          class="input"
          type="text"
          bind:value={form.cyaChangePerDose}
        />
      </div>

      <div class="flex flex-col gap-2">
        <label for="formType" class="text-sm font-medium text-content-secondary">Form</label>
        <input id="formType" name="formType" class="input" type="text" bind:value={form.formType} />
      </div>

      <div class="flex flex-col gap-2 md:col-span-2">
        <label for="packageSizes" class="text-sm font-medium text-content-secondary">Package sizes</label>
        <textarea
          id="packageSizes"
          name="packageSizes"
          class="textarea"
          rows="3"
          placeholder="1 gal\n2.5 gal"
          bind:value={form.packageSizes}
        ></textarea>
        <p class="text-xs text-content-secondary/80">Separate values with commas or new lines.</p>
      </div>
    </div>

    <fieldset class="grid gap-4 rounded-xl bg-surface-subtle p-4 dark:bg-surface-inset/80 sm:grid-cols-2">
      <legend class="text-sm font-semibold text-content-secondary">Impacts</legend>
      <label class="flex items-center gap-3 text-sm text-content-secondary">
        <input type="checkbox" bind:checked={form.affectsFc} />
        Affects FC
      </label>
      <label class="flex items-center gap-3 text-sm text-content-secondary">
        <input type="checkbox" bind:checked={form.affectsPh} />
        Affects pH
      </label>
      <label class="flex items-center gap-3 text-sm text-content-secondary">
        <input type="checkbox" bind:checked={form.affectsTa} />
        Affects TA
      </label>
      <label class="flex items-center gap-3 text-sm text-content-secondary">
        <input type="checkbox" bind:checked={form.affectsCya} />
        Affects CYA
      </label>
      <label class="flex items-center gap-3 text-sm text-content-secondary">
        <input type="checkbox" bind:checked={form.isActive} />
        Active
      </label>
    </fieldset>

    {#if formErrors.length > 0}
      <div class="rounded-lg bg-danger/10 px-3 py-2 text-sm font-medium text-danger" role="alert">
        {#each formErrors as error}
          <p>{error}</p>
        {/each}
      </div>
    {/if}

    {#if successMessage}
      <p class="rounded-lg bg-success/10 px-3 py-2 text-sm font-medium text-success" role="status">
        {successMessage}
      </p>
    {/if}

    <button
      class="btn btn-base btn-primary"
      type="submit"
      disabled={submitting}
    >
      {#if submitting}
        Saving…
      {:else}
        Create chemical
      {/if}
    </button>
  </form>
</section>
