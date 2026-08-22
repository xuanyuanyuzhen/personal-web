<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { homeQuotes, type HomeQuote } from '../config/quotes';

/**
 * 首页「今日拾语」。
 *
 * 交互约定（用户定稿）：
 * - 文字**直接出现**，没有打字机逐字效果；
 * - 容器预留两行文字的高度，一句从一行变两行时页面不会跟着抖；
 * - 短句排一行、靠左；长句若带逗号则拆成两段，上句左上、下句右下（对仗感）；
 * - 每 6 秒随机换下一句（不与当前重复），换句时淡入淡出。
 */
const props = withDefaults(
  defineProps<{
    quotes?: HomeQuote[];
    holdDuration?: number;
  }>(),
  {
    quotes: () => homeQuotes,
    holdDuration: 6000,
  },
);

// 不超过这个字数就排一行；再长且带逗号才拆成上下两段。
const SINGLE_LINE_MAX = 14;

const activeIndex = ref(0);
let holdTimer: ReturnType<typeof setInterval> | undefined;

const activeQuote = computed<HomeQuote | null>(() => props.quotes[activeIndex.value] ?? null);

// 拆句：在第一个逗号后断开，逗号跟着上半句走。
const segments = computed(() => {
  const text = activeQuote.value?.text ?? '';

  if (Array.from(text).length <= SINGLE_LINE_MAX) {
    return { lead: text, tail: '' };
  }

  const commaIndex = Math.max(text.indexOf('，'), text.indexOf(','));
  if (commaIndex < 0) {
    return { lead: text, tail: '' };
  }

  return {
    lead: text.slice(0, commaIndex + 1),
    tail: text.slice(commaIndex + 1).trim(),
  };
});

onMounted(() => {
  if (props.quotes.length === 0) {
    return;
  }

  activeIndex.value = Math.floor(Math.random() * props.quotes.length);

  if (props.quotes.length > 1) {
    holdTimer = setInterval(nextQuote, props.holdDuration);
  }
});

onBeforeUnmount(() => {
  if (holdTimer !== undefined) {
    clearInterval(holdTimer);
    holdTimer = undefined;
  }
});

function nextQuote() {
  let next = activeIndex.value;
  while (next === activeIndex.value) {
    next = Math.floor(Math.random() * props.quotes.length);
  }

  activeIndex.value = next;
}
</script>

<template>
  <div class="home-quote">
    <Transition name="quote-fade">
      <figure
        v-if="activeQuote"
        :key="activeIndex"
        class="home-quote-body"
      >
        <blockquote class="home-quote-text">
          <span>{{ segments.lead }}</span>
          <span
            v-if="segments.tail"
            class="home-quote-tail"
          >{{ segments.tail }}</span>
        </blockquote>
        <figcaption
          v-if="activeQuote.author"
          class="home-quote-author"
        >
          —— {{ activeQuote.author }}
        </figcaption>
      </figure>
    </Transition>
  </div>
</template>
