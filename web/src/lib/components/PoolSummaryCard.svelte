<script lang="ts">
  import {
    IconDroplet,
    IconFlask2,
    IconRuler2,
    IconSettings,
    IconUser,
    IconVaccineBottle,
  } from '@tabler/icons-svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';

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
      <dt class="text-xs font-semibold uppercase tracking-wide text-content-secondary/80 flex items-center gap-1.5"><Icon icon={IconUser} size={16} className="text-content-secondary" /> Owner</dt>
      <dd class="text-right font-medium text-content-primary">{displayOwner(pool?.owner)}</dd>
    </div>
    <div class="flex items-center justify-between gap-3">
      <dt class="text-xs font-semibold uppercase tracking-wide text-content-secondary/80 flex items-center gap-1.5"><Icon icon={IconDroplet} size={16} className="text-content-secondary" /> Volume</dt>
      <dd class="text-right text-content-secondary">{displayVolume(pool?.volumeGallons)} gallons</dd>
    </div>
    <div class="flex items-center justify-between gap-3">
      <dt class="text-xs font-semibold uppercase tracking-wide text-content-secondary/80 flex items-center gap-1.5"><Icon icon={IconRuler2} size={16} className="text-content-secondary" /> Surface</dt>
      <dd class="text-right text-content-secondary">{displayText(pool?.surfaceType)}</dd>
    </div>
    <div class="flex items-center justify-between gap-3">
      <dt class="text-xs font-semibold uppercase tracking-wide text-content-secondary/80 flex items-center gap-1.5"><Icon icon={IconFlask2} size={16} className="text-content-secondary" /> Sanitizer</dt>
      <dd class="text-right text-content-secondary">{displayText(pool?.sanitizerType)}</dd>
    </div>
    {#if displayEquipment(pool?.equipment)}
      <div class="flex items-center justify-between gap-3">
        <dt class="text-xs font-semibold uppercase tracking-wide text-content-secondary/80 flex items-center gap-1.5"><Icon icon={IconSettings} size={16} className="text-content-secondary" /> Equipment</dt>
        <dd class="text-right text-content-secondary">{displayEquipment(pool?.equipment)}</dd>
      </div>
    {/if}
    <div class="flex items-center justify-between gap-3">
      <dt class="text-xs font-semibold uppercase tracking-wide text-content-secondary/80 flex items-center gap-1.5"><Icon icon={IconVaccineBottle} size={16} className="text-content-secondary" /> Last tested</dt>
      <dd class="text-right text-content-secondary">{displayLastTested(pool?.lastTestedAt)}</dd>
    </div>
  </dl>
</Card>
