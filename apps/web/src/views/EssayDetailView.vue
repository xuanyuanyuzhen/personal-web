<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import HeartLikeButton from '../components/HeartLikeButton.vue';
import { publicApi, type PublicEssay } from '../services/api';

const route = useRoute();
const router = useRouter();
const essay = ref<PublicEssay | null>(null);
const isLoading = ref(false);
const errorMessage = ref('');

onMounted(loadEssay);

watch(
  () => route.params.idOrSlug,
  () => {
    void loadEssay();
  },
);

async function loadEssay() {
  const idOrSlug = String(route.params.idOrSlug ?? '');
  if (!idOrSlug) {
    await router.replace('/404');
    return;
  }

  isLoading.value = true;
  errorMessage.value = '';

  try {
    essay.value = await publicApi.getEssay(idOrSlug);
  } catch {
    essay.value = null;
    errorMessage.value = '随笔不存在或暂未公开。';
  } finally {
    isLoading.value = false;
  }
}

async function toggleLike() {
  if (!essay.value) {
    return;
  }

  try {
    const result = await publicApi.toggleEssayLike(essay.value.id);
    essay.value.liked = result.liked;
    essay.value.likeCount = result.likeCount;
  } catch {
    errorMessage.value = '点赞失败，请稍后重试。';
  }
}
</script>

<template>
  <article
    v-if="essay"
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
      v-html="essay.content"
    />
    <!-- eslint-enable vue/no-v-html -->
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
