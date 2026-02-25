<script lang="ts">
  import Container from "$lib/components/layout/Container.svelte";
  import Captcha from '$lib/components/Captcha.svelte';
  import { onMount } from 'svelte';
  import { api } from '$lib/api';

  let name = '';
  let email = '';
  let message = '';
  let error = '';
  let success = '';
  let submitting = false;
  let captchaEnabled = false;
  let captchaProvider: 'turnstile' | 'hcaptcha' | null = null;
  let captchaSiteKey = '';
  let captchaToken = '';

  onMount(() => {
    void loadCaptchaConfig();
  });

  async function loadCaptchaConfig() {
    try {
      const res = await api.auth.captchaConfig();
      if (!res.ok) return;
      const payload = await res.json().catch(() => ({}));
      captchaEnabled = Boolean(payload?.enabled);
      captchaProvider =
        payload?.provider === 'turnstile' || payload?.provider === 'hcaptcha'
          ? payload.provider
          : null;
      captchaSiteKey = typeof payload?.siteKey === 'string' ? payload.siteKey : '';
    } catch {
      captchaEnabled = false;
    }
  }

  async function handleSubmit() {
    error = '';
    success = '';
    if (!name.trim() || !email.trim() || message.trim().length < 10) {
      error = 'Please provide your name, email, and a message (at least 10 characters).';
      return;
    }
    if (captchaEnabled && !captchaToken) {
      error = 'Please complete the CAPTCHA challenge.';
      return;
    }

    submitting = true;
    try {
      const res = await api.contact.submit({
        name: name.trim(),
        email: email.trim(),
        message: message.trim(),
        captchaToken: captchaToken || undefined,
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        error = payload?.message ?? `Failed to submit (${res.status}).`;
        return;
      }
      success = payload?.message ?? 'Message sent.';
      name = '';
      email = '';
      message = '';
      captchaToken = '';
    } catch {
      error = 'Unable to submit your message right now. Please try again later.';
    } finally {
      submitting = false;
    }
  }
</script>

<Container>
  <section class="py-12">
    <div class="rounded-3xl border border-border/60 bg-surface-subtle px-6 py-10 shadow-sm sm:px-10">
      <p class="text-xs font-semibold uppercase tracking-wide text-content-secondary/80">Contact</p>
      <h1 class="mt-4 text-3xl font-semibold text-content-primary sm:text-4xl">Let’s keep your pools perfect.</h1>
      <p class="mt-4 max-w-3xl text-sm text-content-secondary sm:text-base">
        We’re here to help with onboarding, recommendations, and product questions. Reach out and we’ll respond within one
        business day.
      </p>
    </div>

    <div class="mt-10 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
      <div class="rounded-2xl border border-border/60 bg-surface p-6 shadow-sm">
        <h2 class="text-lg font-semibold text-content-primary">Contact details</h2>
        <ul class="mt-4 space-y-3 text-sm text-content-secondary">
          <li>
            <span class="font-semibold text-content-primary">Email:</span>
            <a class="ml-2 text-accent hover:text-accent-strong" href="mailto:support@h2own.com">support@h2own.com</a>
          </li>
          <li>
            <span class="font-semibold text-content-primary">Phone:</span>
            <span class="ml-2">(512) 555-0199</span>
          </li>
          <li>
            <span class="font-semibold text-content-primary">Office:</span>
            <span class="ml-2">123 Pool St., Austin, TX 78701</span>
          </li>
        </ul>
        <div class="mt-6 rounded-2xl border border-border/60 bg-surface-subtle p-4">
          <p class="text-xs font-semibold uppercase tracking-wide text-content-secondary/80">Support hours</p>
          <p class="mt-2 text-sm text-content-secondary">Monday–Friday, 9am–6pm CT</p>
        </div>
      </div>

      <div class="rounded-2xl border border-border/60 bg-surface p-6 shadow-sm">
        <h2 class="text-lg font-semibold text-content-primary">Send a message</h2>
        <p class="mt-2 text-sm text-content-secondary">We’ll route your request to the right team.</p>
        <form class="mt-4 space-y-4 text-sm" on:submit|preventDefault={handleSubmit}>
          <div>
            <label class="text-content-secondary" for="contact-name">Name</label>
            <input
              id="contact-name"
              bind:value={name}
              class="mt-2 w-full rounded-xl border border-border/70 bg-surface px-3 py-2 text-content-primary shadow-sm focus:border-accent focus:outline-none"
              placeholder="Your name"
            />
          </div>
          <div>
            <label class="text-content-secondary" for="contact-email">Email</label>
            <input
              id="contact-email"
              type="email"
              bind:value={email}
              class="mt-2 w-full rounded-xl border border-border/70 bg-surface px-3 py-2 text-content-primary shadow-sm focus:border-accent focus:outline-none"
              placeholder="you@company.com"
            />
          </div>
          <div>
            <label class="text-content-secondary" for="contact-message">Message</label>
            <textarea
              id="contact-message"
              rows="4"
              bind:value={message}
              class="mt-2 w-full rounded-xl border border-border/70 bg-surface px-3 py-2 text-content-primary shadow-sm focus:border-accent focus:outline-none"
              placeholder="Tell us how we can help."
            ></textarea>
          </div>
          {#if captchaEnabled && captchaProvider && captchaSiteKey}
            <Captcha
              provider={captchaProvider}
              siteKey={captchaSiteKey}
              on:token={(event) => {
                captchaToken = event.detail ?? '';
              }}
            />
          {/if}
          {#if error}
            <p class="form-message" data-state="error">{error}</p>
          {/if}
          {#if success}
            <p class="form-message" data-state="success">{success}</p>
          {/if}
          <button
            type="submit"
            class="btn btn-base btn-primary"
            disabled={submitting}
          >
            {submitting ? 'Sending…' : 'Send message'}
          </button>
        </form>
      </div>
    </div>
  </section>
</Container>
