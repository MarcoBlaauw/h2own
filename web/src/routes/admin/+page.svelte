<script lang="ts">
  import Container from '$lib/components/layout/Container.svelte';
  export let data;

  const adminLinks = [
    { href: '/admin/pools', label: 'Pool Admin' },
    { href: '/admin/users', label: 'Users' },
    { href: '/admin/api-tokens', label: 'API tokens' },
    { href: '/admin/integrations', label: 'Integrations' },
    { href: '/admin/audit-log', label: 'Audit log' },
    { href: '/admin/notifications', label: 'Notifications' },
    { href: '/admin/chemicals', label: 'Chemicals' },
  ];

  const businessLinks = [{ href: '/pools', label: 'Pool Setup' }];

  $: links = data.role === 'admin' ? adminLinks : businessLinks;
</script>

<Container>
  <section class="mx-auto w-full max-w-4xl space-y-4 py-6 text-center">
    <h1 class="text-2xl font-semibold text-content-primary">Admin panel</h1>
    <p class="text-sm text-content-secondary">Signed in as {data.role}.</p>
    <div class="mx-auto grid w-full max-w-md gap-3 sm:grid-cols-2">
      {#each links as link}
        <a href={link.href} class="surface-panel p-4 text-content-primary hover:underline">{link.label}</a>
      {/each}
    </div>

    <div class="mx-auto mt-4 w-full max-w-2xl text-left">
      <div class="surface-panel p-4">
        <h2 class="text-base font-semibold text-content-primary">Feature readiness</h2>
        <p class="mt-1 text-xs text-content-secondary">
          Placeholder modules and provider wiring status.
        </p>
        <div class="mt-3 space-y-2">
          {#if data.readiness?.modules?.length}
            {#each data.readiness.modules as module}
              <div class="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2">
                <div>
                  <p class="text-sm font-medium text-content-primary">{module.label}</p>
                  <p class="text-xs text-content-secondary">{module.details}</p>
                </div>
                <div class="text-right">
                  <p class="text-xs text-content-secondary">wired: {module.wired ? 'yes' : 'no'}</p>
                  <p class="text-xs font-medium text-content-primary">{module.providerStatus}</p>
                </div>
              </div>
            {/each}
          {:else}
            <p class="text-sm text-content-secondary">Readiness data unavailable.</p>
          {/if}
        </div>
      </div>
    </div>
  </section>
</Container>
