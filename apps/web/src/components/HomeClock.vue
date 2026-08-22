<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from '../composables/useI18n';

// 首页时钟卡：左边数字时间，右边表盘（底图由 --clock-face-image 提供）+ 三根指针。
const { locale, t } = useI18n();

const now = ref(new Date());
let tickTimer: ReturnType<typeof setInterval> | undefined;

const localeTags: Record<string, string> = {
  zh: 'zh-CN',
  en: 'en-US',
  ja: 'ja-JP',
};

const timeParts = computed(() => {
  const pad = (value: number) => String(value).padStart(2, '0');

  return {
    hours: pad(now.value.getHours()),
    minutes: pad(now.value.getMinutes()),
    seconds: pad(now.value.getSeconds()),
  };
});

// 指针角度（12 点为 0°，顺时针）。时针和分针都带上更小单位的零头，
// 否则会出现「3 点 59 分时针还死死指着 3」的假表感。
const handAngles = computed(() => {
  const seconds = now.value.getSeconds();
  const minutes = now.value.getMinutes();
  const hours = now.value.getHours() % 12;

  return {
    hour: hours * 30 + minutes * 0.5,
    minute: minutes * 6 + seconds * 0.1,
    second: seconds * 6,
  };
});

const dateLabel = computed(() =>
  now.value.toLocaleDateString(localeTags[locale.value] ?? 'zh-CN', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
  }),
);

const datetimeAttr = computed(() => now.value.toISOString());

onMounted(() => {
  tickTimer = setInterval(() => {
    now.value = new Date();
  }, 1000);
});

onBeforeUnmount(() => {
  if (tickTimer !== undefined) {
    clearInterval(tickTimer);
    tickTimer = undefined;
  }
});

// translateX(-50%) 把指针挪到表盘水平中心，再绕自身底端（transform-origin: 50% 100%）旋转。
// 刻意不加 transition：秒针从 59 秒跳到 0 秒时会倒着转回 354°，逐帧过渡反而是错的。
function handStyle(angle: number) {
  return { transform: `translateX(-50%) rotate(${angle}deg)` };
}
</script>

<template>
  <div
    class="home-clock"
    role="group"
    :aria-label="t('home.clockLabel')"
  >
    <div class="home-clock-readout">
      <time
        class="home-clock-time"
        :datetime="datetimeAttr"
      >
        <span>{{ timeParts.hours }}</span>
        <span
          class="home-clock-colon"
          aria-hidden="true"
        >:</span>
        <span>{{ timeParts.minutes }}</span>
        <span
          class="home-clock-colon"
          aria-hidden="true"
        >:</span>
        <span class="home-clock-seconds">{{ timeParts.seconds }}</span>
      </time>
      <p class="home-clock-date">
        {{ dateLabel }}
      </p>
    </div>

    <!-- 表盘只是左侧数字时间的视觉重复，对读屏器隐藏。 -->
    <div
      class="home-clock-dial"
      aria-hidden="true"
    >
      <span
        class="home-clock-hand home-clock-hand-hour"
        :style="handStyle(handAngles.hour)"
      />
      <span
        class="home-clock-hand home-clock-hand-minute"
        :style="handStyle(handAngles.minute)"
      />
      <span
        class="home-clock-hand home-clock-hand-second"
        :style="handStyle(handAngles.second)"
      />
      <span class="home-clock-pin" />
    </div>
  </div>
</template>
