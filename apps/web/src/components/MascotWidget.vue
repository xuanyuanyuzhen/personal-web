<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from '../composables/useI18n';
import { publicApi } from '../services/api';

const route = useRoute();
const { t } = useI18n();
const mascot = ref(null);
const activeLine = ref('');
const imageFailed = ref(false);

const pageKey = computed(() => resolvePageKey(route.name));
const visible = computed(() => Boolean(mascot.value));

onMounted(loadMascot);

watch(
  () => route.fullPath,
  () => {
    loadMascot();
  },
);

async function loadMascot() {
  try {
    const nextMascot = await publicApi.getMascot(pageKey.value);
    mascot.value = isValidMascot(nextMascot) ? nextMascot : null;
    imageFailed.value = false;
    activeLine.value = mascot.value?.pageLine?.content ?? mascot.value?.name ?? '';
  } catch {
    mascot.value = null;
    activeLine.value = '';
  }
}

function showRandomLine() {
  const lines = mascot.value?.randomLines ?? [];
  if (lines.length === 0) {
    return;
  }

  const totalWeight = lines.reduce((total, line) => total + Math.max(1, Number(line.weight) || 1), 0);
  let cursor = Math.random() * totalWeight;

  for (const line of lines) {
    cursor -= Math.max(1, Number(line.weight) || 1);
    if (cursor <= 0) {
      activeLine.value = line.content;
      return;
    }
  }

  activeLine.value = lines.at(-1)?.content ?? activeLine.value;
}

function resolvePageKey(routeName) {
  if (routeName === 'thoughts') {
    return 'thoughts';
  }
  if (routeName === 'essays') {
    return 'essays';
  }
  if (routeName === 'essay-detail') {
    return 'essay-detail';
  }
  if (routeName === 'photos') {
    return 'photos';
  }
  if (routeName === 'messages') {
    return 'messages';
  }
  if (routeName === 'search') {
    return 'search';
  }
  if (routeName === 'about') {
    return 'about';
  }
  if (routeName === 'custom-page') {
    return 'custom-page';
  }

  return 'home';
}

function isValidMascot(value) {
  return Boolean(value && typeof value.name === 'string' && Array.isArray(value.randomLines));
}
</script>

<template>
  <aside
    v-if="visible"
    class="mascot-widget"
    :aria-label="t('mascot.label')"
  >
    <div class="mascot-bubble">
      {{ activeLine }}
    </div>
    <button
      class="mascot-figure-button"
      type="button"
      :aria-label="t('mascot.label')"
      @click="showRandomLine"
    >
      <img
        v-if="mascot?.imageUrl && !imageFailed"
        :src="mascot.imageUrl"
        :alt="mascot.name"
        @error="imageFailed = true"
      >
      <span
        v-else
        class="mascot-placeholder"
        aria-hidden="true"
      />
    </button>
  </aside>
</template>
