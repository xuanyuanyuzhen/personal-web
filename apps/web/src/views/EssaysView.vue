<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import HeartLikeButton from '../components/HeartLikeButton.vue';
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
const errorMessage = ref('');

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
    const result = await publicApi.listEssays({
      category: activeCategory.value || undefined,
      page: page.value,
      pageSize,
    });
    const seen = new Set(items.value.map((item) => item.id));
    const nextItems = result.items.filter((item) => !seen.has(item.id));

    items.value = [...items.value, ...nextItems];
    total.value = result.pagination.total;
    page.value += 1;
  } catch {
    errorMessage.value = '随笔加载失败，请稍后重试。';
  } finally {
    isLoading.value = false;
  }
}

async function selectCategory(category: string) {
  activeCategory.value = activeCategory.value === category ? '' : category;
  await loadFirstPage();
}

async function toggleLike(item: PublicEssay) {
  try {
    const result = await publicApi.toggleEssayLike(item.id);
    item.liked = result.liked;
    item.likeCount = result.likeCount;
  } catch {
    errorMessage.value = '点赞失败，请稍后重试。';
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
    :aria-busy="isLoading"
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

    <p
      v-if="errorMessage"
      class="thought-error"
    >
      {{ errorMessage }}
    </p>

    <div class="essay-list">
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
            @toggle="toggleLike(item)"
          />
        </div>
      </article>
    </div>

    <div
      v-if="!isLoading && items.length === 0"
      class="empty-state"
    >
      暂无公开随笔。
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
