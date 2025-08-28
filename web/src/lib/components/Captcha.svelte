<script>
  import { onMount } from 'svelte';

  export let siteKey;

  let iframe;

  onMount(() => {
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
      <html>
        <head>
          <script src="https://js.hcaptcha.com/1/api.js" async defer><\/script>
        </head>
        <body>
          <div class="h-captcha" data-sitekey="${siteKey}"></div>
        </body>
      </html>
    `);
    doc.close();
  });
</script>

<iframe bind:this={iframe} title="captcha" class="w-full h-20 border-0"></iframe>
