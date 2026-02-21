import { redirect } from '@sveltejs/kit';
import { api } from '$lib/api';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent, fetch }) => {
  const { session } = await parent();
  const role = session?.user?.role;
  if (!session?.user) throw redirect(302, '/auth/login');
  if (role !== 'admin' && role !== 'business') throw redirect(302, '/');

  try {
    const readinessRes = await api.adminReadiness.get(fetch);
    if (readinessRes.ok) {
      const readiness = await readinessRes.json();
      return { role, readiness };
    }
  } catch (error) {
    console.error('Failed to load admin readiness', error);
  }

  return { role, readiness: { modules: [] } };
};
