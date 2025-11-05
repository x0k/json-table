import { MediaQuery } from "svelte/reactivity";

import { Theme, type DarkOrLight } from "@/lib/theme";

export interface ThemeManager {
  theme: Theme;
  readonly darkOrLight: DarkOrLight;
  readonly isDark: boolean;
  sync: () => void;
}

function createThemeManager(
  get: () => Theme | undefined,
  set: (theme: Theme) => void,
  sync: (manager: ThemeManager) => void
) {
  const preferredColorSchemeQuery = new MediaQuery(
    "(prefers-color-scheme: dark)"
  );
  let theme = $state(get() ?? Theme.System);
  const darkOrLight = $derived(
    theme === Theme.System
      ? preferredColorSchemeQuery.current
        ? Theme.Dark
        : Theme.Light
      : theme
  );
  const isDark = $derived(darkOrLight === Theme.Dark);
  const manager = {
    sync() {
      sync(manager);
    },
    get theme() {
      return theme;
    },
    set theme(v) {
      theme = v;
      set(v);
      sync(manager);
    },
    get darkOrLight() {
      return darkOrLight;
    },
    get isDark() {
      return isDark;
    },
    set isDark(v) {
      manager.theme = v ? Theme.Dark : Theme.Light;
    },
  } satisfies ThemeManager;
  return manager;
}

export function createDumbThemeManager(theme: Theme): ThemeManager {
  const isDark = theme === Theme.Dark;
  return {
    theme,
    isDark,
    darkOrLight: isDark ? Theme.Dark : Theme.Light,
    sync() {},
  };
}

export let themeManager: ThemeManager = createDumbThemeManager(Theme.Light);

$effect.root(() => {
  themeManager = createThemeManager(
    () => (localStorage.getItem("theme") as Theme) || undefined,
    (theme) => localStorage.setItem("theme", theme),
    (m) => {
      document.documentElement.dataset.theme = m.isDark ? "dim" : "light";
    }
  );
});
