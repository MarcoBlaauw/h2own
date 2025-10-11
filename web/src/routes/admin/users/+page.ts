import { redirect } from '@sveltejs/kit';
import { api } from '$lib/api';
import type { PageLoad } from './$types';

export type AdminUser = {
  userId: string;
  email: string;
  name: string | null;
  role: string;
  isActive: boolean | null;
  createdAt: string;
  updatedAt: string;
};

export type UserFilters = {
  search?: string;
  role?: string;
  isActive?: 'active' | 'inactive' | 'all';
};

type LoadOutput = {
  users: AdminUser[];
  filters: UserFilters;
  loadError: string | null;
};

function parseStatus(value: string | null): 'active' | 'inactive' | 'all' {
  if (value === 'active' || value === 'inactive') {
    return value;
  }
  return 'all';
}

export const load: PageLoad<LoadOutput> = async ({ fetch, parent, url }) => {
  const { session } = await parent();
  if (!session || session.user?.role !== 'admin') {
    throw redirect(302, '/');
  }

  const search = url.searchParams.get('search') ?? undefined;
  const role = url.searchParams.get('role') ?? undefined;
  const status = parseStatus(url.searchParams.get('status'));

  try {
    const response = await api.users.list(fetch, {
      search,
      role,
      isActive: status === 'all' ? undefined : status === 'active',
    });

    if (!response.ok) {
      return {
        users: [],
        filters: { search, role, isActive: status },
        loadError: `Failed to load users (${response.status})`,
      } satisfies LoadOutput;
    }

    const users = (await response.json()) as AdminUser[];
    return {
      users,
      filters: { search, role, isActive: status },
      loadError: null,
    } satisfies LoadOutput;
  } catch (error) {
    console.error('Failed to load admin users', error);
    return {
      users: [],
      filters: { search, role, isActive: status },
      loadError: 'Unable to load users. Please try again later.',
    } satisfies LoadOutput;
  }
};
