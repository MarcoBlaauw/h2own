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
  export let activePoolId: string | null = null;

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
  const getMapsImportLibrary = (google: any) =>
    typeof google?.maps?.importLibrary === 'function'
      ? google.maps.importLibrary.bind(google.maps)
      : null;
  const isConstructable = (value: unknown): value is new (...args: any[]) => any => {
    if (typeof value !== 'function') return false;
    try {
      Reflect.construct(String, [], value);
      return true;
    } catch {
      return false;
    }
  };

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

    const waitForMapsReady = (
      resolve: () => void,
      reject: (error: Error) => void,
      timeoutMs = 10000
    ) => {
      const start = Date.now();
      const tick = () => {
        if (win.google?.maps?.Map && win.google?.maps?.InfoWindow) {
          resolve();
          return;
        }
        if (Date.now() - start >= timeoutMs) {
          reject(new Error('Google Maps loaded, but constructors were not initialized.'));
          return;
        }
        window.setTimeout(tick, 50);
      };
      tick();
    };

    mapsLoadPromise = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(
        'script[data-google-maps-loader="1"]'
      );
      if (existing) {
        if (win.google?.maps?.Map && win.google?.maps?.InfoWindow) {
          resolve();
          return;
        }
        existing.addEventListener('load', () => waitForMapsReady(resolve, reject), { once: true });
        existing.addEventListener(
          'error',
          () => reject(new Error('Failed to load Google Maps script.')),
          { once: true }
        );
        return;
      }

      const callbackName = '__h2ownMapsLoaderCallback';
      win[callbackName] = () => {
        waitForMapsReady(resolve, reject);
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
      script.addEventListener('load', () => waitForMapsReady(resolve, reject), { once: true });
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
    const importLibrary = getMapsImportLibrary(google);
    let markerLib: Record<string, unknown> | null = null;
    if (importLibrary) {
      try {
        markerLib = (await importLibrary('marker')) as Record<string, unknown>;
      } catch {
        markerLib = null;
      }
    }
    const markerNamespace =
      markerLib && Object.keys(markerLib).length > 0 ? markerLib : google.maps?.marker;
    const AdvancedMarkerCtor = markerNamespace?.AdvancedMarkerElement;
    const MarkerCtor = google.maps?.Marker;
    const canUseAdvancedMarkers = Boolean(
      mapId &&
        isConstructable(AdvancedMarkerCtor)
    );
    const bounds = new google.maps.LatLngBounds();
    const withCoordinates = locations.filter(
      (location) => location.latitude !== null && location.longitude !== null
    );

    for (const location of withCoordinates) {
      const position = {
        lat: Number(location.latitude),
        lng: Number(location.longitude),
      };
      const isActive = location.pools?.some((pool) => pool.poolId === activePoolId);
      let marker: any;

      if (canUseAdvancedMarkers) {
        try {
          marker = new AdvancedMarkerCtor({
            map,
            position,
            title: location.name,
          });
        } catch {
          marker = null;
        }
      } else {
        marker = null;
      }

      if (!marker && isConstructable(MarkerCtor)) {
        marker = new MarkerCtor({
          map,
          position,
          title: location.name,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: isActive ? '#16a34a' : '#dc2626',
            fillOpacity: 1,
            strokeColor: '#0f172a',
            strokeWeight: 1.25,
          },
        });
      }

      if (!marker) {
        continue;
      }

      const handleMarkerClick = () => {
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
      };

      if (canUseAdvancedMarkers && typeof marker.addEventListener === 'function') {
        marker.addEventListener('gmp-click', handleMarkerClick);
      } else {
        marker.addListener('click', handleMarkerClick);
      }

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
      const importLibrary = getMapsImportLibrary(google);
      let mapsLib: Record<string, unknown> | null = null;
      if (importLibrary) {
        try {
          mapsLib = (await importLibrary('maps')) as Record<string, unknown>;
        } catch {
          mapsLib = null;
        }
      }
      const MapCtor = isConstructable(mapsLib?.Map) ? mapsLib.Map : google.maps?.Map;
      const InfoWindowCtor = isConstructable(mapsLib?.InfoWindow)
        ? mapsLib.InfoWindow
        : google.maps?.InfoWindow;
      if (!isConstructable(MapCtor) || !isConstructable(InfoWindowCtor)) {
        const mapCtorType = typeof mapsLib?.Map;
        const globalMapCtorType = typeof google.maps?.Map;
        const infoCtorType = typeof mapsLib?.InfoWindow;
        const globalInfoCtorType = typeof google.maps?.InfoWindow;
        throw new Error(
          `Google Maps constructors unavailable (maps.Map=${mapCtorType}, global.Map=${globalMapCtorType}, maps.InfoWindow=${infoCtorType}, global.InfoWindow=${globalInfoCtorType}). Verify API key, map ID, and key restrictions.`
        );
      }
      map = new MapCtor(mapEl, {
        center: { lat: 37.09024, lng: -95.712891 },
        zoom: 4,
        mapTypeControl: true,
        mapTypeId: 'hybrid',
        streetViewControl: false,
        fullscreenControl: false,
        ...(mapId ? { mapId } : {}),
      });
      infoWindow = new InfoWindowCtor();
      await renderMarkers();
    } catch (error) {
      setupError =
        error instanceof Error ? error.message : 'Unable to initialize location map.';
    }
  });

  $: if (map) {
    void renderMarkers();
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
    <p class="text-xs text-content-secondary">
      Green pins contain the active pool; red pins are other locations.
    </p>
  {/if}
</div>
