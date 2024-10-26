<script lang="ts">
  import type { Snippet } from 'svelte';

  const { children, append }: { children: Snippet, append?: Snippet } = $props()
</script>

<div class="flex flex-col gap-4 p-8 max-w-6xl mx-auto">
  <div class="flex items-center gap-4"><h1 class="text-3xl font-bold grow">JSON Table</h1>{@render append?.()}</div>
  {@render children()}
</div>
