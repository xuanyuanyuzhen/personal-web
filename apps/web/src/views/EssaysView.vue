<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import HeartLikeButton from '../components/HeartLikeButton.vue';
import PageLoadingSkeleton from '../components/PageLoadingSkeleton.vue';
import { useI18n } from '../composables/useI18n';
import { publicApi, type PublicEssay, type PublicEssayCategory } from '../services/api';

const { t } = useI18n();
const page = ref(1);
const pageSize = 8;
const total = ref(0);
const items = ref<PublicEssay[]>([]);
const categories = ref<PublicEssayCategory[]>([]);
const activeCategory = ref('');
const isLoading = ref(false);
const initialLoadPending = ref(true);
const loadErrorMessage = ref('');
const actionErrorMessage = ref('');
const busyLikeIds = ref(new Set<number>());
let requestSequence = 0;

const hasMore = computed(() => items.value.length < total.value);

onMounted(() => {
  void Promise.all([loadCategories(), loadFirstPage()]);
  window.addEventListener('scroll', handleScroll, { passive: true });
});

onBeforeUnmount(() => {
  window.removeEventListener('scroll', handleScroll);
});

async function loadCategories() {
  try {
    categories.value = await publicApi.getEssayCategories();
  } catch {
    categories.value = [];
  }
}

async function loadFirstPage() {
  const requestId = ++requestSequence;
  initialLoadPending.value = true;
  actionErrorMessage.value = '';
  page.value = 1;
  items.value = [];
  total.value = 0;
  await loadMore(requestId, true);
}

async function loadMore(requestId = requestSequence, force = false) {
  if (isLoading.value && !force) {
    return;
  }

  isLoading.value = true;
  loadErrorMessage.value = '';
  const requestedCategory = activeCategory.value;
  const requestedPage = page.value;

  try {
    const result = await publicApi.listEssays({
      category: requestedCategory || undefined,
      page: requestedPage,
      pageSize,
    });
    if (requestId !== requestSequence) {
      return;
    }
    const seen = new Set(items.value.map((item) => item.id));
    const nextItems = result.items.filter((item) => !seen.has(item.id));

    items.value = [...items.value, ...nextItems];
    total.value = result.pagination.total;
    page.value = requestedPage + 1;
  } catch {
    if (requestId === requestSequence) {
      loadErrorMessage.value = '随笔加载失败，请稍后重试。';
    }
  } finally {
    if (requestId === requestSequence) {
      isLoading.value = false;
      initialLoadPending.value = false;
    }
  }
}

async function selectCategory(category: string) {
  activeCategory.value = activeCategory.value === category ? '' : category;
  await loadFirstPage();
}

async function toggleLike(item: PublicEssay) {
  if (busyLikeIds.value.has(item.id)) {
    return;
  }

  busyLikeIds.value.add(item.id);
  actionErrorMessage.value = '';
  try {
    const result = await publicApi.toggleEssayLike(item.id);
    item.liked = result.liked;
    item.likeCount = result.likeCount;
  } catch {
    actionErrorMessage.value = t('feedback.likeFailed');
  } finally {
    busyLikeIds.value.delete(item.id);
  }
}

function handleScroll() {
  const distanceToBottom =
    document.documentElement.scrollHeight - window.scrollY - window.innerHeight;

  if (distanceToBottom < 260 && hasMore.value) {
    void loadMore();
  }
}
</script>

<template>
  <section
    class="essays-page"
    aria-labelledby="essays-title"
  >
    <p class="page-placeholder-eyebrow">
      {{ t('nav.essays') }}
    </p>
    <h1 id="essays-title">
      {{ t('page.essays.title') }}
    </h1>

    <div
      v-if="categories.length"
      class="essay-filter"
      aria-label="essay categories"
    >
      <button
        type="button"
        :class="{ active: activeCategory === '' }"
        @click="selectCategory('')"
      >
        全部
      </button>
      <button
        v-for="category in categories"
        :key="category.id"
        type="button"
        :class="{ active: activeCategory === category.slug }"
        @click="selectCategory(category.slug)"
      >
        {{ category.name }}
      </button>
    </div>

    <div
      v-if="loadErrorMessage || actionErrorMessage"
      class="content-feedback"
      role="alert"
    >
      <p
        v-if="loadErrorMessage"
        class="thought-error"
      >
        {{ loadErrorMessage }}
      </p>
      <p
        v-if="actionErrorMessage"
        class="thought-error"
      >
        {{ actionErrorMessage }}
      </p>
      <button
        v-if="loadErrorMessage && items.length === 0"
        class="load-more content-retry"
        type="button"
        :disabled="isLoading"
        @click="loadFirstPage"
      >
        {{ t('action.retry') }}
      </button>
    </div>

    <PageLoadingSkeleton
      v-if="initialLoadPending && items.length === 0"
      variant="essays"
      label="正在翻阅随笔…"
    />

    <div
      v-else
      class="essay-list"
    >
      <article
        v-for="(item, index) in items"
        :key="item.id"
        class="essay-card"
        :class="{ featured: index === 0 && !activeCategory }"
      >
        <RouterLink
          class="essay-card-link"
          :to="{ name: 'essay-detail', params: { idOrSlug: item.slug || item.id } }"
        >
          <img
            v-if="item.coverUrl"
            class="essay-cover"
            :src="item.coverUrl"
            alt=""
          >
          <div>
            <div class="essay-card-meta">
              <span>{{ item.category?.name ?? '未分类' }}</span>
              <span v-if="item.isPinned">置顶</span>
            </div>
            <h2>{{ item.title }}</h2>
            <p v-if="item.summary">
              {{ item.summary }}
            </p>
          </div>
        </RouterLink>
        <div class="thought-meta">
          <div class="thought-tags">
            <span
              v-for="tag in item.tags"
              :key="tag.id"
            >
              {{ tag.name }}
            </span>
          </div>
          <HeartLikeButton
            :liked="item.liked"
            :like-count="item.likeCount"
            :disabled="busyLikeIds.has(item.id)"
            @toggle="toggleLike(item)"
          />
        </div>
      </article>
    </div>

    <div
      v-if="!initialLoadPending && !isLoading && !loadErrorMessage && items.length === 0"
      class="empty-state"
    >
      暂无公开随笔。
    </div>

    <button
      v-if="hasMore"
      class="load-more"
      type="button"
      :disabled="isLoading"
      @click="loadMore()"
    >
      {{ isLoading ? '加载中' : '加载更多' }}
    </button>
  </section>
</template>
