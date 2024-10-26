<script lang="ts">
  import { makeDownloadFileByUrl } from "@/lib/file";

  import Layout from "./layout.svelte";

  const { title, content }: { title: string; content: Promise<string> } =
    $props();
</script>

<Layout>
  <div class="flex flex-col gap-2">
    <button
      class="btn btn-primary w-full"
      onclick={() => {
        content
          .then((table) => makeDownloadFileByUrl(title)(table))
          .catch((e) => {
            // toast({
            //   title: "Error",
            //   description: String(e),
            //   status: "error",
            // });
            window.alert(String(e))
          });
      }}
    >
      Download table
    </button>
    <button
      class="btn w-full"
      onclick={() => {
        const searchParams = new URLSearchParams(location.search);
        searchParams.set("createOnOpen", "false");
        location.search = searchParams.toString();
      }}
    >
      Create another table
    </button>
  </div>
</Layout>
