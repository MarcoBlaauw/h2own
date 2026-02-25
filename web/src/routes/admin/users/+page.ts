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
  roleCapabilityPreview: Record<string, string[]>;
  loadError: string | null;
};

const fallbackCapabilityPreview: Record<string, string[]> = {
  admin: ['Users read/manage', 'Audit log read', 'API tokens manage', 'Admin pools manage', 'Billing manage', 'Messages send'],
  business: ['Admin pools manage', 'Billing manage', 'Messages send'],
  member: ['Messages send', 'Billing read'],
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
    const [usersResponse, rolesResponse] = await Promise.all([
      api.users.list(fetch, {
        search,
        role,
        isActive: status === 'all' ? undefined : status === 'active',
      }),
      api.roleCapabilities.list(fetch),
    ]);

    if (!usersResponse.ok) {
      return {
        users: [],
        filters: { search, role, isActive: status },
        roleCapabilityPreview: fallbackCapabilityPreview,
        loadError: `Failed to load users (${usersResponse.status})`,
      } satisfies LoadOutput;
    }

    const users = (await usersResponse.json()) as AdminUser[];
    let roleCapabilityPreview = fallbackCapabilityPreview;
    if (rolesResponse.ok) {
      const payload = (await rolesResponse.json()) as {
        roles?: Array<{ role: string; systemCapabilities: string[]; accountCapabilities: string[] }>;
      };
      roleCapabilityPreview = Object.fromEntries(
        (payload.roles ?? []).map((template) => [
          template.role,
          [...template.systemCapabilities, ...template.accountCapabilities],
        ])
      );
    }

    return {
      users,
      filters: { search, role, isActive: status },
      roleCapabilityPreview,
      loadError: null,
    } satisfies LoadOutput;
  } catch (error) {
    console.error('Failed to load admin users', error);
    return {
      users: [],
      filters: { search, role, isActive: status },
      roleCapabilityPreview: fallbackCapabilityPreview,
      loadError: 'Unable to load users. Please try again later.',
    } satisfies LoadOutput;
  }
};
