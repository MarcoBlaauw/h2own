<script lang="ts">
  import { goto } from '$app/navigation';
  import { api } from '$lib/api';
  import Container from '$lib/components/layout/Container.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import { onMount } from 'svelte';

  export let data;

  let currentPassword = '';
  let newPassword = '';
  let confirmPassword = '';
  let saving = false;
  let message: { type: 'success' | 'error'; text: string } | null = null;
  let totpLoading = true;
  let totpEnabled = false;
  let totpPending = false;
  let totpCurrentPassword = '';
  let totpCode = '';
  let totpDisablePassword = '';
  let totpDisableCode = '';
  let totpSetupSecret = '';
  let totpSetupQr = '';
  let totpMessage: { type: 'success' | 'error'; text: string } | null = null;

  onMount(async () => {
    await refreshTotpStatus();
  });

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

  async function refreshTotpStatus() {
    totpLoading = true;
    try {
      const res = await api.me.totpStatus();
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return;
      totpEnabled = Boolean(body?.enabled);
      totpPending = Boolean(body?.pending);
    } finally {
      totpLoading = false;
    }
  }

  async function startTotpSetup() {
    totpMessage = null;
    if (!totpCurrentPassword) {
      totpMessage = { type: 'error', text: 'Current password is required.' };
      return;
    }

    const res = await api.me.initiateTotpSetup({ currentPassword: totpCurrentPassword });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      totpMessage = { type: 'error', text: body.message ?? body.error ?? 'Unable to start 2FA setup.' };
      return;
    }

    totpSetupSecret = body.secret ?? '';
    totpSetupQr = body.qrCodeDataUrl ?? '';
    totpPending = true;
    totpMessage = { type: 'success', text: 'Scan the QR code, then enter your authenticator code to enable 2FA.' };
  }

  async function enableTotp() {
    totpMessage = null;
    if (!totpCode.trim()) {
      totpMessage = { type: 'error', text: 'Enter the 6-digit code from your authenticator app.' };
      return;
    }

    const res = await api.me.enableTotp({ code: totpCode.trim() });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      totpMessage = { type: 'error', text: body.message ?? body.error ?? 'Unable to enable 2FA.' };
      return;
    }

    totpEnabled = true;
    totpPending = false;
    totpSetupSecret = '';
    totpSetupQr = '';
    totpCurrentPassword = '';
    totpCode = '';
    totpMessage = { type: 'success', text: 'Two-factor authentication is enabled.' };
  }

  async function disableTotp() {
    totpMessage = null;
    if (!totpDisablePassword || !totpDisableCode.trim()) {
      totpMessage = { type: 'error', text: 'Password and authenticator code are required to disable 2FA.' };
      return;
    }

    const res = await api.me.disableTotp({
      currentPassword: totpDisablePassword,
      code: totpDisableCode.trim(),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      totpMessage = { type: 'error', text: body.message ?? body.error ?? 'Unable to disable 2FA.' };
      return;
    }

    totpEnabled = false;
    totpPending = false;
    totpDisablePassword = '';
    totpDisableCode = '';
    totpMessage = { type: 'success', text: 'Two-factor authentication is disabled.' };
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
      {#if totpLoading}
        <p class="mt-1 text-sm text-content-secondary">Loading 2FA status...</p>
      {:else if totpEnabled}
        <p class="mt-1 text-sm text-content-secondary">2FA is currently enabled for this account.</p>
        <div class="mt-4 form-grid">
          <label class="form-field">
            <span class="form-label">Current password</span>
            <input class="form-control" type="password" bind:value={totpDisablePassword} />
          </label>
          <label class="form-field">
            <span class="form-label">Authenticator code</span>
            <input class="form-control" type="text" inputmode="numeric" placeholder="123456" bind:value={totpDisableCode} />
          </label>
        </div>
        <div class="mt-4">
          <button class="btn btn-secondary" on:click={disableTotp}>Disable 2FA</button>
        </div>
      {:else}
        <p class="mt-1 text-sm text-content-secondary">Protect your account with a time-based authenticator app code.</p>
        <div class="mt-4 form-grid">
          <label class="form-field sm:col-span-2">
            <span class="form-label">Current password</span>
            <input class="form-control" type="password" bind:value={totpCurrentPassword} />
          </label>
        </div>
        <div class="mt-4">
          <button class="btn btn-primary" on:click={startTotpSetup}>Start 2FA setup</button>
        </div>
        {#if totpPending}
          <div class="mt-4 space-y-3">
            {#if totpSetupQr}
              <img src={totpSetupQr} alt="Scan this QR code with your authenticator app" class="h-44 w-44 rounded border border-border bg-white p-2" />
            {/if}
            {#if totpSetupSecret}
              <p class="text-xs text-content-secondary">Manual code: <span class="font-mono text-content-primary">{totpSetupSecret}</span></p>
            {/if}
            <label class="form-field">
              <span class="form-label">Authenticator code</span>
              <input class="form-control" type="text" inputmode="numeric" placeholder="123456" bind:value={totpCode} />
            </label>
            <button class="btn btn-primary" on:click={enableTotp}>Enable 2FA</button>
          </div>
        {/if}
      {/if}
      {#if totpMessage}
        <p class={`mt-4 text-sm ${totpMessage.type === 'success' ? 'text-success' : 'text-danger'}`}>
          {totpMessage.text}
        </p>
      {/if}
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
