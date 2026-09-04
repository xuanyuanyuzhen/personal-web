<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

/**
 * 精灵图看板娘：把一张 cols×rows 的 sprite sheet 按帧播放。
 *
 * 渲染方式是「视口裁剪 + transform 位移」而不是 background-position：
 * 图片宽 = cols × 100%（相对视口），所以横向平移 100%/cols 正好是一帧，
 * 纵向平移 100%/rows 正好是一行。百分比位移相对元素自身尺寸，
 * 因此不依赖具体像素，换分辨率（baseline / full 两档）时无需改任何数值。
 *
 * 全程零 JS 动画：帧推进交给 CSS steps()，合成层动画，不占主线程。
 */
const props = defineProps({
  config: {
    required: true,
    type: Object,
  },
  /** 外部驱动的状态名（stand / typing / sleep 等），取不到就落回 idle。 */
  state: {
    default: 'idle',
    type: String,
  },
  /**
   * 插播一遍就回落的动作。传 { id, name } —— id 变化即触发重播，
   * 所以连续抽到同一个动作也能重新播。
   */
  gesture: {
    default: null,
    type: Object,
  },
});

const emit = defineEmits(['error']);

/**
 * 是否尊重系统的「减少动态效果」。
 *
 * 与 BootTerminal.vue 的 respectsReducedMotion() 保持同一约定：绑到构建模式而非
 * 手改常量 —— 本机 Windows 关了动画效果，真实 Chrome 里 prefers-reduced-motion
 * 就是 reduce。若不区分开发/生产，调帧率和帧数时本机永远看不到它动。
 *
 * ⚠️ 这个开关和「是否启用精灵图」是两回事，别合并。合并后本机会退化成一张静止图，
 * 等于开发期完全失去动画反馈 —— 和开屏终端踩过的坑一模一样。
 */
function respectsReducedMotion() {
  return import.meta.env.PROD;
}

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

const cols = computed(() => toPositiveInt(props.config.cols, 8));
const rows = computed(() => toPositiveInt(props.config.rows, 9));
const states = computed(() =>
  props.config.states && typeof props.config.states === 'object' ? props.config.states : {},
);

const idleState = computed(() => normalizeState(states.value.idle, 0));

/**
 * 水平镜像。
 *
 * ⚠️ 翻转必须作用在外层视口（.sprite-mascot）而不是 sheet 图片本身：
 * 图片的 transform 正被逐帧位移占用，再叠一个 scaleX(-1) 会连 translateX 的方向
 * 一起取反，帧序会乱。翻外层则只镜像最终画面，位移数学不受影响。
 */
const flipX = computed(() => props.config.flipX === true);

/** 静止模式：只渲染当前状态的首帧，不挂任何动画。 */
const motionless = ref(false);
/** 点击反应是临时插播：播完清空，落回外部驱动的状态。 */
const transient = ref('');
/** 强制重启动画用的自增键：换状态或连点时靠换 key 让元素重挂载。 */
const runId = ref(0);

const activeName = computed(() => transient.value || props.state || 'idle');
const activeState = computed(() => {
  const raw = states.value[activeName.value];

  return raw ? normalizeState(raw, idleState.value.row) : idleState.value;
});

/** 单帧状态（比如定格的睡姿）不挂动画，直接摆到那一帧。 */
const animated = computed(() => !motionless.value && activeState.value.frames > 1);

const currentSrc = ref(props.config.spriteUrl || '');

const styleVars = computed(() => ({
  '--sprite-cols': String(cols.value),
  '--sprite-rows': String(rows.value),
  '--sprite-row': String(activeState.value.row),
  '--sprite-offset': String(activeState.value.offset),
  '--sprite-frames': String(activeState.value.frames),
  '--sprite-dur': `${activeState.value.frames / activeState.value.fps}s`,
}));

// 换状态要重挂载元素，否则 CSS 动画会带着旧进度继续跑，看起来像跳帧。
watch(activeName, () => {
  runId.value += 1;
});

// 待机小动作：插播一遍即回落，靠 id 变化触发（连续抽到同一个动作也能重播）。
watch(
  () => props.gesture?.id,
  (id) => {
    if (!id || motionless.value) {
      return;
    }

    const name = props.gesture?.name;
    if (!name || !states.value[name]) {
      return;
    }

    transient.value = name;
    runId.value += 1;
  },
);

onMounted(() => {
  if (!props.config.spriteUrl) {
    emit('error', new Error('sprite mascot: 缺少 spriteUrl'));
    return;
  }

  motionless.value = respectsReducedMotion() && prefersReducedMotion();
  maybeUpgradeToFullSheet();
});

let upgradeImage = null;

onBeforeUnmount(() => {
  // 升级图可能还在下载，断开回调避免卸载后仍写 currentSrc。
  if (upgradeImage) {
    upgradeImage.onload = null;
    upgradeImage.onerror = null;
    upgradeImage = null;
  }
});

/**
 * 渐进升级：baseline 已经显示后，后台悄悄拉高清图，到了再换 src。
 *
 * 不做「先测网速再决定加载哪张」——Safari / Firefox 没有 Network Information API，
 * 探测方案在那儿只能瞎猜。渐进升级则天然降级：慢网只是升级得晚，首屏不受影响。
 */
function maybeUpgradeToFullSheet() {
  const fullUrl = props.config.spriteUrlFull;
  if (!fullUrl || fullUrl === currentSrc.value) {
    return;
  }

  const connection = typeof navigator === 'undefined' ? null : navigator.connection;
  if (connection) {
    if (connection.saveData === true) {
      return;
    }
    if (connection.effectiveType === '2g' || connection.effectiveType === 'slow-2g') {
      return;
    }
  }

  upgradeImage = new Image();
  upgradeImage.onload = () => {
    currentSrc.value = fullUrl;
    upgradeImage = null;
  };
  upgradeImage.onerror = () => {
    // 升级失败无所谓，baseline 已经在显示了，静默保持现状。
    upgradeImage = null;
  };
  upgradeImage.src = fullUrl;
}

function react() {
  if (motionless.value || !states.value.react) {
    return;
  }

  transient.value = 'react';
  runId.value += 1;
}

function handleAnimationEnd() {
  transient.value = '';
}

function normalizeState(raw, fallbackRow) {
  const state = raw && typeof raw === 'object' ? raw : {};
  const offset = clamp(toPositiveInt(state.offset, 0, true), 0, Math.max(0, cols.value - 1));

  return {
    row: clamp(toPositiveInt(state.row, fallbackRow, true), 0, Math.max(0, rows.value - 1)),
    offset,
    // 帧数从 offset 起算，别越过该行末尾，否则会播到下一行的画面上去。
    frames: clamp(toPositiveInt(state.frames, cols.value - offset), 1, cols.value - offset),
    // 默认 8fps：sprite sheet 的一行若是「带中间帧的循环动作」（走路、待机浮动），
    // 帧率低了会顿成幻灯片；反过来若那一行其实是几个独立姿势/表情的集锦，
    // 再高的帧率也接不连贯，那种行本就不该拿来做循环。
    fps: clamp(toPositiveInt(state.fps, 8), 1, 60),
  };
}

function toPositiveInt(value, fallback, allowZero = false) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  const rounded = Math.round(parsed);

  return allowZero ? Math.max(0, rounded) : Math.max(1, rounded);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

defineExpose({ react });
</script>

<template>
  <div
    class="sprite-mascot"
    :class="{ 'is-flipped': flipX }"
    :style="styleVars"
    aria-hidden="true"
  >
    <img
      :key="runId"
      class="sprite-mascot-sheet"
      :class="{
        'is-static': !animated,
        'is-animated': animated,
        'is-once': Boolean(transient),
      }"
      :src="currentSrc"
      alt=""
      draggable="false"
      @animationend="handleAnimationEnd"
      @error="emit('error', new Error('sprite mascot: 图片加载失败'))"
    >
  </div>
</template>
