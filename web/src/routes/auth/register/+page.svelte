<script lang="ts">
  import { api } from '$lib/api';
  import { goto } from '$app/navigation';

  let name = '';
  let email = '';
  let password = '';
  let error = '';

  async function handleSubmit() {
    const res = await api.auth.register({ name, email, password });
    if (res.ok) {
      await goto('/auth/login');
    } else {
      const data = await res.json();
      error = data.message;
    }
  }
</script>

<div class="flex-grow flex items-center justify-center">
  <div class="w-full max-w-md">
    <form class="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4" on:submit|preventDefault={handleSubmit}>
      <div class="mb-4">
        <label class="block text-gray-700 text-sm font-bold mb-2" for="name">
          Name
        </label>
        <input class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" id="name" type="text" placeholder="Name" bind:value={name}>
      </div>
      <div class="mb-4">
        <label class="block text-gray-700 text-sm font-bold mb-2" for="email">
          Email
        </label>
        <input class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" id="email" type="email" placeholder="Email" bind:value={email}>
      </div>
      <div class="mb-6">
        <label class="block text-gray-700 text-sm font-bold mb-2" for="password">
          Password
        </label>
        <input class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline" id="password" type="password" placeholder="******************" bind:value={password}>
      </div>
      {#if error}
        <p class="text-red-500 text-xs italic">{error}</p>
      {/if}
      <div class="flex items-center justify-between">
        <button class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline" type="submit">
          Register
        </button>
        <a class="inline-block align-baseline font-bold text-sm text-blue-500 hover:text-blue-800" href="/auth/login">
          Login
        </a>
      </div>
    </form>
  </div>
</div>
