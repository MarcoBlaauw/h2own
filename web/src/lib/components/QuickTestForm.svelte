<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import { tests } from '$lib/api';
  import { z } from 'zod';

  export let poolId: string;

  let fc = 0;
  let tc = 0;
  let ph = 0;
  let ta = 0;
  let cya = 0;
  let error = '';
  let success = '';

  const testSchema = z.object({
    fc: z.number().min(0),
    tc: z.number().min(0),
    ph: z.number().min(0),
    ta: z.number().min(0),
    cya: z.number().min(0),
  });

  async function handleSubmit() {
    success = '';
    error = '';
    const result = testSchema.safeParse({ fc, tc, ph, ta, cya });
    if (!result.success) {
      error = result.error.errors.map(e => e.message).join(', ');
      return;
    }
    const res = await tests.create(poolId, result.data);
    if (res.ok) {
      success = 'Test results saved successfully.';
    } else {
      const data = await res.json();
      error = data.message;
    }
  }
</script>

<Card>
  <h2 class="text-lg font-semibold">Quick Test Update</h2>
  <form class="mt-4 grid grid-cols-2 gap-3" on:submit|preventDefault={handleSubmit}>
    <div class="col-span-1">
      <label class="block text-sm font-medium text-gray-700" for="fc">FC</label>
      <input class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" id="fc" type="number" bind:value={fc}>
    </div>
    <div class="col-span-1">
      <label class="block text-sm font-medium text-gray-700" for="tc">TC</label>
      <input class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" id="tc" type="number" bind:value={tc}>
    </div>
    <div class="col-span-1">
      <label class="block text-sm font-medium text-gray-700" for="ph">pH</label>
      <input class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" id="ph" type="number" bind:value={ph}>
    </div>
    <div class="col-span-1">
      <label class="block text-sm font-medium text-gray-700" for="ta">TA</label>
      <input class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" id="ta" type="number" bind:value={ta}>
    </div>
    <div class="col-span-1">
      <label class="block text-sm font-medium text-gray-700" for="cya">CYA</label>
      <input class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" id="cya" type="number" bind:value={cya}>
    </div>
    {#if error}
      <p class="text-red-500 text-xs italic col-span-2">{error}</p>
    {/if}
    {#if success}
      <p class="text-green-500 text-xs italic col-span-2">{success}</p>
    {/if}
    <button type="submit" class="col-span-2 mt-2 inline-flex items-center justify-center rounded-xl bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700">Save</button>
  </form>
</Card>
