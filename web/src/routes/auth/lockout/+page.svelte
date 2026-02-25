<script lang="ts">
  import { page } from '$app/stores';
  import { api } from '$lib/api';
  import Card from '$lib/components/ui/Card.svelte';

  const query = $page.url.searchParams;
  const email = query.get('email') ?? '';
  const offense = Number(query.get('offense') ?? '0');
  const untilRaw = query.get('until') ?? '';
  const supportRequired = query.get('support') === '1' || offense >= 3;
  const until = untilRaw ? new Date(untilRaw) : null;

  let message = '';
  let requestError = '';
  let requestSuccess = '';
  let sending = false;

  const heading =
    offense >= 3
      ? 'Account locked for the rest of today'
      : offense === 2
        ? 'Account locked for 1 hour'
        : 'Account locked for 15 minutes';

  async function submitSupportRequest() {
    requestError = '';
    requestSuccess = '';
    sending = true;

    try {
      const res = await api.auth.lockoutSupport({
        email,
        message,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        requestError = data?.message ?? 'Unable to submit support request.';
        return;
      }
      requestSuccess = data?.message ?? 'Support request sent.';
      message = '';
    } catch {
      requestError = 'Unable to submit support request.';
    } finally {
      sending = false;
    }
  }
</script>

<div class="flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
  <div class="w-full max-w-xl">
    <Card className="shadow-card" status="warning">
      <div class="space-y-4">
        <h1 class="text-2xl font-semibold text-content-primary">{heading}</h1>
        <p class="text-sm text-content-secondary">
          Too many failed sign-in attempts were detected for <span class="font-semibold">{email}</span>.
        </p>
        {#if until}
          <p class="text-sm text-content-secondary">Lockout ends at {until.toLocaleString()}.</p>
        {/if}
        <div class="flex flex-wrap gap-3">
          <a class="btn btn-base btn-primary" href="/auth/login">Back to sign in</a>
        </div>
      </div>

      {#if supportRequired}
        <form class="mt-8 space-y-4 border-t border-border-subtle pt-6" on:submit|preventDefault={submitSupportRequest}>
          <h2 class="text-lg font-semibold text-content-primary">Contact support</h2>
          <p class="text-sm text-content-secondary">
            If you still need access today, send a short message and an admin will follow up.
          </p>
          <div class="form-field">
            <label class="form-label" for="support-message">Message</label>
            <textarea
              id="support-message"
              class="form-control min-h-28"
              bind:value={message}
              minlength={10}
              maxlength={2000}
              required
            ></textarea>
          </div>
          {#if requestError}
            <p class="form-message" data-state="error">{requestError}</p>
          {/if}
          {#if requestSuccess}
            <p class="form-message" data-state="success">{requestSuccess}</p>
          {/if}
          <button class="btn btn-base btn-secondary" type="submit" disabled={sending}>
            {sending ? 'Sending...' : 'Send support request'}
          </button>
        </form>
      {/if}
    </Card>
  </div>
</div>
