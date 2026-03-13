<script lang="ts">
  import { goto } from '$app/navigation';
  import { api } from '$lib/api';
  import Container from '$lib/components/layout/Container.svelte';

  export let data: any;

  type Thread = {
    threadId: string;
    subject?: string | null;
    lastMessageBody?: string | null;
    unreadCount?: number;
  };

  type Message = {
    messageId: number | string;
    senderUserId: string;
    body: string;
    createdAt: string;
    optimistic?: boolean;
    failed?: boolean;
  };

  const currentUserId: string = data?.session?.user?.id ?? '';
  let threads: Thread[] = data?.threads?.items ?? [];
  let selectedThreadId: string | null = data?.selectedThreadId ?? null;
  let thread = data?.threadPayload?.thread ?? null;
  let messages: Message[] = data?.threadPayload?.messages?.items ?? [];
  let composerBody = '';
  let loading = false;
  let error = '';

  const formatDate = (value: string) => new Date(value).toLocaleString();

  async function selectThread(threadId: string) {
    selectedThreadId = threadId;
    await goto(`/messages?threadId=${threadId}`);
  }

  async function sendMessage() {
    if (!selectedThreadId || !composerBody.trim()) return;
    const optimisticId = `tmp-${Date.now()}`;
    const optimistic: Message = {
      messageId: optimisticId,
      senderUserId: currentUserId,
      body: composerBody.trim(),
      createdAt: new Date().toISOString(),
      optimistic: true,
      failed: false,
    };

    messages = [optimistic, ...messages];
    const payload = composerBody.trim();
    composerBody = '';
    loading = true;
    error = '';

    const res = await api.messages.sendMessage(selectedThreadId, { body: payload });
    if (!res.ok) {
      messages = messages.map((item) => (item.messageId === optimisticId ? { ...item, failed: true } : item));
      error = 'Unable to send message. Retry from failed message.';
      loading = false;
      return;
    }

    const sent = await res.json();
    messages = messages.map((item) =>
      item.messageId === optimisticId
        ? {
            messageId: sent.message.messageId,
            senderUserId: sent.message.senderUserId,
            body: sent.message.body,
            createdAt: sent.message.createdAt,
          }
        : item
    );

    loading = false;
  }

  async function retryMessage(message: Message) {
    composerBody = message.body;
    messages = messages.filter((item) => item.messageId !== message.messageId);
    await sendMessage();
  }
</script>

<Container>
  <section class="mx-auto grid w-full max-w-6xl gap-4 py-6 lg:grid-cols-[320px,1fr]">
    <aside class="surface-panel rounded-xl p-3">
      <h1 class="mb-3 text-xl font-semibold text-content-primary">Inbox</h1>
      <div class="space-y-2">
        {#if threads.length === 0}
          <p class="text-sm text-content-secondary">No threads yet.</p>
        {:else}
          {#each threads as item}
            <button class={`w-full rounded-lg border p-3 text-left ${selectedThreadId === item.threadId ? 'border-primary' : 'border-border'}`} on:click={() => selectThread(item.threadId)}>
              <p class="text-sm font-semibold text-content-primary">{item.subject ?? 'Conversation'}</p>
              <p class="line-clamp-2 text-xs text-content-secondary">{item.lastMessageBody ?? 'No messages yet'}</p>
              {#if item.unreadCount}
                <span class="text-xs text-primary">{item.unreadCount} unread</span>
              {/if}
            </button>
          {/each}
        {/if}
      </div>
    </aside>

    <div class="surface-panel flex min-h-[500px] flex-col rounded-xl p-3">
      {#if !selectedThreadId}
        <p class="text-sm text-content-secondary">Select a thread to view messages.</p>
      {:else}
        <header class="mb-3 border-b border-border pb-2">
          <h2 class="text-lg font-semibold text-content-primary">{thread?.subject ?? 'Conversation'}</h2>
        </header>

        <div class="flex-1 space-y-2 overflow-y-auto">
          {#if messages.length === 0}
            <p class="text-sm text-content-secondary">No messages yet.</p>
          {:else}
            {#each messages as msg}
              <div class="rounded-lg border border-border p-2">
                <p class="text-sm text-content-primary">{msg.body}</p>
                <p class="text-xs text-content-secondary">{formatDate(msg.createdAt)}</p>
                {#if msg.failed}
                  <button class="btn btn-xs btn-tonal mt-1" on:click={() => retryMessage(msg)}>Retry</button>
                {/if}
              </div>
            {/each}
          {/if}
        </div>

        <form class="mt-3 flex gap-2" on:submit|preventDefault={sendMessage}>
          <input class="input input-bordered w-full" placeholder="Write a message" bind:value={composerBody} />
          <button class="btn btn-primary" type="submit" disabled={loading || !composerBody.trim()}>Send</button>
        </form>
        {#if error}
          <p class="mt-2 text-sm text-danger">{error}</p>
        {/if}
      {/if}
    </div>
  </section>
</Container>
