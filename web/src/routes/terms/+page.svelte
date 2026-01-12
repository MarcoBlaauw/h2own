<script lang="ts">
  import Container from "$lib/components/layout/Container.svelte";
</script>

<Container>
  <section class="py-12">
    <div class="rounded-3xl border border-border/60 bg-surface-subtle px-6 py-10 shadow-sm sm:px-10">
      <p class="text-xs font-semibold uppercase tracking-wide text-content-secondary/80">Terms of Service</p>
      <h1 class="mt-4 text-3xl font-semibold text-content-primary sm:text-4xl">Clear expectations for a smooth service.</h1>
      <p class="mt-4 max-w-3xl text-sm text-content-secondary sm:text-base">
        By using H2Own, you agree to use the platform responsibly and keep account information accurate. Our goal is to
        deliver helpful recommendations while keeping your data secure.
      </p>
    </div>

    <div class="mt-10 space-y-6 text-sm text-content-secondary">
      <div class="rounded-2xl border border-border/60 bg-surface p-6 shadow-sm">
        <h2 class="text-lg font-semibold text-content-primary">Account responsibilities</h2>
        <p class="mt-3">
          You’re responsible for maintaining the security of your account and the accuracy of any pool data submitted.
        </p>
      </div>
      <div class="rounded-2xl border border-border/60 bg-surface p-6 shadow-sm">
        <h2 class="text-lg font-semibold text-content-primary">Service availability</h2>
        <p class="mt-3">
          We strive for reliable uptime and may perform scheduled maintenance. We’ll provide updates whenever possible.
        </p>
      </div>
      <div class="rounded-2xl border border-border/60 bg-surface p-6 shadow-sm">
        <h2 class="text-lg font-semibold text-content-primary">Support</h2>
        <p class="mt-3">
          Reach out through our contact page for questions, issues, or assistance with your subscription.
        </p>
      </div>
    </div>
  </section>
</Container>
