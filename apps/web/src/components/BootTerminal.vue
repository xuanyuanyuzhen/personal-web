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
 *   不会直接进入页面）；
 * - 全部文字打完后停在终端，出现 `$` 提示符 + 闪烁光标等待输入；
 *   可真实敲入命令（如 clear），回车或点击屏幕进入；
 *   进入时进度条填充，满则整体淡出露出首页。
 *
 * 播放时机由下面两个开关控制，见 `replayEveryVisit` / `respectReducedMotion`。
 */

const SESSION_KEY = 'yuer.boot.played';

/**
 * 是否每次进首页都重播。
 * - `true`：调试开屏动画本身时用，刷新就能再看一遍；
 * - `false`（当前）：同一浏览器会话只播一次，之后刷新直接进首页 ——
 *   调试首页内容时用。想再看一次：关掉标签页重开，或在 DevTools
 *   Application → Session Storage 删掉 `yuer.boot.played`。
 */
const replayEveryVisit = false;

/**
 * 是否尊重系统的「减少动态效果」（prefers-reduced-motion: reduce）。
 * - `false`（当前）：无视该设置照常播放；
 * - `true`：开了减少动态效果就整段跳过（不挂载、不播）。**上线前必须改回 true。**
 *
 * ⚠️ 这两个开关以前是合成一个的（`playWhileDeveloping`），结果「改成只播一次」
 * 会连带把无障碍跳过一起打开。本机 Windows 关了「动画效果」，真实 Chrome 里
 * prefers-reduced-motion 就是 reduce —— 合成一个开关时一翻就变成「一次都不播」，
 * 而不是「只播一次」。所以刻意拆成两个，别再合回去。
 */
const respectReducedMotion = false;

// 打字节奏：20→10 fps 偏快（用户反馈），放慢为 12→7 fps，行间停顿也加长一点。
const INITIAL_FPS = 12;
const MIN_FPS = 7;
const STALL_MS = 200;
const LS_ITEM_STEP = 300;
// 点击「进入页面」后进度条从 0 填到 100 的时长。
const ENTER_ANIM_MS = 1600;
// 出场淡出 600ms，兜底定时器留足余量，避免 transitionend 没触发时提前卸载。
const EXIT_FALLBACK_MS = 800;

// 背景科技线数量：纯装饰，数量克制以保持性能（transform/opacity 合成层动画）。
const RAIN_COUNT = 16;

type RainLine = {
  dur: number;
  x: number;
  h: number;
  delay: number;
  up: boolean;
  pink: boolean;
  thick: boolean;
};

/**
 * 生成背景光条配置：不规律地自上而下 / 自下而上滑动闪烁。
 * 用固定公式生成（确定性，不依赖 Math.random，多次挂载不会抖动）：
 * 约 1/3 自下而上（up），1/4 用站点粉色点缀（pink），少数加粗（thick）。
 */
function buildRainLines(): RainLine[] {
  return Array.from({ length: RAIN_COUNT }, (_, i) => ({
    x: Math.round(((i * 6.7 + 2) % 98) * 10) / 10,
    h: 40 + ((i * 37) % 110),
    dur: Math.round((1.8 + ((i * 0.53) % 1.9)) * 10) / 10,
    // 负延迟：首帧即处于滑动中段，入场就有「已在下/左滑动的雨丝」
    delay: -Math.round(((i * 0.83) % 4.2) * 10) / 10,
    up: i % 3 === 1,
    pink: i % 4 === 2,
    thick: i % 5 === 0,
  }));
}

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
const rainLines = computed(() => buildRainLines());

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

  // 无障碍：开了「减少动态效果」就整段跳过（当前 respectReducedMotion=false，
  // 即照常播放；上线前把它改成 true）。
  if (respectReducedMotion && prefersReducedMotion) {
    isVisible.value = false;
    emit('done');
    return;
  }

  // 同一浏览器会话只播一次：播过就直接进首页，方便调试首页内容。
  if (!replayEveryVisit && sessionStorage.getItem(SESSION_KEY) === '1') {
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

/** 播放完成（开始淡出）时写入会话记忆；replayEveryVisit=true 时不写。 */
function markPlayed() {
  if (replayEveryVisit) {
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
    <!-- 背景科技线：不规律上下滑动闪烁，纯装饰，不挡交互 -->
    <div
      class="boot-rain"
      aria-hidden="true"
    >
      <span
        v-for="(rain, index) in rainLines"
        :key="index"
        class="boot-rain-line"
        :class="{ up: rain.up, pink: rain.pink, thick: rain.thick }"
        :style="{
          left: rain.x + '%',
          height: rain.h + 'px',
          '--dur': rain.dur + 's',
          '--delay': rain.delay + 's',
        }"
      />
    </div>
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
