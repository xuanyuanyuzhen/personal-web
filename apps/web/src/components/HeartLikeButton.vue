<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from '../composables/useI18n';

const props = defineProps<{
  activeLabel?: string;
  disabled?: boolean;
  idleLabel?: string;
  likeCount: number;
  liked: boolean;
}>();

const emit = defineEmits<{
  toggle: [];
}>();

const { t } = useI18n();
const displayLabel = computed(() =>
  props.liked ? (props.activeLabel ?? t('action.liked')) : (props.idleLabel ?? t('action.like')),
);
</script>

<template>
  <button
    type="button"
    class="heart-like-button"
    :class="{ liked }"
    :disabled="disabled"
    :aria-pressed="liked"
    @click="emit('toggle')"
  >
    <span
      class="heart-like-icon"
      aria-hidden="true"
    >
      ♥
    </span>
    <span class="heart-like-text">
      {{ displayLabel }} · <strong>{{ likeCount }}</strong>
    </span>
  </button>
</template>
