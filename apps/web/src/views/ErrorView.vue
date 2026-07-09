<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from '../composables/useI18n';

const route = useRoute();
const { t } = useI18n();

const statusCode = computed(() => String(route.meta.statusCode ?? '404'));
const errorKind = computed(() => (statusCode.value === '500' ? '500' : '404'));
const statusText = computed(() => t(`error.${errorKind.value}.label`));
const title = computed(() => t(`error.${errorKind.value}.title`));
const body = computed(() => t(`error.${errorKind.value}.body`));

function goBack() {
  window.history.back();
}

function reloadPage() {
  window.location.reload();
}
</script>

<template>
  <section
    class="error-page"
    aria-labelledby="error-title"
  >
    <div class="error-page-status">
      {{ statusCode }}
    </div>
    <div>
      <p class="error-page-label">
        {{ statusText }}
      </p>
      <h1 id="error-title">
        {{ title }}
      </h1>
      <p>{{ body }}</p>
      <ul
        class="error-diagnostics"
        aria-label="diagnostics"
      >
        <li>{{ t('error.check.browser') }}</li>
        <li>{{ t('error.check.network') }}</li>
        <li>{{ t('error.check.service') }}</li>
      </ul>
      <div class="error-page-actions">
        <button
          type="button"
          @click="goBack"
        >
          {{ t('action.back') }}
        </button>
        <button
          type="button"
          @click="reloadPage"
        >
          {{ t('action.reload') }}
        </button>
      </div>
    </div>
  </section>
</template>
