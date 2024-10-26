<script lang="ts">
  let { theme = $bindable() }: { theme: "system" | "light" | "dark" } =
    $props();

  let darkOrLight = $derived(
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme
  );

  const checked = {
    get value() {
      return darkOrLight === "dark";
    },
    set value(v) {
      theme = v ? "dark" : "light";
    },
  };

  function updateTheme() {
    if (
      localStorage.theme === "dark" ||
      (!("theme" in localStorage) &&
        window.matchMedia("(prefers-color-scheme: dark)").matches)
    ) {
      document.documentElement.dataset.theme = "dark";
    } else {
      document.documentElement.dataset.theme = "light";
    }
  }
</script>

<!-- <select
  bind:value={theme}
  onchange={() => {
    if (theme === "system") {
      localStorage.removeItem("theme");
    } else {
      localStorage.theme = theme;
    }
    updateTheme();
  }}
>
  <option value="system">System</option>
  <option value="light">Light</option>
  <option value="dark">Dark</option>
</select> -->
<label class="flex cursor-pointer gap-2">
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <circle cx="12" cy="12" r="5" />
    <path
      d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"
    />
  </svg>
  <input
    type="checkbox"
    class="toggle"
    bind:checked={checked.value}
    onchange={() => {
      if (theme === "system") {
        localStorage.removeItem("theme");
      } else {
        localStorage.theme = theme;
      }
      updateTheme();
    }}
  />
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
  </svg>
</label>
