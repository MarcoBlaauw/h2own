<script lang="ts">
  import { onMount } from 'svelte';

  export let latitude = '';
  export let longitude = '';
  export let formattedAddress = '';
  export let googlePlaceId = '';
  export let googlePlusCode = '';
  export let timezone = '';

  onMount(() => {
    if (!latitude) latitude = '30.0279';
    if (!longitude) longitude = '-90.4614';
    if (!formattedAddress) formattedAddress = '809 Country Cottage Blvd, Montz, LA 70068, USA';
    if (!googlePlaceId) googlePlaceId = 'test-place-id';
    if (!googlePlusCode) googlePlusCode = 'ABC+123';
    if (!timezone) timezone = 'America/Chicago';
  });
</script>

<div data-testid="google-map-picker-mock">Mock map picker</div>
