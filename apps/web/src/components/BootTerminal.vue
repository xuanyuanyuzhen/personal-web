<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from '../composables/useI18n';

/**
 * 首页开屏终端动画。
 *
 * 设计约定（与首页/站点风格对齐）：
 * - 黑底绿字，提示符和光标用站点粉色点缀；
 * - 伪命令行一问一答，最后一行落到站点标语；
 * - 打字阶段按回车 / Esc 跳过剩余文字（直接落到「等待输入」提示符，
 *   不会直接进入页面），尊重 prefers-reduced-motion（定稿后生效；
 *   开发阶段无视它，保证能反复查看效果）；
 * - 开发阶段每次进首页都播放（方便反复查看效果）：
 *   见下方 `playWhileDeveloping`，确认效果后改为 false，恢复一次性播放
 *   （届时重新启用 sessionStorage 记忆 key `yuer.boot.played`）；
 * - 全部文字打完后停在终端，出现 `$` 提示符 + 闪烁光标等待输入；
 *   可真实敲入命令（如 clear），回车或点击屏幕进入；
 *   进入时进度条填充，满则整体淡出露出首页。
 */

const SESSION_KEY = 'yuer.boot.played';

/**
 * 开发调试开关：true 时每次进入首页都播放，跳过时不写记忆。
 * 待开屏动画定稿（用户确认不再改动）后改回 false：
 * 将恢复「同一浏览器会话只播一次」。
 */
const playWhileDeveloping = true;

// 打字节奏：20→10 fps 偏快（用户反馈），放慢为 12→7 fps，行间停顿也加长一点。
const INITIAL_FPS = 12;
const MIN_FPS = 7;
const STALL_MS = 200;
const LS_ITEM_STEP = 300;
// 点击「进入页面」后进度条从 0 填到 100 的时长。
const ENTER_ANIM_MS = 1600;
// 出场淡出 600ms，兜底定时器留足余量，避免 transitionend 没触发时提前卸载。
const EXIT_FALLBACK_MS = 800;

const { t } = useI18n();

const emit = defineEmits<{ done: []; leave: [] }>();

const isVisible = ref(true);
const isLeaving = ref(false);
const lines = ref<string[]>([]);
const activeOutput = ref('');
const typedCount = ref(0);
// 全部文字打完：停在终端，显示底部「进入页面」按钮。
const scriptDone = ref(false);
// 点过「进入页面」：进度条开始填充。
const isEntering = ref(false);
const progress = ref(0);
// 打完文字后等待输入的命令（如 clear）。
const typedCommand = ref('');
const rootEl = ref<HTMLElement | null>(null);

const hideSkipHint = computed(() => lines.value.length >= 3);

const script = computed(() => buildScript());

let typeTimer: ReturnType<typeof setTimeout> | undefined;
let frame: number | undefined;
let stepIndex = 0;
let startedAt = 0;
let elapsed = 0;
let progressElapsed = 0;

onMounted(() => {
  const prefersReducedMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 开发调试阶段：无视 reduced-motion，确保开发者能反复查看动画效果。
  // ⚠️ 曾遇到真实环境「刷新看不到动画」：Windows 系统关了「动画效果」
  // 后，真实浏览器 prefers-reduced-motion 为 reduce，旧逻辑直接跳过不播。
  // 定稿后（playWhileDeveloping=false）恢复无障碍行为：系统/浏览器开启
  // 「减少动态效果」时跳过不播。
  if (!playWhileDeveloping && prefersReducedMotion) {
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
  if (isLeaving.value || !isVisible.value || scriptDone.value) {
    return;
  }

  const step = script.value[stepIndex];

  if (step?.output) {
    lines.value = [...lines.value, step.output];
    activeOutput.value = '';
  } else if (step?.command && typedCount.value < step.command.length) {
    typedCount.value = step.command.length;
  }

  scheduleNext();
}

function scheduleNext() {
  const nextStep = script.value[stepIndex + 1];

  if (!nextStep) {
    // 全部文字打完：停在终端，显示底部「进入页面」按钮，等用户点击。
    scriptDone.value = true;
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
  // 终端开始淡出，通知 App 同步启动首页「上浮浮现」动画，形成交叉过渡。
  emit('leave');
  markPlayed();
  stopTimers();

  // 万一 transitionend 没触发（例如浏览器禁用过渡），兜底强制收尾。
  typeTimer = setTimeout(() => {
    emit('done');
  }, EXIT_FALLBACK_MS);
}

/** 点击「进入页面」：进度条 0 → 100 填充，填满后淡出进入首页。 */
function enterSite() {
  if (!scriptDone.value || isEntering.value || isLeaving.value) {
    return;
  }

  isEntering.value = true;
  progressElapsed = 0;
  startedAt = performance.now();
  frame = requestAnimationFrame(progressLoop);
}

function progressLoop(now: number) {
  const delta = now - startedAt;
  startedAt = now;
  progressElapsed += delta;

  progress.value = Math.min(100, Math.floor((progressElapsed / ENTER_ANIM_MS) * 100));

  if (progress.value >= 100) {
    startExit();
    return;
  }

  frame = requestAnimationFrame(progressLoop);
}

/**
 * 提交等待阶段的命令：只认 `clear`（进入）；空回车不发任何事，
 * 其他命令回显 `command not found` 并清空输入，避免「不输命令也能进」。
 */
function submitCommand() {
  if (!scriptDone.value || isEntering.value || isLeaving.value) {
    return;
  }

  const cmd = typedCommand.value.trim();

  if (cmd === 'clear') {
    enterSite();
    return;
  }

  if (cmd) {
    lines.value = [...lines.value, t('terminal.commandNotFound').replace('{cmd}', cmd)];
    typedCommand.value = '';
    return;
  }

  // 空输入：什么都不做，点击屏幕才是直接进入的方式。
}

function handleKeydown(event: KeyboardEvent) {
  if (scriptDone.value) {
    // 打完文字后的「等待输入」阶段：回车提交命令（仅 clear 进入），
    // 其余按键作为命令输入。点击屏幕则直接进入（见根元素 @click）。
    if (event.key === 'Enter') {
      event.preventDefault();
      submitCommand();
      return;
    }
    appendCommandInput(event);
    return;
  }

  // 打字播放阶段：回车 / Esc 跳过剩余文字，直接落到「等待输入」提示符。
  // 注意：这里只会快进文字，不会直接进入页面——
  // 进入只能通过点击屏幕，或输入 clear 后回车。
  if (event.key === 'Enter' || event.key === 'Escape') {
    event.preventDefault();
    skipTyping();
  }
}

/** 打字阶段按回车 / Esc：跳过剩余文字显示，直接落到「等待输入」提示符。 */
function skipTyping() {
  if (scriptDone.value || isLeaving.value || !isVisible.value) {
    return;
  }

  stopTimers();
  lines.value = script.value.map((step) => step.output).filter(Boolean);
  activeOutput.value = '';
  typedCount.value = 0;
  scriptDone.value = true;
}

/** 把可打印字符/退格追加到 `typedCommand`，模拟终端输入。 */
function appendCommandInput(event: KeyboardEvent) {
  if (isEntering.value || isLeaving.value) {
    return;
  }
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return;
  }

  if (event.key === 'Backspace') {
    event.preventDefault();
    typedCommand.value = typedCommand.value.slice(0, -1);
    return;
  }

  // 单字符可打印键（排除 Direction/Dead/Process 等控制类 key）。
  if (event.key.length === 1) {
    event.preventDefault();
    typedCommand.value = (typedCommand.value + event.key).slice(0, 40);
  }
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
    @click="enterSite"
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
        v-if="!scriptDone && script[stepIndex]?.command"
        class="boot-line"
      >
        <span class="boot-prompt-mark">$&nbsp;</span>{{ script[stepIndex].command.slice(0, typedCount) }}
        <span
          class="boot-cursor-block"
          aria-hidden="true"
        >▊</span>
      </p>
      <p
        v-else-if="!scriptDone"
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
      <p
        v-if="scriptDone && !isEntering"
        class="boot-line boot-enter-prompt"
      >
        <span class="boot-prompt-mark">$&nbsp;</span>{{ typedCommand }}
        <span
          class="boot-cursor-block"
          aria-hidden="true"
        >▊</span>
      </p>
      <p
        v-if="scriptDone && !isEntering"
        class="boot-enter-hint"
      >
        {{ t('terminal.enterHint') }}
      </p>
      <div
        v-if="scriptDone && isEntering"
        class="boot-enter"
      >
        <div
          class="boot-progress"
          role="progressbar"
          aria-label="enter site"
          :aria-valuenow="progress"
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <span
            class="boot-progress-fill"
            :style="{ width: progress + '%' }"
          />
        </div>
      </div>
    </div>
  </div>
</template>
