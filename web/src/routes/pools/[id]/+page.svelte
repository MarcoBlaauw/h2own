<script>
  import { tests, members } from '$lib/api';
  import { page } from '$app/stores';
  import { invalidateAll } from '$app/navigation';

  export let data;

  let fc = 0;
  let tc = 0;
  let ph = 0;

  async function handleSubmit() {
    await tests.create($page.params.id, { fc, tc, ph });
    await invalidateAll();
  }

  async function handleRoleChange(userId, role) {
    if (!userId) return;
    await members.update($page.params.id, userId, { role });
    await invalidateAll();
  }

  async function handleRemoveMember(userId) {
    if (!userId) return;
    await members.del($page.params.id, userId);
    await invalidateAll();
  }

  const formatCc = (test) => {
    if (typeof test.totalChlorine !== 'number' || typeof test.freeChlorine !== 'number') {
      return 'N/A';
    }
    const value = Math.max(0, test.totalChlorine - test.freeChlorine);
    return value.toFixed(2);
  };
</script>

<div class="container mx-auto p-4">
  {#if data.pool}
    <h1 class="text-2xl font-bold mb-4">{data.pool.name}</h1>
    <p class="text-lg text-gray-600 mb-4">{data.pool.volumeGallons} gallons</p>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <h2 class="text-xl font-bold mb-4">Members</h2>
        <table class="w-full text-left">
          <thead>
            <tr>
              <th class="py-2">User</th>
              <th class="py-2">Role</th>
              <th class="py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {#if data.pool.members?.length > 0}
              {#each data.pool.members as member}
                <tr class="border-b">
                  <td class="py-2">{member.user?.email ?? 'Unknown user'}</td>
                  <td class="py-2">
                    <select bind:value={member.roleName} on:change={() => handleRoleChange(member.user?.id, member.roleName)}>
                      <option value="owner">Owner</option>
                      <option value="admin">Admin</option>
                      <option value="member">Member</option>
                    </select>
                  </td>
                  <td class="py-2">
                    <button
                      on:click={() => handleRemoveMember(member.user?.id)}
                      class="text-red-500"
                      disabled={!member.user?.id}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              {/each}
            {:else}
              <tr>
                <td colspan="3" class="py-2">No members found.</td>
              </tr>
            {/if}
          </tbody>
        </table>
      </div>
      <div>
        <h2 class="text-xl font-bold mb-4">Tests</h2>
        <ul>
          {#if data.pool.tests?.length > 0}
            {#each data.pool.tests as test}
              <li class="border-b py-2">
                <p>
                  FC: {test.freeChlorine ?? 'N/A'}, TC: {test.totalChlorine ?? 'N/A'}, pH: {test.ph ?? 'N/A'}, CC: {formatCc(test)}
                </p>
                <p class="text-xs text-gray-500">
                  Tested on {new Date(test.testedAt).toLocaleString()} by {test.tester?.email ?? 'Unknown'}
                </p>
              </li>
            {/each}
          {:else}
            <p>No tests found.</p>
          {/if}
        </ul>
      </div>
      <div>
        <h2 class="text-xl font-bold mb-4">Add New Test</h2>
        <form on:submit|preventDefault={handleSubmit}>
          <div class="mb-4">
            <label class="block text-gray-700 text-sm font-bold mb-2" for="fc">
              Free Chlorine (FC)
            </label>
            <input class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" id="fc" type="number" bind:value={fc}>
          </div>
          <div class="mb-4">
            <label class="block text-gray-700 text-sm font-bold mb-2" for="tc">
              Total Chlorine (TC)
            </label>
            <input class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" id="tc" type="number" bind:value={tc}>
          </div>
          <div class="mb-4">
            <label class="block text-gray-700 text-sm font-bold mb-2" for="ph">
              pH
            </label>
            <input class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" id="ph" type="number" bind:value={ph}>
          </div>
          <button class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline" type="submit">
            Add Test
          </button>
        </form>
      </div>
    </div>
  {:else}
    <p>Pool not found.</p>
  {/if}
</div>
