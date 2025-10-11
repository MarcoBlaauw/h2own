import { redirect } from '@sveltejs/kit';
import { api } from '$lib/api';
import type { PageLoad } from './$types';

type ChemicalCategory = {
  categoryId: string;
  name: string;
  description?: string | null;
  isActive?: boolean | null;
};

export type Chemical = {
  productId: string;
  categoryId: string;
  name: string;
  brand?: string | null;
  productType?: string | null;
  activeIngredients?: Record<string, number> | null;
  concentrationPercent?: string | number | null;
  phEffect?: string | number | null;
  strengthFactor?: string | number | null;
  dosePer10kGallons?: string | number | null;
  doseUnit?: string | null;
  affectsFc?: boolean | null;
  affectsPh?: boolean | null;
  affectsTa?: boolean | null;
  affectsCya?: boolean | null;
  fcChangePerDose?: string | number | null;
  phChangePerDose?: string | number | null;
  taChangePerDose?: number | null;
  cyaChangePerDose?: number | null;
  form?: string | null;
  packageSizes?: string[] | null;
  isActive?: boolean | null;
  averageCostPerUnit?: string | number | null;
};

type LoadOutput = {
  categories: ChemicalCategory[];
  chemicals: Chemical[];
  loadError: string | null;
};

export const load: PageLoad<LoadOutput> = async ({ fetch, parent }) => {
  const { session } = await parent();
  if (!session || session.user?.role !== 'admin') {
    throw redirect(302, '/');
  }

  try {
    const [categoriesResponse, chemicalsResponse] = await Promise.all([
      api.chemicals.listCategories(fetch),
      api.chemicals.list(fetch),
    ]);

    let loadError: string | null = null;

    if (!categoriesResponse.ok || !chemicalsResponse.ok) {
      loadError = `Failed to load chemicals (${categoriesResponse.status}/${chemicalsResponse.status})`;
    }

    const categories = categoriesResponse.ok
      ? ((await categoriesResponse.json()) as ChemicalCategory[])
      : [];
    const chemicals = chemicalsResponse.ok
      ? ((await chemicalsResponse.json()) as Chemical[])
      : [];

    if (loadError) {
      return {
        categories,
        chemicals,
        loadError,
      } satisfies LoadOutput;
    }

    return {
      categories,
      chemicals,
      loadError: null,
    } satisfies LoadOutput;
  } catch (error) {
    console.error('Failed to load chemical catalog', error);
    return {
      categories: [],
      chemicals: [],
      loadError: 'Unable to load chemical catalog. Please try again later.',
    } satisfies LoadOutput;
  }
};
