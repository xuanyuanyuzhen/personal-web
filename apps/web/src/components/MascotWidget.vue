<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from '../composables/useI18n';
import { publicApi } from '../services/api';

const route = useRoute();
const { locale, t } = useI18n();
const mascot = ref(null);
const activeLine = ref('');
const imageFailed = ref(false);
let requestSequence = 0;

const pageKey = computed(() => resolvePageKey(route.name));
const visible = computed(() => Boolean(mascot.value));

onMounted(loadMascot);

watch(
  () => route.fullPath,
  () => {
    loadMascot();
  },
);

watch(locale, updateActiveLine);

async function loadMascot() {
  const requestId = ++requestSequence;
  const requestedPageKey = pageKey.value;

  try {
    const nextMascot = await publicApi.getMascot(requestedPageKey);
    if (requestId !== requestSequence) {
      return;
    }

    mascot.value = isValidMascot(nextMascot) ? nextMascot : null;
    imageFailed.value = false;
    updateActiveLine();
  } catch {
    if (requestId !== requestSequence) {
      return;
    }

    mascot.value = null;
    activeLine.value = '';
  }
}

function showRandomLine() {
  // 后台配置的台词对所有语言都展示，只有真的没有台词时才回退到内置文案。
  const lines = mascot.value?.randomLines ?? [];
  if (lines.length === 0) {
    activeLine.value = activeLine.value || t('mascot.welcome');
    return;
  }

  const totalWeight = lines.reduce(
    (total, line) => total + Math.max(1, Number(line.weight) || 1),
    0,
  );
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

function updateActiveLine() {
  activeLine.value = mascot.value?.pageLine?.content || mascot.value?.name || t('mascot.welcome');
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
