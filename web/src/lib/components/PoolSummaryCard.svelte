<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  export let pool;

  const displayVolume = (value) => (typeof value === 'number' ? value.toLocaleString() : '—');
  const displayText = (value) => value ?? '—';
  const displayOwner = (owner) => owner?.name ?? 'Unknown';
  const displayEquipment = (equipment) => {
    if (!equipment) return null;
    const status = `${equipment.status ?? ''}`.toLowerCase();
    const equipmentType = `${equipment.equipmentType ?? ''}`.toLowerCase();
    if (status !== 'enabled' || !equipmentType || equipmentType === 'none') {
      return null;
    }
    const readableType = equipmentType === 'combo' ? 'heater + chiller' : equipmentType;
    const energySource = equipment.energySource ? ` (${equipment.energySource})` : '';
    return `${readableType}${energySource}`;
  };
  const displayLastTested = (value) => {
    if (!value) return 'Never';
    const date = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) return 'Never';
    return date.toLocaleDateString();
  };
</script>

<Card>
  <h2 class="text-lg font-semibold text-content-primary">Pool Summary</h2>
  <dl class="mt-4 grid gap-3 text-sm">
    <div class="flex items-center justify-between gap-3">
      <dt class="text-xs font-semibold uppercase tracking-wide text-content-secondary/80">Owner</dt>
      <dd class="text-right font-medium text-content-primary">{displayOwner(pool?.owner)}</dd>
    </div>
    <div class="flex items-center justify-between gap-3">
      <dt class="text-xs font-semibold uppercase tracking-wide text-content-secondary/80">Volume</dt>
      <dd class="text-right text-content-secondary">{displayVolume(pool?.volumeGallons)} gallons</dd>
    </div>
    <div class="flex items-center justify-between gap-3">
      <dt class="text-xs font-semibold uppercase tracking-wide text-content-secondary/80">Surface</dt>
      <dd class="text-right text-content-secondary">{displayText(pool?.surfaceType)}</dd>
    </div>
    <div class="flex items-center justify-between gap-3">
      <dt class="text-xs font-semibold uppercase tracking-wide text-content-secondary/80">Sanitizer</dt>
      <dd class="text-right text-content-secondary">{displayText(pool?.sanitizerType)}</dd>
    </div>
    {#if displayEquipment(pool?.equipment)}
      <div class="flex items-center justify-between gap-3">
        <dt class="text-xs font-semibold uppercase tracking-wide text-content-secondary/80">Equipment</dt>
        <dd class="text-right text-content-secondary">{displayEquipment(pool?.equipment)}</dd>
      </div>
    {/if}
    <div class="flex items-center justify-between gap-3">
      <dt class="text-xs font-semibold uppercase tracking-wide text-content-secondary/80">Last tested</dt>
      <dd class="text-right text-content-secondary">{displayLastTested(pool?.lastTestedAt)}</dd>
    </div>
  </dl>
</Card>
