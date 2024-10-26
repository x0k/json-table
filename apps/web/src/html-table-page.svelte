<script lang="ts">
  const { content }: { content: Promise<string> } = $props()
</script>

{#await content}
  <p>Loading...</p>
{:then content}
  <iframe title="table" class="w-full h-screen" srcDoc={content}></iframe>
{:catch error}
  <p class="text-error" >{error}</p>
{/await}
