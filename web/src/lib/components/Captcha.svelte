<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';

  type CaptchaProvider = 'turnstile' | 'hcaptcha';

  export let provider: CaptchaProvider;
  export let siteKey: string;

  const dispatch = createEventDispatcher<{ token: string | null }>();

  let container: HTMLDivElement | null = null;
  let widgetId: string | number | null = null;

  const ensureScript = async (src: string, scriptId: string) => {
    if (document.getElementById(scriptId)) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = src;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Unable to load CAPTCHA script.'));
      document.head.appendChild(script);
    });
  };

  const renderWidget = async () => {
    if (!container || !siteKey || !provider) return;

    if (provider === 'turnstile') {
      await ensureScript(
        'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',
        'turnstile-script',
      );
      const turnstile = (window as any).turnstile;
      if (!turnstile?.render) return;
      widgetId = turnstile.render(container, {
        sitekey: siteKey,
        callback: (token: string) => dispatch('token', token),
        'expired-callback': () => dispatch('token', null),
        'error-callback': () => dispatch('token', null),
      });
      return;
    }

    await ensureScript('https://js.hcaptcha.com/1/api.js?render=explicit', 'hcaptcha-script');
    const hcaptcha = (window as any).hcaptcha;
    if (!hcaptcha?.render) return;
    widgetId = hcaptcha.render(container, {
      sitekey: siteKey,
      callback: (token: string) => dispatch('token', token),
      'expired-callback': () => dispatch('token', null),
      'error-callback': () => dispatch('token', null),
    });
  };

  onMount(() => {
    void renderWidget();

    return () => {
      if (widgetId === null) return;
      try {
        if (provider === 'turnstile') {
          (window as any).turnstile?.remove?.(widgetId);
        } else {
          (window as any).hcaptcha?.remove?.(widgetId);
        }
      } catch {
        // No-op cleanup fallback.
      }
    };
  });
</script>

<div bind:this={container} class="min-h-20"></div>
