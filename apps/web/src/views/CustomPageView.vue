<script setup>
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from '../composables/useI18n';
import { publicApi } from '../services/api';

const route = useRoute();
const { t } = useI18n();

const page = ref(null);
const isLoading = ref(false);
const hasError = ref(false);

const slug = computed(() => String(route.params.slug ?? ''));

watch(
  slug,
  () => {
    loadPage();
  },
  { immediate: true },
);

async function loadPage() {
  if (!slug.value) {
    page.value = null;
    hasError.value = true;
    return;
  }

  isLoading.value = true;
  hasError.value = false;

  try {
    page.value = await publicApi.getPageBySlug(slug.value);
  } catch {
    page.value = null;
    hasError.value = true;
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <section
    v-if="isLoading"
    class="page-placeholder"
    aria-live="polite"
    aria-labelledby="custom-page-loading-title"
  >
    <p class="page-placeholder-eyebrow">
      {{ t('loading.label') }}
    </p>
    <h1 id="custom-page-loading-title">
      {{ t('loading.label') }}
    </h1>
    <div
      class="page-placeholder-skeleton"
      aria-hidden="true"
    >
      <span />
      <span />
      <span />
    </div>
  </section>

  <section
    v-else-if="hasError"
    class="page-placeholder"
    aria-labelledby="custom-page-error-title"
  >
    <p class="page-placeholder-eyebrow">
      {{ t('page.notFound.title') }}
    </p>
    <h1 id="custom-page-error-title">
      {{ t('page.notFound.title') }}
    </h1>
    <p>{{ t('page.notFound.body') }}</p>
    <div class="custom-page-actions">
      <button
        type="button"
        @click="loadPage"
      >
        {{ t('action.retry') }}
      </button>
    </div>
  </section>

  <article
    v-else-if="page"
    class="custom-page"
    aria-labelledby="custom-page-title"
  >
    <p
      v-if="page.summary"
      class="page-placeholder-eyebrow"
    >
      {{ page.summary }}
    </p>
    <h1 id="custom-page-title">
      {{ page.title }}
    </h1>
    <!-- eslint-disable vue/no-v-html -->
    <div
      class="custom-page-content"
      v-html="page.content"
    />
    <!-- eslint-enable vue/no-v-html -->
  </article>
</template>
