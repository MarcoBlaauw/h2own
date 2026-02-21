<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';

  type LocationPin = {
    locationId: string;
    name: string;
    formattedAddress?: string | null;
    latitude: number | null;
    longitude: number | null;
    pools?: Array<{ poolId: string; name: string }>;
  };

  type MapsWindow = Window &
    typeof globalThis & {
      google?: any;
      __h2ownMapsLoaderPromise?: Promise<void>;
      __h2ownMapsLoaderCallback?: () => void;
      gm_authFailure?: () => void;
    };

  export let locations: LocationPin[] = [];
  export let idPrefix = 'location-pins-map';
  export let heightClass = 'h-72';

  const dispatch = createEventDispatcher<{ select: { locationId: string } }>();
  const apiKey =
    import.meta.env.PUBLIC_GOOGLE_MAPS_API_KEY || import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const mapId =
    import.meta.env.PUBLIC_GOOGLE_MAPS_MAP_ID || import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || '';

  let mapEl: HTMLDivElement | null = null;
  let map: any;
  let infoWindow: any;
  let setupError: string | null = null;
  let mapsLoadPromise: Promise<void> | null = null;
  let markerRefs: any[] = [];

  const getGoogle = () => (window as MapsWindow).google;

  const loadMaps = () => {
    if (!apiKey) {
      throw new Error(
        'Google Maps API key is missing. Set PUBLIC_GOOGLE_MAPS_API_KEY or VITE_GOOGLE_MAPS_API_KEY.'
      );
    }
    const win = window as MapsWindow;
    if (win.google?.maps) {
      return Promise.resolve();
    }
    if (mapsLoadPromise) return mapsLoadPromise;
    if (win.__h2ownMapsLoaderPromise) {
      mapsLoadPromise = win.__h2ownMapsLoaderPromise;
      return mapsLoadPromise;
    }

    mapsLoadPromise = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(
        'script[data-google-maps-loader="1"]'
      );
      if (existing) {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener(
          'error',
          () => reject(new Error('Failed to load Google Maps script.')),
          { once: true }
        );
        return;
      }

      const callbackName = '__h2ownMapsLoaderCallback';
      win[callbackName] = () => {
        resolve();
        try {
          delete win[callbackName];
        } catch {
          win[callbackName] = undefined as unknown as () => void;
        }
      };

      win.gm_authFailure = () => {
        reject(
          new Error(
            'Google Maps authorization failed. Confirm key restrictions and billing are configured.'
          )
        );
      };

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
        apiKey
      )}&loading=async&callback=${callbackName}&v=weekly`;
      script.async = true;
      script.defer = true;
      script.dataset.googleMapsLoader = '1';
      script.addEventListener('load', () => resolve(), { once: true });
      script.addEventListener(
        'error',
        () => reject(new Error('Failed to load Google Maps script.')),
        { once: true }
      );
      document.head.appendChild(script);
    });

    win.__h2ownMapsLoaderPromise = mapsLoadPromise;
    return mapsLoadPromise;
  };

  const clearMarkers = () => {
    for (const marker of markerRefs) {
      if (typeof marker.setMap === 'function') {
        marker.setMap(null);
      } else if (marker) {
        marker.map = null;
      }
    }
    markerRefs = [];
  };

  const renderMarkers = async () => {
    if (!map) return;
    clearMarkers();
    const google = getGoogle();
    const bounds = new google.maps.LatLngBounds();
    const withCoordinates = locations.filter(
      (location) => location.latitude !== null && location.longitude !== null
    );

    for (const location of withCoordinates) {
      const position = {
        lat: Number(location.latitude),
        lng: Number(location.longitude),
      };
      const marker = new google.maps.Marker({
        map,
        position,
        title: location.name,
      });

      marker.addListener('click', () => {
        const pools = location.pools ?? [];
        infoWindow?.setContent(`
          <div style="max-width:280px;">
            <div style="font-weight:600;">${location.name}</div>
            <div style="font-size:12px;color:#5a677a;margin-top:4px;">${
              location.formattedAddress ?? 'No address'
            }</div>
            <div style="font-size:12px;margin-top:8px;">Pools: ${pools.length}</div>
            <div style="font-size:12px;color:#5a677a;">${pools
              .slice(0, 4)
              .map((pool) => pool.name)
              .join(', ') || 'None'}</div>
          </div>
        `);
        infoWindow?.open({ map, anchor: marker });
        dispatch('select', { locationId: location.locationId });
      });

      markerRefs.push(marker);
      bounds.extend(position);
    }

    if (withCoordinates.length === 0) {
      map.setCenter({ lat: 37.09024, lng: -95.712891 });
      map.setZoom(4);
      return;
    }

    if (withCoordinates.length === 1) {
      map.setCenter(bounds.getCenter());
      map.setZoom(14);
    } else {
      map.fitBounds(bounds, 40);
    }
  };

  onMount(async () => {
    try {
      if (!mapEl) return;
      await loadMaps();
      const google = getGoogle();
      map = new google.maps.Map(mapEl, {
        center: { lat: 37.09024, lng: -95.712891 },
        zoom: 4,
        mapTypeControl: true,
        mapTypeId: 'hybrid',
        streetViewControl: false,
        fullscreenControl: false,
        ...(mapId ? { mapId } : {}),
      });
      infoWindow = new google.maps.InfoWindow();
      await renderMarkers();
    } catch (error) {
      setupError =
        error instanceof Error ? error.message : 'Unable to initialize location map.';
    }
  });

  $: if (map) {
    renderMarkers();
  }
</script>

<div class="space-y-2">
  <label class="text-sm font-medium text-content-secondary" for={`${idPrefix}-canvas`}>
    Pools map
  </label>
  <div
    id={`${idPrefix}-canvas`}
    class={`w-full overflow-hidden rounded-lg border border-border bg-surface-subtle ${heightClass}`}
    bind:this={mapEl}
  ></div>
  {#if setupError}
    <p class="text-xs text-danger">{setupError}</p>
  {:else}
    <p class="text-xs text-content-secondary">Click a pin to preview location and pools.</p>
  {/if}
</div>
