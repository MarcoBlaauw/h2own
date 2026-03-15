<script lang="ts">
  import { api } from '$lib/api';
  import Card from '$lib/components/ui/Card.svelte';
  import {
    CHEMICAL_FORMS,
    CHEMICAL_FORM_LABELS,
    PRODUCT_TYPES_BY_CATEGORY,
    CATALOG_PRODUCT_TYPES,
    CATALOG_PRODUCT_TYPE_LABELS,
    PRODUCT_ITEM_CLASSES,
  } from '$lib/constants/chemical-catalog';
  import { SvelteSet } from 'svelte/reactivity';
  import type { PageData } from './$types';
  import type { Chemical } from './+page';

  export let data: PageData;

  const categories = data.categories ?? [];
  let chemicals: Chemical[] = data.chemicals ?? [];
  let vendors = data.vendors ?? [];
  let importHistory = data.importHistory ?? [];
  let syncRuns = data.syncRuns ?? [];
  let loadError = data.loadError;
  let vendorSubmitting = false;
  let vendorSyncingId: string | null = null;
  let vendorMode: 'create' | 'edit' = 'create';
  let editingVendorId: string | null = null;
  let vendorForm = {
    name: '',
    slug: '',
    websiteUrl: '',
    provider: 'manual',
    isActive: true,
  };
  let vendorFormErrors: string[] = [];
  let vendorSuccessMessage = '';
  let importSubmitting = false;
  let importVendorId = '';
  let importFormat: 'csv' | 'json' = 'csv';
  let importPayload = '';
  let importDryRun = true;
  let importMessage: { type: 'success' | 'error'; text: string } | null = null;

  const csvTemplate = [
    'productId,productName,brand,vendorSku,productUrl,unitPrice,currency,packageSize,unitLabel,isPrimary',
    ',Champion Muriatic Acid,Champion,CH516,https://example.com/ch516,10.49,USD,1 gal,jug,true',
  ].join('\n');
  const jsonTemplate = JSON.stringify(
    [
      {
        productName: 'Champion Muriatic Acid',
        brand: 'Champion',
        vendorSku: 'CH516',
        productUrl: 'https://example.com/ch516',
        unitPrice: 10.49,
        currency: 'USD',
        packageSize: '1 gal',
        unitLabel: 'jug',
        isPrimary: true,
      },
    ],
    null,
    2,
  );

  const categoryLookup = new Map(categories.map((category) => [category.categoryId, category.name]));
  const normalizedCategoryLookup = new Map(
    categories.map((category) => [category.categoryId, category.name.trim().toLowerCase()])
  );

  type VendorPriceFormState = {
    vendorId: string;
    unitPrice: string;
    currency: string;
    packageSize: string;
    unitLabel: string;
    vendorSku: string;
    productUrl: string;
    isPrimary: boolean;
  };

  type FormState = {
    categoryId: string;
    itemClass: 'chemical' | 'supply';
    name: string;
    brand: string;
    sku: string;
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
    replacementIntervalDays: string;
    compatibleEquipmentType: string;
    notes: string;
    isActive: boolean;
    averageCostPerUnit: string;
    vendorPrices: VendorPriceFormState[];
  };

  const defaultFormState: FormState = {
    categoryId: '',
    itemClass: 'chemical',
    name: '',
    brand: '',
    sku: '',
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
    replacementIntervalDays: '',
    compatibleEquipmentType: '',
    notes: '',
    isActive: true,
    averageCostPerUnit: '',
    vendorPrices: [],
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
  const productTypeOptions = CATALOG_PRODUCT_TYPES.map((value) => ({
    value,
    label: CATALOG_PRODUCT_TYPE_LABELS[value],
  }));
  const formOptions = CHEMICAL_FORMS.map((value) => ({
    value,
    label: CHEMICAL_FORM_LABELS[value],
  }));

  const numericFieldLabels: Record<string, string> = {
    concentrationPercent: 'Concentration (%)',
    phEffect: 'pH effect',
    strengthFactor: 'Strength factor',
    dosePer10kGallons: 'Dose per 10k gallons',
    fcChangePerDose: 'FC change per dose',
    phChangePerDose: 'pH change per dose',
    replacementIntervalDays: 'Replacement interval days',
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
      itemClass: chemical.itemClass ?? 'chemical',
      name: chemical.name ?? '',
      brand: chemical.brand ?? '',
      sku: chemical.sku ?? '',
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
      replacementIntervalDays: toFormValue(chemical.replacementIntervalDays),
      compatibleEquipmentType: chemical.compatibleEquipmentType ?? '',
      notes: chemical.notes ?? '',
      isActive: toBoolean(chemical.isActive, true),
      averageCostPerUnit: toFormValue(chemical.averageCostPerUnit),
      vendorPrices:
        chemical.vendorPrices?.map((entry) => ({
          vendorId: entry.vendorId,
          unitPrice: toFormValue(entry.unitPrice),
          currency: entry.currency ?? 'USD',
          packageSize: entry.packageSize ?? '',
          unitLabel: entry.unitLabel ?? '',
          vendorSku: entry.vendorSku ?? '',
          productUrl: entry.productUrl ?? '',
          isPrimary: toBoolean(entry.isPrimary),
        })) ?? [],
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

  function productTypeLabel(value: string | null | undefined) {
    if (!value) return '—';
    return CATALOG_PRODUCT_TYPE_LABELS[value as keyof typeof CATALOG_PRODUCT_TYPE_LABELS] ?? value;
  }

  function formatImportTimestamp(value: string | null | undefined) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  }

  function syncStatusLabel(status: string | null | undefined) {
    return status ?? 'unknown';
  }

  function loadImportTemplate(format: 'csv' | 'json') {
    importFormat = format;
    importPayload = format === 'csv' ? csvTemplate : jsonTemplate;
    importMessage = null;
  }

  function downloadImportTemplate(format: 'csv' | 'json') {
    const content = format === 'csv' ? csvTemplate : jsonTemplate;
    const extension = format === 'csv' ? 'csv' : 'json';
    const type = format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8';
    const url = URL.createObjectURL(new Blob([content], { type }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `vendor-price-import-template.${extension}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function addVendorPriceRow() {
    form.vendorPrices = [
      ...form.vendorPrices,
      {
        vendorId: '',
        unitPrice: '',
        currency: 'USD',
        packageSize: '',
        unitLabel: '',
        vendorSku: '',
        productUrl: '',
        isPrimary: form.vendorPrices.length === 0,
      },
    ];
  }

  function removeVendorPriceRow(index: number) {
    const next = form.vendorPrices.filter((_, currentIndex) => currentIndex !== index);
    if (next.length > 0 && !next.some((entry) => entry.isPrimary)) {
      next[0]!.isPrimary = true;
    }
    form.vendorPrices = next;
  }

  function setPrimaryVendorPrice(index: number) {
    form.vendorPrices = form.vendorPrices.map((entry, currentIndex) => ({
      ...entry,
      isPrimary: currentIndex === index,
    }));
  }

  function resetVendorForm() {
    vendorForm = {
      name: '',
      slug: '',
      websiteUrl: '',
      provider: 'manual',
      isActive: true,
    };
    vendorFormErrors = [];
  }

  function startCreateVendorMode() {
    vendorMode = 'create';
    editingVendorId = null;
    vendorSuccessMessage = '';
    resetVendorForm();
  }

  function beginVendorEdit(vendor: typeof vendors[number]) {
    vendorMode = 'edit';
    editingVendorId = vendor.vendorId;
    vendorSuccessMessage = '';
    vendorFormErrors = [];
    vendorForm = {
      name: vendor.name ?? '',
      slug: vendor.slug ?? '',
      websiteUrl: vendor.websiteUrl ?? '',
      provider: vendor.provider ?? 'manual',
      isActive: vendor.isActive ?? true,
    };
  }

  async function handleVendorSubmit() {
    vendorSubmitting = true;
    vendorFormErrors = [];
    vendorSuccessMessage = '';

    if (!vendorForm.name.trim()) {
      vendorFormErrors = ['Vendor name is required.'];
      vendorSubmitting = false;
      return;
    }

    const payload = {
      name: vendorForm.name.trim(),
      slug: vendorForm.slug.trim() || undefined,
      websiteUrl: vendorForm.websiteUrl.trim() || undefined,
      provider: vendorForm.provider.trim() || undefined,
      isActive: vendorForm.isActive,
    };

    try {
      const response =
        vendorMode === 'create'
          ? await api.adminVendors.create(payload)
          : await api.adminVendors.update(editingVendorId!, payload);

      if (!response.ok) {
        vendorFormErrors = await extractErrorsFromResponse(
          response,
          vendorMode === 'create'
            ? `Failed to create vendor (${response.status})`
            : `Failed to update vendor (${response.status})`,
        );
        return;
      }

      const vendor = await response.json();
      if (vendorMode === 'create') {
        vendors = [...vendors, vendor].sort((a, b) => a.name.localeCompare(b.name));
        vendorSuccessMessage = 'Vendor created successfully.';
        resetVendorForm();
      } else {
        vendors = vendors
          .map((entry) => (entry.vendorId === vendor.vendorId ? vendor : entry))
          .sort((a, b) => a.name.localeCompare(b.name));
        vendorSuccessMessage = 'Vendor updated successfully.';
        startCreateVendorMode();
      }
    } catch (error) {
      console.error(error);
      vendorFormErrors = ['An unexpected error occurred while saving the vendor.'];
    } finally {
      vendorSubmitting = false;
    }
  }

  async function handleVendorSync(vendorId: string) {
    vendorSyncingId = vendorId;
    vendorFormErrors = [];
    vendorSuccessMessage = '';
    try {
      const response = await api.adminVendors.syncPrices(vendorId);
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        vendorFormErrors = [payload?.message ?? payload?.error ?? 'Unable to sync vendor prices.'];
        return;
      }
      vendorSuccessMessage = payload?.message ?? 'Vendor price sync completed.';
    } catch (error) {
      console.error(error);
      vendorFormErrors = ['An unexpected error occurred while syncing vendor prices.'];
    } finally {
      vendorSyncingId = null;
    }
  }

  async function handleVendorImport() {
    importSubmitting = true;
    importMessage = null;
    if (!importVendorId) {
      importMessage = { type: 'error', text: 'Select a vendor before importing prices.' };
      importSubmitting = false;
      return;
    }
    if (!importPayload.trim()) {
      importMessage = { type: 'error', text: 'Paste CSV or JSON payload before importing.' };
      importSubmitting = false;
      return;
    }

    try {
      const response = await api.adminVendors.importPrices(importVendorId, {
        format: importFormat,
        payload: importPayload,
        dryRun: importDryRun,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        importMessage = {
          type: 'error',
          text: payload?.message ?? payload?.error ?? 'Unable to import vendor prices.',
        };
        return;
      }
      importMessage = { type: 'success', text: payload?.message ?? 'Vendor price import complete.' };
      const selectedVendor = vendors.find((vendor) => vendor.vendorId === importVendorId);
      importHistory = [
        {
          runId: `${importVendorId}-${Date.now()}`,
          vendorId: importVendorId,
          vendorName: selectedVendor?.name ?? 'Unknown vendor',
          vendorSlug: selectedVendor?.slug ?? '',
          actorUserId: null,
          format: importFormat,
          dryRun: importDryRun,
          status: payload?.status ?? (importDryRun ? 'dry_run' : 'completed'),
          importedRows: payload?.importedRows ?? 0,
          createdPrices: payload?.createdPrices ?? 0,
          updatedPrices: payload?.updatedPrices ?? 0,
          skippedRows: payload?.skippedRows ?? 0,
          message: payload?.message ?? null,
          createdAt: new Date().toISOString(),
        },
        ...importHistory,
      ].slice(0, 10);
    } catch (error) {
      console.error(error);
      importMessage = { type: 'error', text: 'An unexpected error occurred while importing prices.' };
    } finally {
      importSubmitting = false;
    }
  }

  function productTypeOptionsForValue(value: string) {
    const categoryName = normalizedCategoryLookup.get(form.categoryId) ?? null;
    const allowedTypes = categoryName
      ? [
          ...PRODUCT_TYPES_BY_CATEGORY[
            categoryName as keyof typeof PRODUCT_TYPES_BY_CATEGORY
          ],
        ]
      : null;

    const scopedOptions = allowedTypes
      ? productTypeOptions.filter((option) =>
          allowedTypes.includes(option.value as (typeof allowedTypes)[number])
        )
      : productTypeOptions;

    if (!value || scopedOptions.some((option) => option.value === value)) {
      return scopedOptions;
    }

    return [
      ...scopedOptions,
      { value, label: `Legacy: ${value}` },
    ];
  }

  function formOptionsForValue(value: string) {
    if (!value || formOptions.some((option) => option.value === value)) {
      return formOptions;
    }

    return [
      ...formOptions,
      { value, label: `Legacy: ${value}` },
    ];
  }

  function extractErrorsFromResponse(response: Response, fallbackMessage: string) {
    return response
      .json()
      .then((body) => {
        if (body?.error === 'DuplicateChemical') {
          return ['A matching chemical already exists in the catalog.'];
        }
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
      itemClass: form.itemClass,
      name: form.name.trim(),
      brand: form.brand.trim() || undefined,
      sku: form.sku.trim() || undefined,
      productType: form.productType.trim() || undefined,
      doseUnit: form.doseUnit.trim() || undefined,
      affectsFc: form.affectsFc,
      affectsPh: form.affectsPh,
      affectsTa: form.affectsTa,
      affectsCya: form.affectsCya,
      form: form.formType.trim() || undefined,
      compatibleEquipmentType: form.compatibleEquipmentType.trim() || undefined,
      notes: form.notes.trim() || undefined,
      isActive: form.isActive,
    };

    for (const [field, label] of Object.entries(numericFieldLabels)) {
      const rawValue = form[field as keyof FormState];
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

    const vendorPrices = form.vendorPrices
      .map((entry) => ({
        vendorId: entry.vendorId,
        unitPrice: entry.unitPrice,
        currency: entry.currency,
        packageSize: entry.packageSize,
        unitLabel: entry.unitLabel,
        vendorSku: entry.vendorSku,
        productUrl: entry.productUrl,
        isPrimary: entry.isPrimary,
      }))
      .filter((entry) => entry.vendorId || entry.unitPrice || entry.packageSize || entry.unitLabel || entry.vendorSku || entry.productUrl);

    if (vendorPrices.length > 0) {
      const normalizedVendorPrices: Array<Record<string, unknown>> = [];
      vendorPrices.forEach((entry, index) => {
        if (!entry.vendorId) {
          formErrors = [...formErrors, `Vendor price ${index + 1} requires a vendor.`];
          return;
        }
        const parsedUnitPrice = Number(entry.unitPrice);
        if (!Number.isFinite(parsedUnitPrice) || parsedUnitPrice <= 0) {
          formErrors = [...formErrors, `Vendor price ${index + 1} requires a positive unit price.`];
          return;
        }
        normalizedVendorPrices.push({
          vendorId: entry.vendorId,
          unitPrice: parsedUnitPrice,
          currency: entry.currency?.trim() || 'USD',
          packageSize: entry.packageSize?.trim() || undefined,
          unitLabel: entry.unitLabel?.trim() || undefined,
          vendorSku: entry.vendorSku?.trim() || undefined,
          productUrl: entry.productUrl?.trim() || undefined,
          isPrimary: entry.isPrimary,
        });
      });

      if (normalizedVendorPrices.length > 0) {
        payload.vendorPrices = normalizedVendorPrices;
      }
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

  <Card className="shadow-card" status={vendorFormErrors.length ? 'danger' : vendorSuccessMessage ? 'success' : 'default'}>
    <div class="space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-xl font-semibold text-content-primary">Vendor registry</h2>
          <p class="text-sm text-content-secondary">
            Manage normalized vendor records used by chemical pricing and future price sync adapters.
          </p>
        </div>
        {#if vendorMode === 'edit'}
          <button class="btn btn-sm btn-outline" type="button" on:click={startCreateVendorMode}>
            Cancel editing
          </button>
        {/if}
      </div>

      <div class="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div class="overflow-x-auto">
          <table class="min-w-full text-left text-sm text-content-secondary">
            <thead class="border-b border-border/60 text-xs font-semibold uppercase tracking-wide text-content-secondary/80 dark:border-border-strong/60">
              <tr>
                <th class="px-3 py-2">Name</th>
                <th class="px-3 py-2">Slug</th>
                <th class="px-3 py-2">Provider</th>
                <th class="px-3 py-2">Status</th>
                <th class="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border/40">
              {#if vendors.length > 0}
                {#each vendors as vendor}
                  <tr>
                    <td class="px-3 py-3 text-content-primary">
                      <div>{vendor.name}</div>
                      <div class="text-xs text-content-secondary/70">{vendor.websiteUrl ?? '—'}</div>
                    </td>
                    <td class="px-3 py-3">{vendor.slug}</td>
                    <td class="px-3 py-3">{vendor.provider ?? '—'}</td>
                    <td class="px-3 py-3">{vendor.isActive ? 'Active' : 'Inactive'}</td>
                    <td class="px-3 py-3 text-right">
                      <div class="flex items-center justify-end gap-2">
                        <button class="btn btn-xs btn-outline" type="button" on:click={() => beginVendorEdit(vendor)}>
                          Edit
                        </button>
                        <button
                          class="btn btn-xs btn-outline"
                          type="button"
                          disabled={vendorSyncingId === vendor.vendorId}
                          on:click={() => handleVendorSync(vendor.vendorId)}
                        >
                          {vendorSyncingId === vendor.vendorId ? 'Syncing…' : 'Sync prices'}
                        </button>
                      </div>
                    </td>
                  </tr>
                {/each}
              {:else}
                <tr>
                  <td colspan="5" class="px-3 py-6 text-center text-content-secondary/80">No vendors found.</td>
                </tr>
              {/if}
            </tbody>
          </table>
        </div>

        <form class="space-y-4" on:submit|preventDefault={handleVendorSubmit}>
          <div class="space-y-1">
            <h3 class="text-lg font-semibold text-content-primary">
              {vendorMode === 'create' ? 'Add vendor' : 'Edit vendor'}
            </h3>
            <p class="text-sm text-content-secondary">
              Keep vendor names and slugs normalized so catalog pricing stays deduplicated.
            </p>
          </div>
          <div class="form-field">
            <label class="form-label" for="vendor-name">Name</label>
            <input id="vendor-name" class="form-control" type="text" bind:value={vendorForm.name} />
          </div>
          <div class="form-field">
            <label class="form-label" for="vendor-slug">Slug</label>
            <input id="vendor-slug" class="form-control" type="text" bind:value={vendorForm.slug} placeholder="auto from name" />
          </div>
          <div class="form-field">
            <label class="form-label" for="vendor-website">Website URL</label>
            <input id="vendor-website" class="form-control" type="url" bind:value={vendorForm.websiteUrl} />
          </div>
          <div class="form-field">
            <label class="form-label" for="vendor-provider">Provider tag</label>
            <input id="vendor-provider" class="form-control" type="text" bind:value={vendorForm.provider} />
          </div>
          <label class="inline-flex items-center gap-2 text-sm text-content-secondary">
            <input type="checkbox" bind:checked={vendorForm.isActive} />
            Active vendor
          </label>
          {#if vendorFormErrors.length > 0}
            <p class="rounded-lg bg-danger/10 px-3 py-2 text-sm font-medium text-danger" role="alert">
              {vendorFormErrors.join(' ')}
            </p>
          {/if}
          {#if vendorSuccessMessage}
            <p class="rounded-lg bg-success/10 px-3 py-2 text-sm font-medium text-success" role="status">
              {vendorSuccessMessage}
            </p>
          {/if}
          <button class="btn btn-base btn-primary" type="submit" disabled={vendorSubmitting}>
            {#if vendorSubmitting}
              Saving...
            {:else if vendorMode === 'create'}
              Create vendor
            {:else}
              Save vendor
            {/if}
          </button>
        </form>
      </div>

      <div class="rounded-2xl border border-border/60 p-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="space-y-1">
            <h3 class="text-lg font-semibold text-content-primary">Price import</h3>
            <p class="text-sm text-content-secondary">
              Paste CSV or JSON rows to import vendor pricing. Supported fields: `productId`, `productName`, `brand`, `vendorSku`, `productUrl`, `unitPrice`, `currency`, `packageSize`, `unitLabel`, `isPrimary`.
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button class="btn btn-sm btn-outline" type="button" on:click={() => loadImportTemplate('csv')}>
              Use CSV sample
            </button>
            <button class="btn btn-sm btn-outline" type="button" on:click={() => downloadImportTemplate('csv')}>
              Download CSV
            </button>
            <button class="btn btn-sm btn-outline" type="button" on:click={() => loadImportTemplate('json')}>
              Use JSON sample
            </button>
            <button class="btn btn-sm btn-outline" type="button" on:click={() => downloadImportTemplate('json')}>
              Download JSON
            </button>
          </div>
        </div>
        <div class="mt-4 grid gap-4 lg:grid-cols-[220px_180px_1fr]">
          <label class="form-field">
            <span class="form-label">Vendor</span>
            <select class="form-control form-select" bind:value={importVendorId}>
              <option value="">Select vendor</option>
              {#each vendors as vendor}
                <option value={vendor.vendorId}>{vendor.name}</option>
              {/each}
            </select>
          </label>
          <label class="form-field">
            <span class="form-label">Format</span>
            <select class="form-control form-select" bind:value={importFormat}>
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
            </select>
          </label>
          <label class="inline-flex items-center gap-2 self-end text-sm text-content-secondary">
            <input type="checkbox" bind:checked={importDryRun} />
            Dry run only
          </label>
        </div>
        <label class="form-field mt-4">
          <span class="form-label">Import payload</span>
          <textarea class="form-control min-h-[180px] font-mono text-sm" bind:value={importPayload} placeholder={`productName,brand,vendorSku,unitPrice,currency,packageSize,unitLabel,isPrimary\nChampion Muriatic Acid,Champion,CH516,10.49,USD,1 gal,jug,true`}></textarea>
        </label>
        {#if importMessage}
          <p
            class={`mt-3 rounded-lg px-3 py-2 text-sm font-medium ${
              importMessage.type === 'success'
                ? 'bg-success/10 text-success'
                : 'bg-danger/10 text-danger'
            }`}
            role={importMessage.type === 'success' ? 'status' : 'alert'}
          >
            {importMessage.text}
          </p>
        {/if}
        <div class="mt-4 flex justify-end">
          <button class="btn btn-base btn-primary" type="button" disabled={importSubmitting} on:click={handleVendorImport}>
            {importSubmitting ? 'Importing…' : importDryRun ? 'Preview import' : 'Import prices'}
          </button>
        </div>

        <div class="mt-6 overflow-x-auto">
          <div class="mb-2 flex items-center justify-between gap-3">
            <h4 class="text-base font-semibold text-content-primary">Recent imports</h4>
            <p class="text-xs text-content-secondary">Latest 10 runs across all vendors.</p>
          </div>
          <table class="min-w-full text-left text-sm text-content-secondary">
            <thead class="border-b border-border/60 text-xs font-semibold uppercase tracking-wide text-content-secondary/80 dark:border-border-strong/60">
              <tr>
                <th class="px-3 py-2">When</th>
                <th class="px-3 py-2">Vendor</th>
                <th class="px-3 py-2">Mode</th>
                <th class="px-3 py-2">Rows</th>
                <th class="px-3 py-2">Created</th>
                <th class="px-3 py-2">Updated</th>
                <th class="px-3 py-2">Skipped</th>
                <th class="px-3 py-2">Message</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border/40">
              {#if importHistory.length > 0}
                {#each importHistory as run}
                  <tr>
                    <td class="px-3 py-3">{formatImportTimestamp(run.createdAt)}</td>
                    <td class="px-3 py-3 text-content-primary">{run.vendorName}</td>
                    <td class="px-3 py-3">{run.dryRun ? 'Dry run' : 'Applied'}</td>
                    <td class="px-3 py-3">{run.importedRows}</td>
                    <td class="px-3 py-3">{run.createdPrices}</td>
                    <td class="px-3 py-3">{run.updatedPrices}</td>
                    <td class="px-3 py-3">{run.skippedRows}</td>
                    <td class="px-3 py-3">{run.message ?? '—'}</td>
                  </tr>
                {/each}
              {:else}
                <tr>
                  <td colspan="8" class="px-3 py-6 text-center text-content-secondary/80">No imports recorded yet.</td>
                </tr>
              {/if}
            </tbody>
          </table>
        </div>

        <div class="mt-6 overflow-x-auto">
          <div class="mb-2 flex items-center justify-between gap-3">
            <h4 class="text-base font-semibold text-content-primary">Recent sync runs</h4>
            <p class="text-xs text-content-secondary">Worker and manual sync attempts.</p>
          </div>
          <table class="min-w-full text-left text-sm text-content-secondary">
            <thead class="border-b border-border/60 text-xs font-semibold uppercase tracking-wide text-content-secondary/80 dark:border-border-strong/60">
              <tr>
                <th class="px-3 py-2">When</th>
                <th class="px-3 py-2">Vendor</th>
                <th class="px-3 py-2">Source</th>
                <th class="px-3 py-2">Status</th>
                <th class="px-3 py-2">Linked</th>
                <th class="px-3 py-2">Updated</th>
                <th class="px-3 py-2">Message</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border/40">
              {#if syncRuns.length > 0}
                {#each syncRuns as run}
                  <tr>
                    <td class="px-3 py-3">{formatImportTimestamp(run.createdAt)}</td>
                    <td class="px-3 py-3 text-content-primary">{run.vendorName}</td>
                    <td class="px-3 py-3">{run.triggerSource}</td>
                    <td class="px-3 py-3">{syncStatusLabel(run.status)}</td>
                    <td class="px-3 py-3">{run.linkedProducts}</td>
                    <td class="px-3 py-3">{run.updatedPrices}</td>
                    <td class="px-3 py-3">{run.message ?? '—'}</td>
                  </tr>
                {/each}
              {:else}
                <tr>
                  <td colspan="7" class="px-3 py-6 text-center text-content-secondary/80">No sync runs recorded yet.</td>
                </tr>
              {/if}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </Card>

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
              <th class="px-3 py-2">Primary vendor</th>
              <th class="px-3 py-2">Price</th>
              <th class="px-3 py-2">Status</th>
              <th class="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border/40">
            {#if chemicals.length > 0}
              {#each chemicals as chemical}
                <tr class={editingChemicalId === chemical.productId ? 'bg-surface/40' : ''}>
                  <td class="px-3 py-3 text-content-primary">
                    <div>{chemical.name}</div>
                    <div class="text-xs text-content-secondary/70">{chemical.itemClass ?? 'chemical'}</div>
                  </td>
                  <td class="px-3 py-3">{categoryLookup.get(chemical.categoryId) ?? 'Unknown'}</td>
                  <td class="px-3 py-3">{chemical.brand ?? '—'}</td>
                  <td class="px-3 py-3">{productTypeLabel(chemical.productType)}</td>
                  <td class="px-3 py-3">{chemical.primaryVendor?.name ?? '—'}</td>
                  <td class="px-3 py-3">
                    {#if chemical.primaryPrice?.unitPrice}
                      {chemical.primaryPrice.unitPrice} {chemical.primaryPrice.currency ?? 'USD'}
                    {:else if chemical.averageCostPerUnit}
                      {chemical.averageCostPerUnit} USD
                    {:else}
                      —
                    {/if}
                  </td>
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
                <td colspan="8" class="px-3 py-6 text-center text-content-secondary/80">No catalog items found.</td>
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
          {formMode === 'create' ? 'Add catalog item' : 'Edit catalog item'}
        </h2>
        {#if formMode === 'edit'}
          <span class="text-sm text-content-secondary">Editing existing record</span>
        {/if}
      </div>
      <div class="form-grid md:grid-cols-2 md:gap-6">
        <div class="form-field">
          <label for="itemClass" class="form-label">Item class</label>
          <select id="itemClass" name="itemClass" bind:value={form.itemClass} class="form-control form-select">
            {#each PRODUCT_ITEM_CLASSES as itemClass}
              <option value={itemClass}>{itemClass}</option>
            {/each}
          </select>
        </div>

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
          <label for="sku" class="form-label">SKU</label>
          <input id="sku" name="sku" class="form-control" type="text" bind:value={form.sku} />
        </div>

        <div class="form-field">
          <label for="productType" class="form-label">Product type</label>
          <select
            id="productType"
            name="productType"
            class="form-control form-select"
            bind:value={form.productType}
          >
            <option value="">Select a product type</option>
            {#each productTypeOptionsForValue(form.productType) as option}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
          <p class="form-helper">Controlled list to keep catalog types normalized.</p>
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
          <label for="replacementIntervalDays" class="form-label">Replacement interval days</label>
          <input
            id="replacementIntervalDays"
            name="replacementIntervalDays"
            class="form-control"
            type="text"
            bind:value={form.replacementIntervalDays}
          />
        </div>

        <div class="form-field">
          <label for="compatibleEquipmentType" class="form-label">Compatible equipment type</label>
          <input
            id="compatibleEquipmentType"
            name="compatibleEquipmentType"
            class="form-control"
            type="text"
            bind:value={form.compatibleEquipmentType}
          />
        </div>

        <div class="form-field md:col-span-2">
          <label for="notes" class="form-label">Notes</label>
          <textarea
            id="notes"
            name="notes"
            class="form-control form-textarea"
            rows="3"
            bind:value={form.notes}
          ></textarea>
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

        <div class="form-field md:col-span-2">
          <div class="flex items-center justify-between gap-3">
            <div>
              <div class="form-label">Vendor pricing</div>
              <p class="form-helper">Attach one or more vendor prices and mark a primary listing.</p>
            </div>
            <button class="btn btn-sm btn-outline" type="button" on:click={addVendorPriceRow}>
              Add vendor price
            </button>
          </div>

          {#if form.vendorPrices.length > 0}
            <div class="mt-3 space-y-3">
              {#each form.vendorPrices as vendorPrice, index}
                <div class="rounded-xl border border-border/60 p-4">
                  <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div class="form-field">
                      <label class="form-label" for={`vendorPrice-vendor-${index}`}>Vendor</label>
                      <select id={`vendorPrice-vendor-${index}`} class="form-control form-select" bind:value={vendorPrice.vendorId}>
                        <option value="">Select vendor</option>
                        {#each vendors as vendorOption}
                          <option value={vendorOption.vendorId}>{vendorOption.name}</option>
                        {/each}
                      </select>
                    </div>
                    <div class="form-field">
                      <label class="form-label" for={`vendorPrice-price-${index}`}>Unit price</label>
                      <input id={`vendorPrice-price-${index}`} class="form-control" type="number" min="0" step="0.01" bind:value={vendorPrice.unitPrice} />
                    </div>
                    <div class="form-field">
                      <label class="form-label" for={`vendorPrice-currency-${index}`}>Currency</label>
                      <input id={`vendorPrice-currency-${index}`} class="form-control" type="text" bind:value={vendorPrice.currency} />
                    </div>
                    <div class="form-field">
                      <label class="form-label" for={`vendorPrice-package-${index}`}>Package size</label>
                      <input id={`vendorPrice-package-${index}`} class="form-control" type="text" bind:value={vendorPrice.packageSize} />
                    </div>
                    <div class="form-field">
                      <label class="form-label" for={`vendorPrice-unitLabel-${index}`}>Unit label</label>
                      <input id={`vendorPrice-unitLabel-${index}`} class="form-control" type="text" bind:value={vendorPrice.unitLabel} />
                    </div>
                    <div class="form-field">
                      <label class="form-label" for={`vendorPrice-sku-${index}`}>Vendor SKU</label>
                      <input id={`vendorPrice-sku-${index}`} class="form-control" type="text" bind:value={vendorPrice.vendorSku} />
                    </div>
                    <div class="form-field md:col-span-2">
                      <label class="form-label" for={`vendorPrice-url-${index}`}>Product URL</label>
                      <input id={`vendorPrice-url-${index}`} class="form-control" type="url" bind:value={vendorPrice.productUrl} />
                    </div>
                  </div>
                  <div class="mt-3 flex items-center justify-between gap-3">
                    <label class="inline-flex items-center gap-2 text-sm text-content-secondary">
                      <input type="radio" name="primaryVendorPrice" checked={vendorPrice.isPrimary} on:change={() => setPrimaryVendorPrice(index)} />
                      Primary price
                    </label>
                    <button class="btn btn-xs btn-outline-danger" type="button" on:click={() => removeVendorPriceRow(index)}>
                      Remove
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
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
          <select
            id="formType"
            name="formType"
            class="form-control form-select"
            bind:value={form.formType}
          >
            <option value="">Select a form</option>
            {#each formOptionsForValue(form.formType) as option}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
          <p class="form-helper">Controlled list to keep chemical forms normalized.</p>
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
