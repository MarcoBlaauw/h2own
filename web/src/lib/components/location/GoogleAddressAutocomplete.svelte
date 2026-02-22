<script lang="ts">
  import { onMount } from 'svelte';

  type MapsWindow = Window &
    typeof globalThis & {
      google?: any;
      __h2ownMapsLoaderPromise?: Promise<void>;
      __h2ownMapsLoaderCallback?: () => void;
      gm_authFailure?: () => void;
    };

  export let address = '';
  export let idPrefix = 'google-address';

  const apiKey = import.meta.env.PUBLIC_GOOGLE_MAPS_API_KEY || import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  let autocompleteEl: HTMLElement | null = null;
  let setupError: string | null = null;
  let isReady = false;

  const getGoogle = () => (window as MapsWindow).google;

  const setAddressFromPlace = async (rawEvent: Event) => {
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
        fields: ['formattedAddress', 'displayName', 'id'],
      });
    }

    address = place.formattedAddress ?? place.displayName ?? '';
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
        existing.addEventListener('error', () => reject(new Error('Failed to load Google Maps script.')), {
          once: true,
        });
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
            'Google Maps authorization failed. Enable Maps JavaScript API and Places API for this key and allow this origin.'
          )
        );
      };

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&loading=async&callback=${callbackName}&v=weekly`;
      script.async = true;
      script.defer = true;
      script.dataset.googleMapsLoader = '1';
      script.addEventListener(
        'load',
        () => {
          if (win.google?.maps?.places) resolve();
        },
        { once: true }
      );
      script.addEventListener('error', () => reject(new Error('Failed to load Google Maps script.')), {
        once: true,
      });
      document.head.appendChild(script);
    });

    win.__h2ownMapsLoaderPromise = mapsLoadPromise;
    return mapsLoadPromise;
  };

  onMount(async () => {
    try {
      await loadMaps();
      const google = getGoogle();
      const placesLib = await google.maps.importLibrary('places');
      const PlaceAutocompleteElement = placesLib?.PlaceAutocompleteElement;
      if (!PlaceAutocompleteElement || !autocompleteEl) {
        throw new Error('Place autocomplete is unavailable. Confirm Places API (New) is enabled.');
      }

      const autocompleteWidget = autocompleteEl;

      autocompleteWidget.addEventListener('gmp-select', setAddressFromPlace);
      autocompleteWidget.addEventListener('gmp-placeselect', setAddressFromPlace);
      autocompleteWidget.addEventListener('gmp-error', () => {
        setupError =
          'Address lookup failed. Confirm Places API (New) is enabled and your API key allows this origin.';
      });

      isReady = true;
    } catch (error) {
      setupError = error instanceof Error ? error.message : 'Unable to initialize address lookup.';
    }
  });
</script>

<div class="space-y-2">
  <label class="form-label" for={`${idPrefix}-search`}>Address</label>
  <div class="place-autocomplete-host">
    <gmp-place-autocomplete
      id={`${idPrefix}-search`}
      aria-label="Search address"
      placeholder="Search and select your address"
      bind:this={autocompleteEl}
    ></gmp-place-autocomplete>
  </div>

  {#if address}
    <p class="text-xs text-content-secondary">Selected: {address}</p>
  {/if}

  {#if setupError}
    <p class="text-xs text-danger">{setupError}</p>
  {:else if !isReady}
    <p class="text-xs text-content-secondary">Loading address search…</p>
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
