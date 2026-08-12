<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from '../composables/useI18n';

/**
 * 首页开屏终端动画。
 *
 * 设计约定（与首页/站点风格对齐）：
 * - 黑底绿字，提示符和光标用站点粉色点缀；
 * - 伪命令行一问一答，最后一行落到站点标语；
 * - 支持 Esc / 回车跳过，尊重 prefers-reduced-motion；
 * - 开发阶段每次进首页都播放（方便反复查看效果）：
 *   见下方 `playWhileDeveloping`，确认效果后改为 false，恢复一次性播放
 *   （届时重新启用 sessionStorage 记忆 key `yuer.boot.played`）；
 * - 动画打完后，整体淡出露出首页。
 */

const SESSION_KEY = 'yuer.boot.played';

/**
 * 开发调试开关：true 时每次进入首页都播放，跳过时不写记忆。
 * 待开屏动画定稿（用户确认不再改动）后改回 false：
 * 将恢复「同一浏览器会话只播一次」。
 */
const playWhileDeveloping = true;

const INITIAL_FPS = 20;
const MIN_FPS = 10;
const STALL_MS = 160;
const LS_ITEM_STEP = 240;
const EXIT_FALLBACK_MS = 500;

const { t } = useI18n();

const emit = defineEmits<{ done: [] }>();

const isVisible = ref(true);
const isLeaving = ref(false);
const lines = ref<string[]>([]);
const activeOutput = ref('');
const typedCount = ref(0);
const hasSkipped = ref(false);
const rootEl = ref<HTMLElement | null>(null);

const hideSkipHint = computed(() => hasSkipped.value || lines.value.length >= 3);

const script = computed(() => buildScript());

let typeTimer: ReturnType<typeof setTimeout> | undefined;
let frame: number | undefined;
let stepIndex = 0;
let startedAt = 0;
let elapsed = 0;

onMounted(() => {
  const prefersReducedMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (prefersReducedMotion) {
    isVisible.value = false;
    emit('done');
    return;
  }

  // 开发调试阶段：不读 sessionStorage 记忆，每次进入首页都播放。
  // 定稿后 `playWhileDeveloping = false`，这里恢复读记忆并跳过已播放的会话。
  if (!playWhileDeveloping && sessionStorage.getItem(SESSION_KEY) === '1') {
    isVisible.value = false;
    emit('done');
    return;
  }

  window.addEventListener('keydown', handleKeydown);
  run();
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown);
  stopTimers();
});

function buildScript() {
  return [
    { command: 'whoami', output: t('terminal.whoami') },
    { command: 'cat welcome.txt', output: t('home.title') },
    { command: 'ls', output: t('terminal.ls') },
  ];
}

function run() {
  startedAt = performance.now();
  frame = requestAnimationFrame(frameLoop);
}

function frameLoop(now: number) {
  const step = script.value[stepIndex];
  if (!step) {
    finish();
    return;
  }

  const delta = now - startedAt;
  startedAt = now;
  elapsed += delta;

  const fps = Math.max(MIN_FPS, INITIAL_FPS - stepIndex * 3);
  const period = 1000 / fps;
  const target = Math.floor(elapsed / period);
  const lastTarget = Math.floor((elapsed - delta) / period);
  const progress = target - lastTarget;

  if (step.command) {
    if (typedCount.value < step.command.length) {
      typedCount.value = Math.min(step.command.length, typedCount.value + progress);
      frame = requestAnimationFrame(frameLoop);
      return;
    }
  } else if (step.output) {
    if (activeOutput.value.length < step.output.length) {
      const nextCount = Math.min(step.output.length, activeOutput.value.length + progress);
      if (nextCount !== activeOutput.value.length) {
        activeOutput.value = step.output.slice(0, nextCount);
      }
      frame = requestAnimationFrame(frameLoop);
      return;
    }
  }

  finish();
}

function finish() {
  if (isLeaving.value || !isVisible.value) {
    return;
  }

  const step = script.value[stepIndex];

  if (step?.output) {
    lines.value = [...lines.value, step.output];
    activeOutput.value = '';
  } else if (step?.command && typedCount.value < step.command.length) {
    typedCount.value = step.command.length;
  }

  scheduleEnd();
}

function scheduleEnd() {
  const nextStep = script.value[stepIndex + 1];

  if (!nextStep) {
    if (script.value[stepIndex]?.output) {
      startExit();
    }
    return;
  }

  // 下一行是命令时，停顿稍长，模拟「敲命令」的节奏；否则只是行间换行。
  const delay = nextStep.command ? 2 * LS_ITEM_STEP + STALL_MS : STALL_MS;

  typeTimer = setTimeout(() => {
    advance();
  }, delay);
}

function advance() {
  if (isLeaving.value || !isVisible.value) {
    return;
  }

  stepIndex += 1;
  const step = script.value[stepIndex];
  if (!step) {
    startExit();
    return;
  }

  if (step.command) {
    typedCount.value = 0;
    elapsed = 0;
    frame = requestAnimationFrame(frameLoop);
    return;
  }

  activeOutput.value = '';
  frame = requestAnimationFrame(frameLoop);
}

function startExit() {
  if (isLeaving.value) {
    return;
  }

  isLeaving.value = true;
  markPlayed();
  stopTimers();

  // 万一 transitionend 没触发（例如浏览器禁用过渡），兜底强制收尾。
  typeTimer = setTimeout(() => {
    emit('done');
  }, EXIT_FALLBACK_MS);
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' || event.key === 'Enter') {
    event.preventDefault();
    skip();
  }
}

function skip() {
  if (!isVisible.value || isLeaving.value) {
    return;
  }

  hasSkipped.value = true;
  stopTimers();
  startExit();
}

function handleTransitionEnd(event: TransitionEvent) {
  if (event.target === rootEl.value && event.propertyName === 'opacity') {
    emit('done');
  }
}

/** 播放完成 / 被跳过时写入会话记忆。仅定稿后（playWhileDeveloping=false）生效。 */
function markPlayed() {
  if (playWhileDeveloping) {
    return;
  }

  try {
    sessionStorage.setItem(SESSION_KEY, '1');
  } catch {
    // sessionStorage 可能被禁用，忽略即可，最坏就是每次会话多播一次。
  }
}

function stopTimers() {
  if (frame !== undefined) {
    cancelAnimationFrame(frame);
    frame = undefined;
  }
  if (typeTimer) {
    clearTimeout(typeTimer);
    typeTimer = undefined;
  }
}
</script>

<template>
  <div
    v-if="isVisible"
    ref="rootEl"
    class="boot-terminal"
    :class="{ 'is-leaving': isLeaving }"
    role="dialog"
    aria-modal="true"
    aria-label="terminal welcome"
    @transitionend="handleTransitionEnd"
  >
    <div
      class="boot-terminal-frame"
      role="document"
    >
      <p
        v-for="(line, index) in lines"
        :key="index"
        class="boot-line"
      >
        {{ line }}
      </p>
      <p
        v-if="script[stepIndex]?.command"
        class="boot-line"
      >
        <span class="boot-prompt-mark">$&nbsp;</span>{{ script[stepIndex].command.slice(0, typedCount) }}
        <span
          class="boot-cursor-block"
          aria-hidden="true"
        >▊</span>
      </p>
      <p
        v-else
        class="boot-line"
      >
        {{ activeOutput }}
        <span
          class="boot-cursor-block"
          aria-hidden="true"
        >▊</span>
      </p>
      <p
        v-if="!hideSkipHint"
        class="boot-skip-hint"
      >
        {{ t('terminal.skip') }}
      </p>
    </div>
  </div>
</template>
