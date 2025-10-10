import { redirect } from '@sveltejs/kit';
import { api } from '$lib/api';
import type { PageLoad } from './$types';

type ChemicalCategory = {
  categoryId: string;
  name: string;
  description?: string | null;
  isActive?: boolean | null;
};

type LoadOutput = {
  categories: ChemicalCategory[];
  loadError: string | null;
};

export const load: PageLoad<LoadOutput> = async ({ fetch, parent }) => {
  const { session } = await parent();
  if (!session || session.user?.role !== 'admin') {
    throw redirect(302, '/');
  }

  try {
    const response = await api.chemicals.listCategories(fetch);
    if (!response.ok) {
      return {
        categories: [],
        loadError: `Failed to load categories (${response.status})`,
      } satisfies LoadOutput;
    }

    const categories = (await response.json()) as ChemicalCategory[];
    return {
      categories,
      loadError: null,
    } satisfies LoadOutput;
  } catch (error) {
    console.error('Failed to load chemical categories', error);
    return {
      categories: [],
      loadError: 'Unable to load chemical categories. Please try again later.',
    } satisfies LoadOutput;
  }
};
