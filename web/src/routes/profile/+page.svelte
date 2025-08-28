<script lang="ts">
  export let data;
</script>

<div class="container mx-auto p-4">
  <h1 class="text-2xl font-bold">Profile</h1>
  {#if data.user}
    <p>Welcome, {data.user.name}!</p>
    <p>Email: {data.user.email}</p>
  {:else}
    <p>You are not logged in.</p>
  {/if}
</div>
