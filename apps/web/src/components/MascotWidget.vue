<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from '../composables/useI18n';
import { useMascotActivity } from '../composables/useMascotActivity';
import { publicApi } from '../services/api';
import SpriteMascot from './SpriteMascot.vue';

const route = useRoute();
const { locale, t } = useI18n();
const { activity, idleGesture, lastKeystroke } = useMascotActivity();
const mascot = ref(null);
const activeLine = ref('');
const imageFailed = ref(false);
const spriteFailed = ref(false);
const spriteRef = ref(null);
let requestSequence = 0;

const pageKey = computed(() => resolvePageKey(route.name));
const visible = computed(() => Boolean(mascot.value));
const spriteConfig = computed(() => {
  const modelConfig = mascot.value?.modelConfig;
  if (!modelConfig || typeof modelConfig !== 'object') {
    return null;
  }
  if (
    modelConfig.renderer !== 'sprite' ||
    typeof modelConfig.spriteUrl !== 'string' ||
    !modelConfig.spriteUrl
  ) {
    return null;
  }
  if (spriteFailed.value) {
    return null;
  }

  return modelConfig;
});

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
    // 图片失败是每次请求重置的：换了 imageUrl 就该重试一次。
    // spriteFailed 刻意不重置 —— 精灵图加载失败通常是资源本身有问题（404、格式错），
    // 每次切路由都重试只会反复拉同一张失败的图，回退到 imageUrl 更稳。
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

function handleFigureClick() {
  showRandomLine();
  spriteRef.value?.react();
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
    <!-- 键帽只在有精灵图时出现：兜底静态图没有「打字」这个状态，单弹键帽会很突兀 -->
    <div
      v-if="spriteConfig && lastKeystroke"
      :key="lastKeystroke.id"
      class="mascot-keycap"
      aria-hidden="true"
    >
      {{ lastKeystroke.label }}
    </div>
    <button
      class="mascot-figure-button"
      :class="{ 'is-sprite': Boolean(spriteConfig) }"
      type="button"
      :aria-label="t('mascot.label')"
      @click="handleFigureClick"
    >
      <SpriteMascot
        v-if="spriteConfig"
        ref="spriteRef"
        :config="spriteConfig"
        :state="activity"
        :gesture="idleGesture"
        @error="spriteFailed = true"
      />
      <img
        v-else-if="mascot?.imageUrl && !imageFailed"
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
