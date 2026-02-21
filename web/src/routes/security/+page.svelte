<script lang="ts">
  import { goto } from '$app/navigation';
  import { api } from '$lib/api';
  import Container from '$lib/components/layout/Container.svelte';
  import Card from '$lib/components/ui/Card.svelte';

  export let data;

  let currentPassword = '';
  let newPassword = '';
  let confirmPassword = '';
  let saving = false;
  let message: { type: 'success' | 'error'; text: string } | null = null;

  async function updatePassword() {
    message = null;

    if (newPassword.length < 8) {
      message = { type: 'error', text: 'Password must be at least 8 characters long.' };
      return;
    }
    if (newPassword !== confirmPassword) {
      message = { type: 'error', text: 'New password and confirmation do not match.' };
      return;
    }

    saving = true;
    try {
      const res = await api.me.updatePassword({ currentPassword, newPassword });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        message = {
          type: 'error',
          text: body.message ?? body.error ?? `Unable to update password (${res.status}).`,
        };
        return;
      }

      message = { type: 'success', text: 'Password updated. Please sign in again.' };
      currentPassword = '';
      newPassword = '';
      confirmPassword = '';
      setTimeout(() => {
        goto('/auth/login');
      }, 700);
    } catch (error) {
      message = { type: 'error', text: 'Unable to update password.' };
    } finally {
      saving = false;
    }
  }
</script>

<Container>
  <section class="mx-auto w-full max-w-3xl space-y-6 py-6">
    <header>
      <h1 class="text-2xl font-semibold text-content-primary">Security</h1>
      <p class="text-sm text-content-secondary">Manage password and account protection settings.</p>
    </header>

    <Card>
      <h2 class="text-lg font-semibold text-content-primary">Password</h2>
      <p class="mt-1 text-sm text-content-secondary">Use at least 8 characters and choose a new password you have not used before.</p>
      <div class="mt-4 form-grid">
        <label class="form-field sm:col-span-2">
          <span class="form-label">Current password</span>
          <input class="form-control" type="password" bind:value={currentPassword} />
        </label>
        <label class="form-field">
          <span class="form-label">New password</span>
          <input class="form-control" type="password" bind:value={newPassword} />
        </label>
        <label class="form-field">
          <span class="form-label">Confirm new password</span>
          <input class="form-control" type="password" bind:value={confirmPassword} />
        </label>
      </div>
      {#if message}
        <p class={`mt-4 text-sm ${message.type === 'success' ? 'text-success' : 'text-danger'}`}>
          {message.text}
        </p>
      {/if}
      <div class="mt-4">
        <button class="btn btn-primary" on:click={updatePassword} disabled={saving}>
          {saving ? 'Updating...' : 'Update password'}
        </button>
      </div>
    </Card>

    <Card>
      <h2 class="text-lg font-semibold text-content-primary">Two-factor authentication (2FA)</h2>
      <p class="mt-1 text-sm text-content-secondary">
        Coming soon. TOTP app-based verification is planned first.
      </p>
    </Card>

    <Card>
      <h2 class="text-lg font-semibold text-content-primary">Single sign-on (SSO)</h2>
      <p class="mt-1 text-sm text-content-secondary">
        Coming soon. OIDC provider integrations will be added in a later phase.
      </p>
      <p class="mt-3 text-xs text-content-secondary">Current account: {data.session?.user?.email}</p>
    </Card>
  </section>
</Container>
