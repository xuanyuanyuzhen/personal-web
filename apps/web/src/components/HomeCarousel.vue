<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';

export type HomeCarouselSlide = {
  id: number | string;
  image: string | null;
  title?: string;
  caption?: string;
  to?: string;
};

// 首页通用轮播：随笔轮播图与照片墙共用。自动逐张播放，悬停/聚焦时暂停。
const props = withDefaults(
  defineProps<{
    slides: HomeCarouselSlide[];
    label: string;
    emptyText: string;
    interval?: number;
    showDots?: boolean;
  }>(),
  {
    interval: 5000,
    showDots: false,
  },
);

const activeIndex = ref(0);
const paused = ref(false);
let rotateTimer: ReturnType<typeof setInterval> | undefined;

const activeSlide = computed(() => props.slides[activeIndex.value] ?? props.slides[0] ?? null);

watch(
  () => props.slides.length,
  () => {
    activeIndex.value = 0;
    restartTimer();
  },
);

onMounted(restartTimer);

onBeforeUnmount(stopTimer);

function restartTimer() {
  stopTimer();

  if (props.slides.length <= 1) {
    return;
  }

  rotateTimer = setInterval(() => {
    if (!paused.value) {
      activeIndex.value = (activeIndex.value + 1) % props.slides.length;
    }
  }, props.interval);
}

function stopTimer() {
  if (rotateTimer !== undefined) {
    clearInterval(rotateTimer);
    rotateTimer = undefined;
  }
}

function goTo(index: number) {
  activeIndex.value = index;
  restartTimer();
}

function slideStyle(slide: HomeCarouselSlide) {
  if (!slide.image) {
    return undefined;
  }

  return { backgroundImage: `url("${slide.image.replaceAll('"', '%22')}")` };
}
</script>

<template>
  <div
    class="home-carousel"
    role="group"
    :aria-label="label"
    @mouseenter="paused = true"
    @mouseleave="paused = false"
    @focusin="paused = true"
    @focusout="paused = false"
  >
    <template v-if="activeSlide">
      <Transition name="carousel-fade">
        <component
          :is="activeSlide.to ? RouterLink : 'div'"
          :key="activeSlide.id"
          class="home-carousel-slide"
          :class="{ 'is-placeholder': !activeSlide.image }"
          :style="slideStyle(activeSlide)"
          v-bind="activeSlide.to ? { to: activeSlide.to } : {}"
        >
          <span
            v-if="activeSlide.title || activeSlide.caption"
            class="home-carousel-copy"
          >
            <strong v-if="activeSlide.title">{{ activeSlide.title }}</strong>
            <span v-if="activeSlide.caption">{{ activeSlide.caption }}</span>
          </span>
        </component>
      </Transition>

      <div
        v-if="showDots && slides.length > 1"
        class="home-carousel-dots"
      >
        <button
          v-for="(slide, index) in slides"
          :key="slide.id"
          type="button"
          class="home-carousel-dot"
          :class="{ 'is-active': index === activeIndex }"
          :aria-label="`${label} ${index + 1}/${slides.length}`"
          :aria-pressed="index === activeIndex"
          @click="goTo(index)"
        />
      </div>
    </template>

    <p
      v-else
      class="home-carousel-empty"
    >
      {{ emptyText }}
    </p>
  </div>
</template>
