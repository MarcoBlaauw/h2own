<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import Container from '$lib/components/layout/Container.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import { api } from '$lib/api';

  let state: 'loading' | 'success' | 'error' = 'loading';
  let message = 'Verifying email change...';

  onMount(async () => {
    const token = $page.url.searchParams.get('token');
    if (!token) {
      state = 'error';
      message = 'Missing verification token.';
      return;
    }

    try {
      const res = await api.auth.verifyEmailChange({ token });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        state = 'error';
        message = body.message ?? body.error ?? 'Unable to verify email change.';
        return;
      }

      state = 'success';
      message = body.message ?? 'Email address verified and updated.';
    } catch (error) {
      state = 'error';
      message = 'Unable to verify email change.';
    }
  });
</script>

<Container>
  <section class="mx-auto w-full max-w-xl py-10">
    <Card>
      <h1 class="text-xl font-semibold text-content-primary">Email verification</h1>
      <p class={`mt-3 text-sm ${state === 'success' ? 'text-success' : state === 'error' ? 'text-danger' : 'text-content-secondary'}`}>
        {message}
      </p>
      <div class="mt-5">
        <a href="/auth/login" class="btn btn-primary">Back to login</a>
      </div>
    </Card>
  </section>
</Container>
