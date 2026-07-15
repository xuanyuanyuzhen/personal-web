<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import PageLoadingSkeleton from './PageLoadingSkeleton.vue';
import { useI18n } from '../composables/useI18n';
import { publicApi, type SearchResponse, type SearchSectionKey } from '../services/api';

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

const { t } = useI18n();
const query = ref('');
const result = ref<SearchResponse | null>(null);
const isLoading = ref(false);
const errorMessage = ref('');
const inputRef = ref<HTMLInputElement | null>(null);
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

watch(
  () => props.open,
  async (open) => {
    if (open) {
      await nextTick();
      inputRef.value?.focus();
    }
  },
);

async function submitSearch() {
  const requestId = ++requestSequence;
  const keyword = query.value.trim();
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
      pageSize: 3,
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

function closeDialog() {
  emit('close');
}
</script>

<template>
  <Transition name="search-dialog">
    <div
      v-if="open"
      class="search-overlay"
      @click.self="closeDialog"
    >
      <section
        class="search-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-search-title"
        @keydown.esc="closeDialog"
      >
        <div class="search-dialog-header">
          <h2 id="quick-search-title">
            {{ t('search.quickTitle') }}
          </h2>
          <button
            type="button"
            class="search-dialog-close"
            :aria-label="t('action.close')"
            @click="closeDialog"
          >
            ×
          </button>
        </div>

        <form
          class="search-box"
          @submit.prevent="submitSearch"
        >
          <label
            class="visually-hidden"
            for="quick-search-input"
          >
            {{ t('search.placeholder') }}
          </label>
          <input
            id="quick-search-input"
            ref="inputRef"
            v-model="query"
            type="search"
            :placeholder="t('search.placeholder')"
          >
          <button type="submit">
            {{ t('search.action') }}
          </button>
        </form>

        <PageLoadingSkeleton
          v-if="isLoading"
          :count="2"
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
          class="search-sections"
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
            class="search-section"
          >
            <h3>
              {{ item.label }}
              <span class="search-section-count">{{ item.section?.pagination.total }}</span>
            </h3>
            <RouterLink
              v-for="resultItem in item.section?.items"
              :key="`${resultItem.type}-${resultItem.id}`"
              class="search-result-link"
              :to="resultItem.url"
              @click="closeDialog"
            >
              <strong>{{ resultItem.title }}</strong>
              <span>{{ resultItem.excerpt }}</span>
            </RouterLink>
          </section>

          <RouterLink
            v-if="query.trim()"
            class="search-more-link"
            :to="{ name: 'search', query: { q: query.trim() } }"
            @click="closeDialog"
          >
            {{ t('search.more') }}
          </RouterLink>
        </div>
      </section>
    </div>
  </Transition>
</template>
