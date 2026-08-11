<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import HeartLikeButton from '../components/HeartLikeButton.vue';
import PageLoadingSkeleton from '../components/PageLoadingSkeleton.vue';
import { publicApi, type PublicEssay } from '../services/api';
import { sanitizeRichHtml } from '../utils/sanitizeHtml';

const route = useRoute();
const router = useRouter();
const essay = ref<PublicEssay | null>(null);
const isLoading = ref(true);
const errorMessage = ref('');
const likeBusy = ref(false);
let requestSequence = 0;

// 用 computed 缓存净化结果，避免模板每次重渲染都重新 parse 整篇正文。
const essayHtml = computed(() => sanitizeRichHtml(essay.value?.content));

onMounted(loadEssay);

async function loadEssay() {
  const requestId = ++requestSequence;
  const idOrSlug = String(route.params.idOrSlug ?? '');
  if (!idOrSlug) {
    isLoading.value = false;
    await router.replace('/404');
    return;
  }

  isLoading.value = true;
  errorMessage.value = '';

  try {
    const nextEssay = await publicApi.getEssay(idOrSlug);
    if (requestId === requestSequence) {
      essay.value = nextEssay;
    }
  } catch {
    if (requestId === requestSequence) {
      essay.value = null;
      errorMessage.value = '随笔不存在或暂未公开。';
    }
  } finally {
    if (requestId === requestSequence) {
      isLoading.value = false;
    }
  }
}

async function toggleLike() {
  if (!essay.value || likeBusy.value) {
    return;
  }

  likeBusy.value = true;
  errorMessage.value = '';
  try {
    const result = await publicApi.toggleEssayLike(essay.value.id);
    essay.value.liked = result.liked;
    essay.value.likeCount = result.likeCount;
  } catch {
    errorMessage.value = '点赞失败，请稍后重试。';
  } finally {
    likeBusy.value = false;
  }
}
</script>

<template>
  <section
    v-if="isLoading"
    class="essay-detail essay-detail-loading"
  >
    <p class="page-placeholder-eyebrow">
      随笔
    </p>
    <h1>正在翻阅这篇随笔</h1>
    <PageLoadingSkeleton
      variant="article"
      label="正在整理正文…"
    />
  </section>

  <article
    v-else-if="essay"
    class="essay-detail"
  >
    <p class="page-placeholder-eyebrow">
      {{ essay.category?.name ?? '随笔' }}
    </p>
    <h1>{{ essay.title }}</h1>
    <p
      v-if="essay.summary"
      class="summary"
    >
      {{ essay.summary }}
    </p>
    <img
      v-if="essay.coverUrl"
      class="essay-detail-cover"
      :src="essay.coverUrl"
      alt=""
    >
    <!-- eslint-disable vue/no-v-html -->
    <div
      class="custom-page-content"
      v-html="essayHtml"
    />
    <!-- eslint-enable vue/no-v-html -->
    <p
      v-if="errorMessage"
      class="thought-error"
      role="alert"
    >
      {{ errorMessage }}
    </p>
    <div class="thought-meta">
      <div class="thought-tags">
        <span
          v-for="tag in essay.tags"
          :key="tag.id"
        >
          {{ tag.name }}
        </span>
      </div>
      <HeartLikeButton
        :liked="essay.liked"
        :like-count="essay.likeCount"
        :disabled="likeBusy"
        @toggle="toggleLike"
      />
    </div>
  </article>

  <section
    v-else
    class="custom-page"
  >
    <p class="page-placeholder-eyebrow">
      随笔
    </p>
    <h1>{{ isLoading ? '正在加载' : '没有找到这篇随笔' }}</h1>
    <p class="summary">
      {{ errorMessage || '稍等一下。' }}
    </p>
  </section>
</template>
