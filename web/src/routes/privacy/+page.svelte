<script lang="ts">
  import Container from "$lib/components/layout/Container.svelte";
</script>

<Container>
  <section class="py-12">
    <div class="rounded-3xl border border-border/60 bg-surface-subtle px-6 py-10 shadow-sm sm:px-10">
      <p class="text-xs font-semibold uppercase tracking-wide text-content-secondary/80">Privacy Policy</p>
      <h1 class="mt-4 text-3xl font-semibold text-content-primary sm:text-4xl">Your data stays yours.</h1>
      <p class="mt-4 max-w-3xl text-sm text-content-secondary sm:text-base">
        We collect only what we need to operate H2Own and make your pool management experience better. We never sell your
        data.
      </p>
    </div>

    <div class="mt-10 space-y-6 text-sm text-content-secondary">
      <div class="rounded-2xl border border-border/60 bg-surface p-6 shadow-sm">
        <h2 class="text-lg font-semibold text-content-primary">What we collect</h2>
        <p class="mt-3">
          Account details, pool information, and test results that you enter. We use this to provide recommendations,
          reminders, and analytics.
        </p>
      </div>
      <div class="rounded-2xl border border-border/60 bg-surface p-6 shadow-sm">
        <h2 class="text-lg font-semibold text-content-primary">How we use it</h2>
        <p class="mt-3">
          Data powers your dashboard, alerts, and team sharing. We also analyze aggregate trends to improve the product.
        </p>
      </div>
      <div class="rounded-2xl border border-border/60 bg-surface p-6 shadow-sm">
        <h2 class="text-lg font-semibold text-content-primary">Your choices</h2>
        <p class="mt-3">
          You can update or delete your data at any time in settings, or contact support for assistance.
        </p>
      </div>
    </div>
  </section>
</Container>
