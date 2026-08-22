<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import HeartLikeButton from '../components/HeartLikeButton.vue';
import PageLoadingSkeleton from '../components/PageLoadingSkeleton.vue';
import { useI18n } from '../composables/useI18n';
import { publicApi, type PublicThought, type PublicThoughtTag } from '../services/api';
import { sanitizeRichHtml } from '../utils/sanitizeHtml';

const { t } = useI18n();
const page = ref(1);
const pageSize = 10;
const total = ref(0);
const items = ref<PublicThought[]>([]);
const tags = ref<PublicThoughtTag[]>([]);
const activeTag = ref('');
const isLoading = ref(false);
const initialLoadPending = ref(true);
const loadErrorMessage = ref('');
const actionErrorMessage = ref('');
const busyLikeIds = ref(new Set<number>());
let requestSequence = 0;

const hasMore = computed(() => items.value.length < total.value);

onMounted(() => {
  void Promise.all([loadTags(), loadFirstPage()]);
  window.addEventListener('scroll', handleScroll, { passive: true });
});

onBeforeUnmount(() => {
  window.removeEventListener('scroll', handleScroll);
});

async function loadTags() {
  try {
    tags.value = await publicApi.getThoughtTags();
  } catch {
    tags.value = [];
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
  const requestedPage = page.value;
  const requestedTag = activeTag.value;

  try {
    const result = await publicApi.listThoughts({
      page: requestedPage,
      pageSize,
      tag: requestedTag || undefined,
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
      loadErrorMessage.value = '碎碎念加载失败，请稍后重试。';
    }
  } finally {
    if (requestId === requestSequence) {
      isLoading.value = false;
      initialLoadPending.value = false;
    }
  }
}

async function selectTag(tag: string) {
  activeTag.value = activeTag.value === tag ? '' : tag;
  await loadFirstPage();
}

async function toggleLike(item: PublicThought) {
  if (busyLikeIds.value.has(item.id)) {
    return;
  }

  busyLikeIds.value.add(item.id);
  actionErrorMessage.value = '';
  try {
    const result = await publicApi.toggleThoughtLike(item.id);
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

  if (distanceToBottom < 240 && hasMore.value) {
    void loadMore();
  }
}
</script>

<template>
  <section
    class="thoughts-page"
    aria-labelledby="thoughts-title"
  >
    <h1 id="thoughts-title">
      {{ t('page.thoughts.title') }}
    </h1>

    <div
      v-if="tags.length"
      class="thought-filter"
      aria-label="thought tags"
    >
      <button
        type="button"
        :class="{ active: activeTag === '' }"
        @click="selectTag('')"
      >
        全部
      </button>
      <button
        v-for="tag in tags"
        :key="tag.id"
        type="button"
        :class="{ active: activeTag === tag.slug }"
        @click="selectTag(tag.slug)"
      >
        {{ tag.name }}
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
      variant="thoughts"
      label="正在整理碎碎念…"
    />

    <div
      v-else
      class="thought-list"
    >
      <article
        v-for="item in items"
        :key="item.id"
        class="thought-card"
      >
        <img
          v-if="item.imageUrl"
          class="thought-image"
          :src="item.imageUrl"
          alt=""
        >
        <!-- eslint-disable vue/no-v-html -->
        <div
          class="custom-page-content"
          v-html="sanitizeRichHtml(item.content)"
        />
        <!-- eslint-enable vue/no-v-html -->
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
      暂无公开碎碎念。
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
