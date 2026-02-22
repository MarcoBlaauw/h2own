<script lang="ts">
  import { onMount } from 'svelte';
  import tzLookup from 'tz-lookup';
  type MapsWindow = Window &
    typeof globalThis & {
      google?: any;
      __h2ownMapsLoaderPromise?: Promise<void>;
      __h2ownMapsLoaderCallback?: () => void;
      gm_authFailure?: () => void;
    };

  export let latitude = '';
  export let longitude = '';
  export let formattedAddress = '';
  export let googlePlaceId = '';
  export let googlePlusCode = '';
  export let timezone = '';
  export let heightClass = 'h-56';
  export let idPrefix = 'google-location';

  const apiKey = import.meta.env.PUBLIC_GOOGLE_MAPS_API_KEY || import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const mapId =
    import.meta.env.PUBLIC_GOOGLE_MAPS_MAP_ID || import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || '';

  let mapEl: HTMLDivElement | null = null;
  let autocompleteEl: HTMLElement | null = null;
  let isReady = false;
  let setupError: string | null = null;

  let map: any;
  let marker: any;
  let geocoder: any;
  let autocompleteWidget: any;
  let advancedMarkerLib: any;
  let supportsAdvancedMarker = false;

  const getGoogle = () => (window as MapsWindow).google;

  const toNumber = (value: string) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const detectTimezone = (lat: number, lng: number) => {
    try {
      timezone = tzLookup(lat, lng);
    } catch {
      // keep existing timezone if lookup fails
    }
  };

  const updateFromPoint = async (lat: number, lng: number) => {
    latitude = lat.toFixed(8);
    longitude = lng.toFixed(8);

    if (!geocoder) return;
    try {
      const response = await geocoder.geocode({ location: { lat, lng } });
      const first = response?.results?.[0];
      if (first) {
        formattedAddress = first.formatted_address ?? formattedAddress;
        googlePlaceId = first.place_id ?? '';
      }
      const plusCode = response?.plus_code?.global_code ?? response?.plus_code?.compound_code ?? '';
      googlePlusCode = plusCode;
    } catch {
      // ignore reverse-geocode failures; coordinates still stay populated.
    }
  };

  const placeMarker = async (lat: number, lng: number) => {
    if (!map) return;
    const google = getGoogle();
    const position = { lat, lng };
    detectTimezone(lat, lng);
    if (!marker) {
      if (supportsAdvancedMarker && advancedMarkerLib?.AdvancedMarkerElement) {
        marker = new advancedMarkerLib.AdvancedMarkerElement({
          map,
          position,
          gmpDraggable: true,
        });
        marker.addListener('dragend', async (event: any) => {
          const maybePosition = event?.target?.position ?? marker?.position;
          const nextLat =
            typeof maybePosition?.lat === 'function' ? maybePosition.lat() : maybePosition?.lat;
          const nextLng =
            typeof maybePosition?.lng === 'function' ? maybePosition.lng() : maybePosition?.lng;
          if (typeof nextLat === 'number' && typeof nextLng === 'number') {
            await updateFromPoint(nextLat, nextLng);
            detectTimezone(nextLat, nextLng);
          }
        });
      } else {
        marker = new google.maps.Marker({ map, position, draggable: true });
        marker.addListener('dragend', async (event: any) => {
          const nextLat = event?.latLng?.lat?.();
          const nextLng = event?.latLng?.lng?.();
          if (typeof nextLat === 'number' && typeof nextLng === 'number') {
            await updateFromPoint(nextLat, nextLng);
            detectTimezone(nextLat, nextLng);
          }
        });
      }
    } else {
      if (typeof marker.setPosition === 'function') {
        marker.setPosition(position);
      } else {
        marker.position = position;
      }
    }
    map.setCenter(position);
    map.setZoom(17);
    await updateFromPoint(lat, lng);
  };

  const handleSelectedPlace = async (rawEvent: Event) => {
    const event = rawEvent as any;
    const prediction = event?.placePrediction;
    const legacyPlace = event?.place;

    let place: any = legacyPlace;
    if (!place && prediction?.toPlace) {
      place = prediction.toPlace();
    }
    if (!place) return;

    if (typeof place.fetchFields === 'function') {
      await place.fetchFields({
        fields: ['displayName', 'formattedAddress', 'location', 'id', 'plusCode'],
      });
    }

    const point = place?.location;
    if (!point || typeof point.lat !== 'function' || typeof point.lng !== 'function') return;

    formattedAddress = place.formattedAddress ?? place.displayName ?? formattedAddress;
    googlePlaceId = place.id ?? place.place_id ?? '';
    googlePlusCode = place?.plusCode?.globalCode ?? place?.plusCode?.compoundCode ?? '';

    await placeMarker(point.lat(), point.lng());
  };

  const initMap = async () => {
    if (!mapEl || !autocompleteEl) return;
    const google = getGoogle();
    const lat = toNumber(latitude) ?? 37.09024;
    const lng = toNumber(longitude) ?? -95.712891;

    map = new google.maps.Map(mapEl, {
      center: { lat, lng },
      zoom: latitude && longitude ? 16 : 4,
      mapTypeControl: true,
      mapTypeId: 'hybrid',
      streetViewControl: false,
      fullscreenControl: false,
      ...(mapId ? { mapId } : {}),
    });

    geocoder = new google.maps.Geocoder();
    supportsAdvancedMarker = Boolean(mapId);
    if (supportsAdvancedMarker) {
      advancedMarkerLib = await google.maps.importLibrary('marker');
    }

    const placesLib = await google.maps.importLibrary('places');
    const PlaceAutocompleteElement = placesLib?.PlaceAutocompleteElement;
    if (!PlaceAutocompleteElement) {
      throw new Error('Place autocomplete is unavailable. Confirm Places API (New) is enabled.');
    }

    autocompleteWidget = autocompleteEl;

    autocompleteWidget.addEventListener('gmp-select', handleSelectedPlace);
    autocompleteWidget.addEventListener('gmp-placeselect', handleSelectedPlace);
    autocompleteWidget.addEventListener('gmp-error', () => {
      setupError =
        'Place lookup failed. Confirm Places API (New) is enabled and your API key allows this origin.';
    });

    map.addListener('click', async (event: any) => {
      const point = event?.latLng;
      if (!point) return;
      await placeMarker(point.lat(), point.lng());
    });

    if (latitude && longitude) {
      await placeMarker(lat, lng);
    }
  };

  let mapsLoadPromise: Promise<void> | null = null;

  const loadMaps = () => {
    if (!apiKey) {
      throw new Error(
        'Google Maps API key is missing. Set PUBLIC_GOOGLE_MAPS_API_KEY or VITE_GOOGLE_MAPS_API_KEY.'
      );
    }
    const win = window as MapsWindow;
    if (win.google?.maps?.places) {
      return Promise.resolve();
    }
    if (mapsLoadPromise) return mapsLoadPromise;
    if (win.__h2ownMapsLoaderPromise) {
      mapsLoadPromise = win.__h2ownMapsLoaderPromise;
      return mapsLoadPromise;
    }

    mapsLoadPromise = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-google-maps-loader="1"]');
      if (existing) {
        if (win.google?.maps?.places) {
          resolve();
          return;
        }
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error('Failed to load Google Maps script.')), { once: true });
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
            'Google Maps authorization failed. Enable Maps JavaScript API and Places API for this key and allow http://localhost:3000 in key restrictions.'
          )
        );
      };

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&loading=async&callback=${callbackName}&v=weekly`;
      script.async = true;
      script.defer = true;
      script.dataset.googleMapsLoader = '1';
      script.addEventListener('load', () => {
        if (win.google?.maps?.places) resolve();
      }, { once: true });
      script.addEventListener('error', () => reject(new Error('Failed to load Google Maps script.')), { once: true });
      document.head.appendChild(script);
    });

    win.__h2ownMapsLoaderPromise = mapsLoadPromise;
    return mapsLoadPromise;
  };

  onMount(async () => {
    try {
      await loadMaps();
      await initMap();
      isReady = true;
    } catch (error) {
      setupError = error instanceof Error ? error.message : 'Unable to initialize map picker.';
    }
  });
</script>

<div class="space-y-2">
  <label class="text-sm font-medium text-content-secondary" for={`${idPrefix}-search`}>Search location</label>
  <div class="place-autocomplete-host">
    <gmp-place-autocomplete
      id={`${idPrefix}-search`}
      aria-label="Search location"
      placeholder="Search address, place, or city"
      bind:this={autocompleteEl}
    ></gmp-place-autocomplete>
  </div>
  <div class={`w-full overflow-hidden rounded-lg border border-border bg-surface-subtle ${heightClass}`} bind:this={mapEl}></div>
  {#if setupError}
    <p class="text-xs text-danger">{setupError}</p>
  {:else if !isReady}
    <p class="text-xs text-content-secondary">Loading map…</p>
  {:else}
    <p class="text-xs text-content-secondary">Click on the map or drag the pin to set exact pool coordinates.</p>
  {/if}
</div>

<style>
  .place-autocomplete-host {
    display: block;
  }

  .place-autocomplete-host :global(gmp-place-autocomplete) {
    display: block;
    width: 100%;
  }
</style>
