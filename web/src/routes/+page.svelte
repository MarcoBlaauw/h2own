<script lang="ts">
  import Container from '$lib/components/layout/Container.svelte';
  import { page } from '$app/stores';
  import AdSlot from '$lib/components/AdSlot.svelte';

  $: adsEnabledForLanding =
    !$page.data.session?.user || Boolean($page.data.session?.monetization?.adsEnabled);
</script>

<Container>
  <div class="bg-surface">
    <section
      class="relative overflow-hidden rounded-3xl border border-border/60 bg-surface-subtle px-6 py-12 shadow-sm sm:px-10"
    >
      <div
        class="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-accent/20 blur-3xl"
      ></div>
      <div
        class="pointer-events-none absolute -bottom-24 -left-20 h-56 w-56 rounded-full bg-accent-strong/15 blur-3xl"
      ></div>
      <div class="relative z-10">
        <span
          class="inline-flex items-center rounded-full border border-border/60 bg-surface px-3 py-1 text-xs font-semibold uppercase tracking-wide text-content-secondary"
        >
          Pool care, simplified
        </span>
        <h1
          class="mt-6 text-3xl font-semibold text-content-primary sm:text-4xl lg:text-5xl"
        >
          Modern pool insights that keep water crystal-clear in minutes.
        </h1>
        <p class="mt-5 max-w-2xl text-base text-content-secondary sm:text-lg">
          H2Own turns test results into clear actions. Track chemistry,
          schedule reminders, and get smart recommendations without
          spreadsheets or guesswork.
        </p>
        <div class="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <a href="/auth/register" class="btn btn-base btn-primary btn-pill">
            Get started free
          </a>
          <a href="/auth/login" class="btn btn-base btn-secondary btn-pill">
            Sign in
          </a>
        </div>
        <div
          class="mt-8 flex flex-wrap gap-4 text-xs font-semibold uppercase tracking-wide text-content-secondary/80"
        >
          <span
            class="rounded-full border border-border/60 bg-surface px-3 py-1"
            >Smart dosing</span
          >
          <span
            class="rounded-full border border-border/60 bg-surface px-3 py-1"
            >Cloud sync</span
          >
          <span
            class="rounded-full border border-border/60 bg-surface px-3 py-1"
            >Seasonal guidance</span
          >
        </div>
      </div>
    </section>

    <section class="mt-12 grid gap-6 md:grid-cols-3">
      {#each [{ title: "Personalized water targets", description: "Set ideal ranges for your pool type and get immediate feedback when values drift." }, { title: "Actionable recommendations", description: "Get clear dosing amounts and predicted outcomes tailored to your last test." }, { title: "Shared access for teams", description: "Invite staff or family to view history, add notes, and stay aligned." }] as item}
        <div
          class="rounded-2xl border border-border/60 bg-surface-subtle p-6 shadow-sm"
        >
          <h2 class="text-base font-semibold text-content-primary">{item.title}</h2>
          <p class="mt-2 text-sm text-content-secondary">{item.description}</p>
        </div>
      {/each}
    </section>

    <section class="mt-8">
      <AdSlot enabled={adsEnabledForLanding} placement="visitor_landing" />
    </section>
  </div>
</Container>
