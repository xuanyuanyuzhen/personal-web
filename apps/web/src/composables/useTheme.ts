import { computed, ref } from 'vue';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'yuer.theme';
const theme = ref<ThemeMode>(readStoredTheme());

function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'light' || value === 'dark';
}

export function readStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'light';
  }

  const storedTheme = window.localStorage.getItem(STORAGE_KEY);
  return isThemeMode(storedTheme) ? storedTheme : 'light';
}

export function applyTheme(mode = theme.value): void {
  if (typeof document === 'undefined') {
    return;
  }

  document.documentElement.dataset.theme = mode;
  document.documentElement.style.colorScheme = mode;
}

export function setTheme(mode: ThemeMode): void {
  theme.value = mode;

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, mode);
  }

  applyTheme(mode);
}

export function toggleTheme(): void {
  setTheme(theme.value === 'dark' ? 'light' : 'dark');
}

export function initTheme(): void {
  setTheme(readStoredTheme());
}

export function useTheme() {
  return {
    isDark: computed(() => theme.value === 'dark'),
    setTheme,
    theme,
    toggleTheme,
  };
}
