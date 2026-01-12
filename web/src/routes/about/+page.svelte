<script lang="ts">
  import Container from "$lib/components/layout/Container.svelte";
</script>

<Container>
  <section class="py-12">
    <div class="rounded-3xl border border-border/60 bg-surface-subtle px-6 py-10 shadow-sm sm:px-10">
      <p class="text-xs font-semibold uppercase tracking-wide text-content-secondary/80">About H2Own</p>
      <h1 class="mt-4 text-3xl font-semibold text-content-primary sm:text-4xl">Built for confidence in every swim.</h1>
      <p class="mt-4 max-w-3xl text-sm text-content-secondary sm:text-base">
        H2Own helps pool owners and service pros keep water balanced without the stress. We combine smart insights, clear
        recommendations, and simple workflows so you can focus on clean, safe water year-round.
      </p>
    </div>

    <div class="mt-10 grid gap-6 md:grid-cols-3">
      {#each [
        {
          title: "Accuracy first",
          description: "We translate test results into actionable guidance backed by industry best practices.",
        },
        {
          title: "Clear communication",
          description: "Every update is organized, easy to understand, and ready to share with your team or family.",
        },
        {
          title: "Designed to scale",
          description: "Track one pool or manage dozens with the same modern, reliable workflow.",
        },
      ] as value}
        <div class="rounded-2xl border border-border/60 bg-surface p-6 shadow-sm">
          <h2 class="text-lg font-semibold text-content-primary">{value.title}</h2>
          <p class="mt-3 text-sm text-content-secondary">{value.description}</p>
        </div>
      {/each}
    </div>
  </section>
</Container>
