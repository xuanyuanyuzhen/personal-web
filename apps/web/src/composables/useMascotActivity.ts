import { onBeforeUnmount, onMounted, ref } from 'vue';

/**
 * 看板娘的「当前在干什么」。由页面上的真实操作驱动，而不是随机播动画 ——
 * 桌宠让人觉得活着靠的是它反映真实状态。
 *
 * 默认是站着不动（stand，单帧定格）。唯一的随机成分是待机久了随机做一个小动作
 * （gestureA / gestureB 二选一，播一遍就回到站立），避免同一段循环一直播到让人出戏。
 */
export type MascotActivity = 'sleep' | 'stand' | 'typing';

export type MascotKeystroke = {
  /** 自增序号：连按同一个键时靠它触发重新入场动画 */
  id: number;
  label: string;
};

export type MascotGesture = {
  /** 自增序号：连续抽到同一个动作时靠它触发重播 */
  id: number;
  name: string;
};

/** 待机小动作的候选状态名，每次随机挑一个播一遍。 */
const IDLE_GESTURES = ['gestureA', 'gestureB'] as const;

/** 站定后最少等这么久才做小动作。 */
const GESTURE_MIN_MS = 10000;
/** 站定后最多等这么久就一定做一个小动作。 */
const GESTURE_MAX_MS = 30000;
/** 完全没有操作多久后睡着。 */
const SLEEP_AFTER_MS = 60000;

/** 单独按下的修饰键不该弹键帽。 */
const MODIFIER_KEYS = new Set([
  'Alt',
  'AltGraph',
  'CapsLock',
  'Control',
  'Fn',
  'Meta',
  'NumLock',
  'ScrollLock',
  'Shift',
]);

const KEY_LABELS: Record<string, string> = {
  ' ': '␣',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  Backspace: '⌫',
  Delete: '⌦',
  Enter: '⏎',
  Escape: 'Esc',
  Tab: '⇥',
};

export function useMascotActivity(
  options: { gestureMaxMs?: number; gestureMinMs?: number; sleepAfterMs?: number } = {},
) {
  const gestureMinMs = options.gestureMinMs ?? GESTURE_MIN_MS;
  const gestureMaxMs = options.gestureMaxMs ?? GESTURE_MAX_MS;
  const sleepAfterMs = options.sleepAfterMs ?? SLEEP_AFTER_MS;

  const activity = ref<MascotActivity>('stand');
  const lastKeystroke = ref<MascotKeystroke | null>(null);
  /** 待机小动作是「插播一遍」而不是切状态，所以单独发信号，由组件播完自动回落。 */
  const idleGesture = ref<MascotGesture | null>(null);

  let gestureTimer = 0;
  let sleepTimer = 0;
  let keySequence = 0;
  let gestureSequence = 0;
  /** 焦点是否停在输入框里：打字状态由焦点决定，不靠按键超时。 */
  let editableFocused = false;

  function scheduleGesture() {
    window.clearTimeout(gestureTimer);
    const delay = gestureMinMs + Math.random() * (gestureMaxMs - gestureMinMs);
    gestureTimer = window.setTimeout(() => {
      // 只在真的还站着时才动：打字或睡着时插播动作会打断当前状态。
      if (activity.value === 'stand') {
        gestureSequence += 1;
        idleGesture.value = {
          id: gestureSequence,
          name: IDLE_GESTURES[Math.floor(Math.random() * IDLE_GESTURES.length)],
        };
      }
      scheduleGesture();
    }, delay);
  }

  function scheduleSleep() {
    window.clearTimeout(sleepTimer);
    // 光标还停在输入框里就不该睡着 —— 访客正准备打字，只是手停了一下。
    if (editableFocused) {
      return;
    }

    sleepTimer = window.setTimeout(() => {
      activity.value = 'sleep';
      lastKeystroke.value = null;
      idleGesture.value = null;
    }, sleepAfterMs);
  }

  function wake() {
    if (editableFocused) {
      activity.value = 'typing';
      return;
    }
    if (activity.value === 'sleep') {
      activity.value = 'stand';
    }
    scheduleSleep();
  }

  function handleFocusIn(event: FocusEvent) {
    if (!isEditableTarget(event.target)) {
      return;
    }

    editableFocused = true;
    activity.value = 'typing';
    // 聚焦期间不睡：光标在输入框里就说明访客还在这件事上。
    window.clearTimeout(sleepTimer);
  }

  function handleFocusOut(event: FocusEvent) {
    if (!isEditableTarget(event.target)) {
      return;
    }

    editableFocused = false;
    lastKeystroke.value = null;
    activity.value = 'stand';
    scheduleSleep();
  }

  function handleKeydown(event: KeyboardEvent) {
    wake();

    if (!editableFocused || MODIFIER_KEYS.has(event.key)) {
      return;
    }

    // ⚠️ 密码框一律不回显。键帽是画在屏幕上的，旁边的人、录屏、屏幕共享都能读到，
    // 这跟输入框里的圆点掩码是两回事。
    if (isSecretTarget(event.target)) {
      return;
    }

    keySequence += 1;
    lastKeystroke.value = { id: keySequence, label: labelFor(event.key) };
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeydown);
    window.addEventListener('pointerdown', wake);
    window.addEventListener('pointermove', wake, { passive: true });
    window.addEventListener('scroll', wake, { passive: true });
    // 用 focusin/focusout 而不是 focus/blur：后者不冒泡，挂在 window 上收不到。
    window.addEventListener('focusin', handleFocusIn);
    window.addEventListener('focusout', handleFocusOut);

    // 挂载时焦点可能已经在输入框里（路由切换、浏览器恢复焦点）。
    if (isEditableTarget(document.activeElement)) {
      editableFocused = true;
      activity.value = 'typing';
    }

    scheduleGesture();
    scheduleSleep();
  });

  onBeforeUnmount(() => {
    window.removeEventListener('keydown', handleKeydown);
    window.removeEventListener('pointerdown', wake);
    window.removeEventListener('pointermove', wake);
    window.removeEventListener('scroll', wake);
    window.removeEventListener('focusin', handleFocusIn);
    window.removeEventListener('focusout', handleFocusOut);
    window.clearTimeout(gestureTimer);
    window.clearTimeout(sleepTimer);
  });

  return { activity, idleGesture, lastKeystroke };
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }

  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
}

function isSecretTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement && target.type === 'password';
}

function labelFor(key: string): string {
  const mapped = KEY_LABELS[key];
  if (mapped) {
    return mapped;
  }

  // 单字符键原样显示；其余功能键（F1、PageUp…）显示键名本身，超长则截断。
  return key.length === 1 ? key : key.slice(0, 5);
}
