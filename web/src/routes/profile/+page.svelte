<script lang="ts">
  import Container from '$lib/components/layout/Container.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import GoogleAddressAutocomplete from '$lib/components/location/GoogleAddressAutocomplete.svelte';
  import { api } from '$lib/api';

  export let data;

  type Supervisor = {
    userId: string;
    email: string;
    name: string | null;
  };

  type Profile = {
    email: string;
    firstName: string | null;
    lastName: string | null;
    nickname: string | null;
    address: string;
    supervisors: Supervisor[];
  };

  const initialProfile: Profile = {
    email: data?.profile?.email ?? data?.session?.user?.email ?? '',
    firstName: data?.profile?.firstName ?? data?.session?.user?.firstName ?? null,
    lastName: data?.profile?.lastName ?? data?.session?.user?.lastName ?? null,
    nickname: data?.profile?.nickname ?? data?.session?.user?.nickname ?? null,
    address: data?.profile?.address ?? data?.session?.user?.address ?? '',
    supervisors:
      data?.profile?.supervisors ??
      data?.session?.user?.supervisors ??
      [],
  };

  let profile = { ...initialProfile };
  let initialEmail = initialProfile.email;
  let currentPasswordForEmailChange = '';
  let saving = false;
  let message: { type: 'success' | 'error'; text: string } | null = null;

  const toNullable = (value: string) => {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  };

  async function saveProfile() {
    saving = true;
    message = null;

    try {
      const res = await api.me.updateProfile({
        firstName: toNullable(profile.firstName ?? ''),
        lastName: toNullable(profile.lastName ?? ''),
        nickname: toNullable(profile.nickname ?? ''),
        address: toNullable(profile.address),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        message = {
          type: 'error',
          text: body.message ?? body.error ?? `Unable to save profile (${res.status}).`,
        };
        return;
      }

      const updated = (await res.json()) as Profile;
      profile = {
        ...profile,
        ...updated,
        address: updated.address ?? '',
      };

      const trimmedEmail = profile.email.trim().toLowerCase();
      const initialTrimmedEmail = initialEmail.trim().toLowerCase();
      if (trimmedEmail && trimmedEmail !== initialTrimmedEmail) {
        if (!currentPasswordForEmailChange.trim()) {
          message = {
            type: 'error',
            text: 'Enter your current password to request an email change.',
          };
          return;
        }

        const emailRes = await api.me.requestEmailChange({
          email: profile.email.trim(),
          currentPassword: currentPasswordForEmailChange,
        });
        if (!emailRes.ok) {
          const body = await emailRes.json().catch(() => ({}));
          message = {
            type: 'error',
            text: body.message ?? body.error ?? `Unable to request email verification (${emailRes.status}).`,
          };
          return;
        }

        initialEmail = profile.email.trim();
        currentPasswordForEmailChange = '';
        message = {
          type: 'success',
          text: 'Profile saved. Verification email sent to your new email address.',
        };
      } else {
        message = { type: 'success', text: 'Profile saved.' };
      }
    } catch (error) {
      message = { type: 'error', text: 'Unable to save profile.' };
    } finally {
      saving = false;
    }
  }
</script>

<Container>
  <section class="mx-auto w-full max-w-3xl space-y-6 py-6">
    <header>
      <h1 class="text-2xl font-semibold text-content-primary">Profile</h1>
      <p class="text-sm text-content-secondary">Manage your account identity and contact information.</p>
    </header>

    <Card>
      <div class="form-grid">
        <label class="form-field">
          <span class="form-label">First name</span>
          <input class="form-control" bind:value={profile.firstName} />
        </label>
        <label class="form-field">
          <span class="form-label">Last name</span>
          <input class="form-control" bind:value={profile.lastName} />
        </label>
        <label class="form-field">
          <span class="form-label">Nickname</span>
          <input class="form-control" bind:value={profile.nickname} />
        </label>
        <label class="form-field">
          <span class="form-label">Email address</span>
          <input class="form-control" type="email" bind:value={profile.email} />
        </label>
        {#if profile.email.trim().toLowerCase() !== initialEmail.trim().toLowerCase()}
          <label class="form-field sm:col-span-2">
            <span class="form-label">Current password (required for email change)</span>
            <input class="form-control" type="password" bind:value={currentPasswordForEmailChange} />
          </label>
        {/if}
        <label class="form-field sm:col-span-2">
          <GoogleAddressAutocomplete bind:address={profile.address} idPrefix="profile-address" />
        </label>
      </div>

      {#if profile.supervisors.length > 0}
        <div class="mt-4">
          <p class="form-label">Supervisor account(s)</p>
          <ul class="mt-2 space-y-2">
            {#each profile.supervisors as supervisor}
              <li class="surface-panel p-3 text-sm text-content-primary">
                {supervisor.name ?? supervisor.email}
                <span class="text-content-secondary">({supervisor.email})</span>
              </li>
            {/each}
          </ul>
        </div>
      {/if}

      {#if message}
        <p class={`mt-4 text-sm ${message.type === 'success' ? 'text-success' : 'text-danger'}`}>
          {message.text}
        </p>
      {/if}

      <div class="mt-4">
        <button class="btn btn-primary" on:click={saveProfile} disabled={saving}>
          {saving ? 'Saving...' : 'Save profile'}
        </button>
      </div>
    </Card>
  </section>
</Container>
