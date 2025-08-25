<script>
  // Placeholder for H2Own SvelteKit app
</script>

<svelte:head>
  <title>H2Own - Pool Chemistry Management</title>
</svelte:head>

<main class="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 p-6">
  <div class="max-w-4xl mx-auto text-center">
    <div class="mb-8">
      <h1 class="text-4xl font-bold text-blue-900 mb-2 flex items-center justify-center gap-3">
        <svg class="w-10 h-10 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732L14.146 12.8l-1.179 4.456a1 1 0 01-1.934 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732L9.854 7.2l1.179-4.456A1 1 0 0112 2z" clip-rule="evenodd" />
        </svg>
        H2Own
      </h1>
      <p class="text-blue-700 text-lg">Smart Pool Chemistry Advisor</p>
    </div>

    <div class="bg-white rounded-lg shadow-lg p-8 mb-8">
      <h2 class="text-2xl font-semibold text-gray-800 mb-4">Welcome to H2Own</h2>
      <p class="text-gray-600 mb-6">
        Your intelligent pool chemistry management system is being built.
      </p>
      
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
        <div class="bg-blue-50 p-4 rounded-lg">
          <h3 class="font-semibold text-blue-800">Smart Testing</h3>
          <p class="text-blue-600 text-sm">Track water chemistry with precision</p>
        </div>
        <div class="bg-green-50 p-4 rounded-lg">
          <h3 class="font-semibold text-green-800">AI Recommendations</h3>
          <p class="text-green-600 text-sm">Get personalized chemical dosing advice</p>
        </div>
        <div class="bg-purple-50 p-4 rounded-lg">
          <h3 class="font-semibold text-purple-800">Cost Tracking</h3>
          <p class="text-purple-600 text-sm">Monitor maintenance expenses</p>
        </div>
      </div>
    </div>

    <div class="text-sm text-gray-500">
      <p>API Status: 
        <span class="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
          ✓ Connected
        </span>
      </p>
    </div>
  </div>
</main>
