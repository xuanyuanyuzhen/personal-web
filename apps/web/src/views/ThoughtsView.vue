<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import HeartLikeButton from '../components/HeartLikeButton.vue';
import { useI18n } from '../composables/useI18n';
import { publicApi, type PublicThought, type PublicThoughtTag } from '../services/api';

const { t } = useI18n();
const page = ref(1);
const pageSize = 10;
const total = ref(0);
const items = ref<PublicThought[]>([]);
const tags = ref<PublicThoughtTag[]>([]);
const activeTag = ref('');
const isLoading = ref(false);
const errorMessage = ref('');

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
  page.value = 1;
  items.value = [];
  total.value = 0;
  await loadMore();
}

async function loadMore() {
  if (isLoading.value) {
    return;
  }

  isLoading.value = true;
  errorMessage.value = '';

  try {
    const result = await publicApi.listThoughts({
      page: page.value,
      pageSize,
      tag: activeTag.value || undefined,
    });
    const seen = new Set(items.value.map((item) => item.id));
    const nextItems = result.items.filter((item) => !seen.has(item.id));

    items.value = [...items.value, ...nextItems];
    total.value = result.pagination.total;
    page.value += 1;
  } catch {
    errorMessage.value = '碎碎念加载失败，请稍后重试。';
  } finally {
    isLoading.value = false;
  }
}

async function selectTag(tag: string) {
  activeTag.value = activeTag.value === tag ? '' : tag;
  await loadFirstPage();
}

async function toggleLike(item: PublicThought) {
  try {
    const result = await publicApi.toggleThoughtLike(item.id);
    item.liked = result.liked;
    item.likeCount = result.likeCount;
  } catch {
    errorMessage.value = '点赞失败，请稍后重试。';
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
    <p class="page-placeholder-eyebrow">
      {{ t('nav.thoughts') }}
    </p>
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

    <p
      v-if="errorMessage"
      class="thought-error"
    >
      {{ errorMessage }}
    </p>

    <div class="thought-list">
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
          v-html="item.content"
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
            @toggle="toggleLike(item)"
          />
        </div>
      </article>
    </div>

    <div
      v-if="!isLoading && items.length === 0"
      class="empty-state"
    >
      暂无公开碎碎念。
    </div>

    <button
      v-if="hasMore"
      class="load-more"
      type="button"
      :disabled="isLoading"
      @click="loadMore"
    >
      {{ isLoading ? '加载中' : '加载更多' }}
    </button>
  </section>
</template>
