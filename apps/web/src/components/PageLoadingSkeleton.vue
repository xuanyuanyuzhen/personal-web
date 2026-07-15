<script setup lang="ts">
import { computed } from 'vue';

type SkeletonVariant =
  | 'article'
  | 'essays'
  | 'messages'
  | 'photos'
  | 'profile'
  | 'search'
  | 'thoughts';

const props = withDefaults(
  defineProps<{
    count?: number;
    label?: string;
    variant: SkeletonVariant;
  }>(),
  {
    count: 0,
    label: '正在整理内容…',
  },
);

const defaultCounts: Record<SkeletonVariant, number> = {
  article: 1,
  essays: 3,
  messages: 3,
  photos: 4,
  profile: 1,
  search: 3,
  thoughts: 2,
};

const itemCount = computed(() => props.count || defaultCounts[props.variant]);
const hasAvatar = computed(() => props.variant === 'messages' || props.variant === 'profile');
const hasMedia = computed(() => props.variant === 'essays' || props.variant === 'photos');
</script>

<template>
  <div
    :class="[
      'content-skeleton',
      `content-skeleton-${variant}`,
      variant === 'photos' ? ['photo-canvas', 'photo-loading-canvas'] : [],
    ]"
    role="status"
    aria-live="polite"
    :aria-label="label"
  >
    <p :class="['content-skeleton-label', { 'photo-loading-label': variant === 'photos' }]">
      {{ label }}
    </p>

    <div :class="['content-skeleton-items', { 'photo-loading-grid': variant === 'photos' }]">
      <div
        v-for="index in itemCount"
        :key="index"
        :class="['content-skeleton-item', { 'photo-loading-card': variant === 'photos' }]"
        aria-hidden="true"
      >
        <span
          v-if="hasAvatar"
          class="content-skeleton-avatar"
        />
        <span
          v-if="hasMedia"
          :class="['content-skeleton-media', { 'photo-loading-image': variant === 'photos' }]"
        />
        <span
          :class="[
            'content-skeleton-line',
            'content-skeleton-line-title',
            { 'photo-loading-line photo-loading-line-title': variant === 'photos' },
          ]"
        />
        <span
          :class="[
            'content-skeleton-line',
            'content-skeleton-line-body',
            { 'photo-loading-line': variant === 'photos' },
          ]"
        />
        <span
          :class="[
            'content-skeleton-line',
            'content-skeleton-line-meta',
            { 'photo-loading-line photo-loading-line-meta': variant === 'photos' },
          ]"
        />
      </div>
    </div>
  </div>
</template>
