<script lang="ts">
  import Container from "$lib/components/layout/Container.svelte";

  const staff = [
    {
      name: "Jordan Park",
      role: "Head of Customer Success",
      detail: "Guiding pool owners through confident water care.",
    },
    {
      name: "Avery Martinez",
      role: "Product Lead",
      detail: "Designing the most intuitive pool insights dashboard.",
    },
    {
      name: "Riley Chen",
      role: "Water Quality Specialist",
      detail: "Turning chemistry data into clear, safe actions.",
    },
    {
      name: "Morgan Lee",
      role: "Operations Manager",
      detail: "Keeping service teams aligned and on schedule.",
    },
  ];
</script>

<Container>
  <section class="py-12">
    <div class="rounded-3xl border border-border/60 bg-surface-subtle px-6 py-10 shadow-sm sm:px-10">
      <p class="text-xs font-semibold uppercase tracking-wide text-content-secondary/80">Staff</p>
      <h1 class="mt-4 text-3xl font-semibold text-content-primary sm:text-4xl">Meet the team behind H2Own.</h1>
      <p class="mt-4 max-w-3xl text-sm text-content-secondary sm:text-base">
        We’re a group of pool care experts, product builders, and service pros dedicated to clear, safe water for every
        customer.
      </p>
    </div>

    <div class="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {#each staff as member}
        <div class="rounded-2xl border border-border/60 bg-surface p-5 shadow-sm">
          <div class="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-sm font-semibold text-accent">
            {member.name
              .split(" ")
              .map((part) => part[0])
              .join("")}
          </div>
          <h2 class="mt-4 text-lg font-semibold text-content-primary">{member.name}</h2>
          <p class="text-sm font-medium text-content-secondary">{member.role}</p>
          <p class="mt-3 text-sm text-content-secondary">{member.detail}</p>
        </div>
      {/each}
    </div>
  </section>
</Container>
