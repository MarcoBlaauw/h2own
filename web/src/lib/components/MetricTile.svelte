<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import Metric from '$lib/components/ui/Metric.svelte';

  export let label: string;
  export let value: string | number;
  export let hint: string = '';
  export let trend: 'up' | 'down' | 'flat' = 'flat';
</script>

<Card>
  <Metric {label} {value} {hint} {trend} />
</Card>
