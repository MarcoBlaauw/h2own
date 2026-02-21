<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { goto } from '$app/navigation';
  import { api } from '$lib/api';
  import Container from '$lib/components/layout/Container.svelte';

  export let data;

  type NotificationItem = {
    notificationId: string;
    title: string | null;
    message: string;
    channel: string;
    readAt: string | null;
    createdAt: string;
  };

  let items: NotificationItem[] = data?.notifications?.items ?? [];
  let unreadOnly = Boolean(data?.unreadOnly);
  let page = data?.notifications?.page ?? 1;
  let totalPages = data?.notifications?.totalPages ?? 1;
  let unreadCount = data?.notifications?.unreadCount ?? 0;
  let message: { type: 'error' | 'success'; text: string } | null = null;

  const formatDate = (value: string) => {
    return new Date(value).toLocaleString();
  };

  async function changeFilter(nextUnreadOnly: boolean) {
    await goto(`/notifications?unreadOnly=${nextUnreadOnly ? 'true' : 'false'}&page=1`);
  }

  async function changePage(nextPage: number) {
    await goto(`/notifications?unreadOnly=${unreadOnly ? 'true' : 'false'}&page=${nextPage}`);
  }

  async function markRead(notificationId: string) {
    const res = await api.notifications.read(notificationId);
    if (!res.ok) {
      message = { type: 'error', text: 'Unable to mark notification as read.' };
      return;
    }

    items = items.map((item) =>
      item.notificationId === notificationId ? { ...item, readAt: new Date().toISOString() } : item
    );
    unreadCount = Math.max(0, unreadCount - 1);
    await invalidateAll();
  }

  async function markAllRead() {
    const res = await api.notifications.readAll();
    if (!res.ok) {
      message = { type: 'error', text: 'Unable to mark all notifications as read.' };
      return;
    }
    items = items.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() }));
    unreadCount = 0;
    message = { type: 'success', text: 'All notifications marked as read.' };
    await invalidateAll();
  }
</script>

<Container>
  <section class="mx-auto w-full max-w-4xl space-y-4 py-6">
    <h1 class="text-2xl font-semibold text-content-primary">Notifications</h1>
    <p class="text-sm text-content-secondary">Review unread and historical notifications.</p>

    <div class="flex flex-wrap items-center gap-2">
      <button class={`btn btn-sm ${!unreadOnly ? 'btn-primary' : 'btn-tonal'}`} on:click={() => changeFilter(false)}>
        All
      </button>
      <button class={`btn btn-sm ${unreadOnly ? 'btn-primary' : 'btn-tonal'}`} on:click={() => changeFilter(true)}>
        Unread
      </button>
      <button class="btn btn-sm btn-secondary ml-auto" on:click={markAllRead} disabled={unreadCount === 0}>
        Mark all read
      </button>
    </div>

    {#if message}
      <p class={`text-sm ${message.type === 'success' ? 'text-success' : 'text-danger'}`}>{message.text}</p>
    {/if}

    <div class="surface-panel divide-y divide-border rounded-xl">
      {#if items.length === 0}
        <div class="p-4 text-sm text-content-secondary">No notifications found.</div>
      {:else}
        {#each items as item}
          <div class="p-4">
            <div class="flex items-start justify-between gap-4">
              <div class="space-y-1">
                <h2 class="text-sm font-semibold text-content-primary">{item.title ?? 'Notification'}</h2>
                <p class="text-sm text-content-secondary">{item.message}</p>
                <p class="text-xs text-content-secondary">
                  {item.channel} • {formatDate(item.createdAt)}
                </p>
              </div>
              {#if !item.readAt}
                <button class="btn btn-sm btn-tonal" on:click={() => markRead(item.notificationId)}>Mark read</button>
              {:else}
                <span class="text-xs text-content-secondary">Read</span>
              {/if}
            </div>
          </div>
        {/each}
      {/if}
    </div>

    <div class="flex items-center justify-between">
      <button class="btn btn-sm btn-tonal" on:click={() => changePage(page - 1)} disabled={page <= 1}>Previous</button>
      <p class="text-sm text-content-secondary">Page {page} of {totalPages}</p>
      <button class="btn btn-sm btn-tonal" on:click={() => changePage(page + 1)} disabled={page >= totalPages}>Next</button>
    </div>
  </section>
</Container>
