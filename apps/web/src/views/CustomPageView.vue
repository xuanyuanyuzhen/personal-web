<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import PageLoadingSkeleton from '../components/PageLoadingSkeleton.vue';
import { useI18n } from '../composables/useI18n';
import { publicApi } from '../services/api';
import { sanitizeRichHtml } from '../utils/sanitizeHtml';

const route = useRoute();
const { t } = useI18n();

const page = ref(null);
const isLoading = ref(true);
const hasError = ref(false);
let requestSequence = 0;

const slug = computed(() => String(route.params.slug ?? ''));

// 净化结果缓存成 computed，避免模板每次重渲染都重新 parse 整篇 HTML。
const contentHtml = computed(() => sanitizeRichHtml(page.value?.content));

onMounted(loadPage);

async function loadPage() {
  const requestId = ++requestSequence;
  if (!slug.value) {
    page.value = null;
    hasError.value = true;
    isLoading.value = false;
    return;
  }

  isLoading.value = true;
  hasError.value = false;

  try {
    const nextPage = await publicApi.getPageBySlug(slug.value);
    if (requestId === requestSequence) {
      page.value = nextPage;
    }
  } catch {
    if (requestId === requestSequence) {
      page.value = null;
      hasError.value = true;
    }
  } finally {
    if (requestId === requestSequence) {
      isLoading.value = false;
    }
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
    <PageLoadingSkeleton
      variant="article"
      :label="t('loading.label')"
    />
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
      v-html="contentHtml"
    />
    <!-- eslint-enable vue/no-v-html -->
  </article>
</template>
