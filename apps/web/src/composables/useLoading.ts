import { ref } from 'vue';

const isLoading = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined;

export function setGlobalLoading(nextValue: boolean): void {
  if (timer) {
    clearTimeout(timer);
  }

  if (nextValue) {
    isLoading.value = true;
    return;
  }

  timer = setTimeout(() => {
    isLoading.value = false;
  }, 160);
}

export function useLoading() {
  return {
    isLoading,
    setGlobalLoading,
  };
}
