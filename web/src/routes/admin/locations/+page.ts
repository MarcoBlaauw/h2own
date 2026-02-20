import { redirect } from '@sveltejs/kit';
import { api } from '$lib/api';
import type { PageLoad } from './$types';

export type AdminLocation = {
  locationId: string;
  userId: string;
  name: string;
  formattedAddress: string | null;
  googlePlaceId: string | null;
  googlePlusCode: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  isPrimary: boolean;
  isActive: boolean;
  createdAt: string;
  user: {
    userId: string;
    email: string | null;
    name: string | null;
  } | null;
  pools: Array<{ poolId: string; name: string }>;
};

export type AdminLocationUser = {
  userId: string;
  email: string;
  name: string | null;
  isActive: boolean | null;
};

type LoadOutput = {
  locations: AdminLocation[];
  users: AdminLocationUser[];
  loadError: string | null;
};

export const load: PageLoad<LoadOutput> = async ({ fetch, parent }) => {
  const { session } = await parent();
  if (!session || session.user?.role !== 'admin') {
    throw redirect(302, '/');
  }

  try {
    const [locationsRes, usersRes] = await Promise.all([
      api.locations.list(fetch),
      api.users.list(fetch),
    ]);

    let loadError: string | null = null;

    let locations: AdminLocation[] = [];
    if (locationsRes.ok) {
      locations = (await locationsRes.json()) as AdminLocation[];
    } else {
      loadError = `Failed to load locations (${locationsRes.status})`;
    }

    let users: AdminLocationUser[] = [];
    if (usersRes.ok) {
      const payload = (await usersRes.json()) as AdminLocationUser[];
      users = payload.map((user) => ({
        userId: user.userId,
        email: user.email,
        name: user.name ?? null,
        isActive: user.isActive ?? null,
      }));
    } else {
      const errorMessage = `Failed to load users (${usersRes.status})`;
      loadError = loadError ? `${loadError}. ${errorMessage}` : errorMessage;
    }

    return {
      locations,
      users,
      loadError,
    } satisfies LoadOutput;
  } catch (error) {
    console.error('Failed to load admin locations', error);
    return {
      locations: [],
      users: [],
      loadError: 'Unable to load locations. Please try again later.',
    } satisfies LoadOutput;
  }
};
