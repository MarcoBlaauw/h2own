<script lang="ts">
  import Container from '$lib/components/layout/Container.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import { api } from '$lib/api';

  export let data;

  type Preferences = {
    theme: 'light' | 'dark' | 'system';
    temperatureUnit: 'F' | 'C';
    measurementSystem: 'imperial' | 'metric';
    currency: string;
    preferredPoolTemp: number | null;
    defaultPoolId: string | null;
    notificationEmailEnabled: boolean;
    notificationSmsEnabled: boolean;
    notificationPushEnabled: boolean;
    notificationEmailAddress: string;
  };

  type PoolSummary = {
    poolId: string;
    name: string;
  };

  const poolOptions: PoolSummary[] = Array.isArray(data?.pools) ? data.pools : [];

  const initialPreferences: Preferences = {
    theme: data?.preferences?.theme ?? 'light',
    temperatureUnit: data?.preferences?.temperatureUnit ?? 'F',
    measurementSystem: data?.preferences?.measurementSystem ?? 'imperial',
    currency: data?.preferences?.currency ?? 'USD',
    preferredPoolTemp: data?.preferences?.preferredPoolTemp ?? null,
    defaultPoolId: data?.preferences?.defaultPoolId ?? null,
    notificationEmailEnabled: data?.preferences?.notificationEmailEnabled ?? true,
    notificationSmsEnabled: data?.preferences?.notificationSmsEnabled ?? false,
    notificationPushEnabled: data?.preferences?.notificationPushEnabled ?? false,
    notificationEmailAddress: data?.preferences?.notificationEmailAddress ?? data?.session?.user?.email ?? '',
  };

  let preferences = { ...initialPreferences };
  let defaultPoolSelection = preferences.defaultPoolId ?? '';
  let saving = false;
  let message: { type: 'success' | 'error'; text: string } | null = null;

  const applyTheme = (theme: Preferences['theme']) => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'light') {
      root.classList.remove('dark');
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', prefersDark);
    }
  };

  async function savePreferences() {
    saving = true;
    message = null;

    try {
      const payload = {
        ...preferences,
        currency: preferences.currency.trim().toUpperCase(),
        preferredPoolTemp:
          preferences.preferredPoolTemp === null || Number.isNaN(Number(preferences.preferredPoolTemp))
            ? null
            : Number(preferences.preferredPoolTemp),
        defaultPoolId: preferences.defaultPoolId ?? null,
        notificationEmailAddress: preferences.notificationEmailAddress.trim() || null,
      };

      const res = await api.me.updatePreferences(payload);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        message = {
          type: 'error',
          text: body.message ?? body.error ?? `Unable to save preferences (${res.status}).`,
        };
        return;
      }

      const updated = (await res.json()) as Preferences;
      preferences = {
        ...updated,
        notificationEmailAddress: updated.notificationEmailAddress ?? data?.session?.user?.email ?? '',
      };
      defaultPoolSelection = preferences.defaultPoolId ?? '';

      localStorage.setItem('theme', preferences.theme);
      applyTheme(preferences.theme);
      message = { type: 'success', text: 'Preferences saved.' };
    } catch (error) {
      message = { type: 'error', text: 'Unable to save preferences.' };
    } finally {
      saving = false;
    }
  }

  $: preferences.defaultPoolId = defaultPoolSelection || null;
</script>

<Container>
  <section class="mx-auto w-full max-w-3xl space-y-6 py-6">
    <header>
      <h1 class="text-2xl font-semibold text-content-primary">Preferences</h1>
      <p class="text-sm text-content-secondary">Configure notifications, units, and display preferences.</p>
    </header>

    <Card>
      <div class="form-grid">
        <label class="form-field">
          <span class="form-label">Theme</span>
          <select class="form-control" bind:value={preferences.theme}>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System</option>
          </select>
        </label>

        <label class="form-field">
          <span class="form-label">Currency</span>
          <input class="form-control uppercase" maxlength="3" bind:value={preferences.currency} />
        </label>

        <label class="form-field">
          <span class="form-label">Temperature unit</span>
          <select class="form-control" bind:value={preferences.temperatureUnit}>
            <option value="F">Fahrenheit (F)</option>
            <option value="C">Celsius (C)</option>
          </select>
        </label>

        <label class="form-field">
          <span class="form-label">Measurement system</span>
          <select class="form-control" bind:value={preferences.measurementSystem}>
            <option value="imperial">Imperial</option>
            <option value="metric">Metric</option>
          </select>
        </label>

        <label class="form-field sm:col-span-2">
          <span class="form-label">Preferred pool water temperature</span>
          <input class="form-control" type="number" min="40" max="110" step="0.5" bind:value={preferences.preferredPoolTemp} />
        </label>

        <label class="form-field sm:col-span-2">
          <span class="form-label">Default active pool</span>
          <select
            class="form-control"
            bind:value={defaultPoolSelection}
          >
            <option value="">No default pool</option>
            {#each poolOptions as pool}
              <option value={pool.poolId}>{pool.name}</option>
            {/each}
          </select>
        </label>
      </div>

      <div class="mt-5 space-y-3">
        <p class="form-label">Notification management</p>
        <label class="flex items-center gap-2 text-sm text-content-primary">
          <input type="checkbox" bind:checked={preferences.notificationEmailEnabled} />
          Email notifications
        </label>
        <label class="flex items-center gap-2 text-sm text-content-primary">
          <input type="checkbox" bind:checked={preferences.notificationPushEnabled} />
          In-app push notifications
        </label>
        <label class="flex items-center gap-2 text-sm text-content-primary">
          <input type="checkbox" bind:checked={preferences.notificationSmsEnabled} />
          SMS notifications
        </label>
        <label class="form-field">
          <span class="form-label">Notification email destination</span>
          <input class="form-control" type="email" bind:value={preferences.notificationEmailAddress} />
        </label>
      </div>

      {#if message}
        <p class={`mt-4 text-sm ${message.type === 'success' ? 'text-success' : 'text-danger'}`}>
          {message.text}
        </p>
      {/if}

      <div class="mt-4">
        <button class="btn btn-primary" on:click={savePreferences} disabled={saving}>
          {saving ? 'Saving...' : 'Save preferences'}
        </button>
      </div>
    </Card>
  </section>
</Container>
