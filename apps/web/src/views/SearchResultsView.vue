<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import PageLoadingSkeleton from '../components/PageLoadingSkeleton.vue';
import { useI18n } from '../composables/useI18n';
import { publicApi, type SearchResponse, type SearchSectionKey } from '../services/api';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const initialQuery = typeof route.query.q === 'string' ? route.query.q : '';
const queryInput = ref(initialQuery);
const result = ref<SearchResponse | null>(null);
const isLoading = ref(Boolean(initialQuery.trim()));
const errorMessage = ref('');
let requestSequence = 0;

const sectionOrder: SearchSectionKey[] = ['thoughts', 'pages', 'essays', 'photos', 'messages'];
const visibleSections = computed(() =>
  sectionOrder
    .map((key) => ({
      key,
      label: t(`search.section.${key}`),
      section: result.value?.sections[key],
    }))
    .filter((item) => item.section && item.section.items.length > 0),
);
const hasResult = computed(() => visibleSections.value.length > 0);

onMounted(() => {
  syncFromRoute();
  void loadResults();
});

watch(
  () => route.query.q,
  () => {
    syncFromRoute();
    void loadResults();
  },
);

function syncFromRoute() {
  queryInput.value = typeof route.query.q === 'string' ? route.query.q : '';
}

async function submitSearch() {
  const keyword = queryInput.value.trim();
  await router.push({
    name: 'search',
    query: keyword ? { q: keyword } : {},
  });
}

async function loadResults() {
  const requestId = ++requestSequence;
  const keyword = queryInput.value.trim();
  if (!keyword) {
    result.value = null;
    errorMessage.value = '';
    isLoading.value = false;
    return;
  }

  isLoading.value = true;
  errorMessage.value = '';

  try {
    const nextResult = await publicApi.search({
      page: 1,
      pageSize: 10,
      q: keyword,
    });
    if (requestId === requestSequence) {
      result.value = nextResult;
    }
  } catch {
    if (requestId === requestSequence) {
      result.value = null;
      errorMessage.value = t('search.error');
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
    class="search-page"
    aria-labelledby="search-title"
  >
    <p class="page-placeholder-eyebrow">
      {{ t('search.title') }}
    </p>
    <h1 id="search-title">
      {{ t('search.title') }}
    </h1>

    <form
      class="search-box search-page-box"
      @submit.prevent="submitSearch"
    >
      <label
        class="visually-hidden"
        for="search-page-input"
      >
        {{ t('search.placeholder') }}
      </label>
      <input
        id="search-page-input"
        v-model="queryInput"
        type="search"
        :placeholder="t('search.placeholder')"
      >
      <button type="submit">
        {{ t('search.action') }}
      </button>
    </form>

    <PageLoadingSkeleton
      v-if="isLoading"
      variant="search"
      label="正在搜索…"
    />
    <p
      v-else-if="errorMessage"
      class="search-dialog-status"
    >
      {{ errorMessage }}
    </p>
    <div
      v-else-if="result"
      class="search-page-results"
    >
      <div
        v-if="!hasResult"
        class="search-empty"
      >
        {{ t('search.empty') }}
      </div>

      <section
        v-for="item in visibleSections"
        :key="item.key"
        class="search-page-section"
      >
        <h2>
          {{ item.label }}
          <span class="search-section-count">{{ item.section?.pagination.total }}</span>
        </h2>
        <RouterLink
          v-for="resultItem in item.section?.items"
          :key="`${resultItem.type}-${resultItem.id}`"
          class="search-page-link"
          :to="resultItem.url"
        >
          <strong>{{ resultItem.title }}</strong>
          <span>{{ resultItem.excerpt }}</span>
        </RouterLink>
      </section>
    </div>
  </section>
</template>
