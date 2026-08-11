<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import PageLoadingSkeleton from '../components/PageLoadingSkeleton.vue';
import { useI18n } from '../composables/useI18n';
import { publicApi, type PublicMessage } from '../services/api';

const { t } = useI18n();
const page = ref(1);
const pageSize = 12;
const total = ref(0);
const messages = ref<PublicMessage[]>([]);
const isLoading = ref(false);
const initialLoadPending = ref(true);
const isSubmitting = ref(false);
const loadErrorMessage = ref('');
const formErrorMessage = ref('');
const submitMessage = ref('');
const loadMoreSentinel = ref<HTMLElement | null>(null);
let loadMoreObserver: IntersectionObserver | null = null;
let requestSequence = 0;
const form = reactive({
  content: '',
  email: '',
  nickname: '',
});

const hasMore = computed(() => messages.value.length < total.value);

onMounted(() => {
  void loadFirstPage();
  setupAutoLoad();
});

onBeforeUnmount(() => {
  loadMoreObserver?.disconnect();
});

async function loadFirstPage() {
  const requestId = ++requestSequence;
  initialLoadPending.value = true;
  page.value = 1;
  messages.value = [];
  total.value = 0;
  await loadMore(requestId, true);
}

async function loadMore(requestId = requestSequence, force = false) {
  if ((!force && isLoading.value) || (messages.value.length > 0 && !hasMore.value)) {
    return;
  }

  isLoading.value = true;
  loadErrorMessage.value = '';
  const requestedPage = page.value;
  try {
    const result = await publicApi.listMessages({ page: requestedPage, pageSize });
    if (requestId !== requestSequence) {
      return;
    }
    // 滚动加载可能和手动刷新交错，按 id 去重可以避免重复渲染同一条留言。
    const seen = new Set(messages.value.map((message) => message.id));
    messages.value = [
      ...messages.value,
      ...result.items.filter((message) => !seen.has(message.id)),
    ];
    total.value = result.pagination.total;
    page.value = requestedPage + 1;
  } catch {
    if (requestId === requestSequence) {
      loadErrorMessage.value = '留言加载失败，请稍后重试。';
    }
  } finally {
    if (requestId === requestSequence) {
      isLoading.value = false;
      initialLoadPending.value = false;
      void nextTick(refreshAutoLoadObserver);
    }
  }
}

function setupAutoLoad() {
  if (!('IntersectionObserver' in window) || !loadMoreSentinel.value) {
    return;
  }

  // 支持 IntersectionObserver 时自动触底加载；老环境保留“加载更多”按钮回退。
  loadMoreObserver = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        void loadMore();
      }
    },
    { rootMargin: '240px 0px' },
  );
  refreshAutoLoadObserver();
}

function refreshAutoLoadObserver() {
  if (!loadMoreObserver || !loadMoreSentinel.value) {
    return;
  }

  loadMoreObserver.unobserve(loadMoreSentinel.value);
  if (hasMore.value && !loadErrorMessage.value) {
    loadMoreObserver.observe(loadMoreSentinel.value);
  }
}

async function handleSubmit() {
  formErrorMessage.value = '';
  submitMessage.value = '';
  const nickname = form.nickname.trim();
  const email = form.email.trim();
  const content = form.content.trim();

  if (!nickname || !email || !content) {
    formErrorMessage.value = '请填写昵称、邮箱和留言内容。';
    return;
  }

  isSubmitting.value = true;
  try {
    const result = await publicApi.submitMessage({ content, email, nickname });
    form.content = '';
    if (result.auditStatus === 'APPROVED') {
      submitMessage.value = '留言已公开。';
      await loadFirstPage();
    } else {
      submitMessage.value = '留言已提交，待审核后会出现在这里。';
    }
  } catch {
    formErrorMessage.value = '留言提交失败，请稍后重试。';
  } finally {
    isSubmitting.value = false;
  }
}

function avatarText(message: PublicMessage) {
  return message.nickname.trim().slice(0, 1).toUpperCase() || 'Y';
}
</script>

<template>
  <section
    class="messages-page"
    aria-labelledby="messages-title"
  >
    <p class="page-placeholder-eyebrow">
      {{ t('nav.messages') }}
    </p>
    <h1 id="messages-title">
      {{ t('page.messages.title') }}
    </h1>
    <p class="summary">
      {{ t('page.messages.body') }}
    </p>

    <form
      class="message-form"
      @submit.prevent="handleSubmit"
    >
      <div class="message-form-grid">
        <label>
          <span>昵称</span>
          <input
            v-model="form.nickname"
            autocomplete="name"
            maxlength="80"
            required
          >
        </label>
        <label>
          <span>邮箱</span>
          <input
            v-model="form.email"
            autocomplete="email"
            maxlength="160"
            required
            type="email"
          >
        </label>
      </div>
      <label>
        <span>留言</span>
        <textarea
          v-model="form.content"
          maxlength="2000"
          required
          rows="5"
        />
      </label>
      <div class="message-form-actions">
        <p
          v-if="formErrorMessage"
          class="thought-error"
        >
          {{ formErrorMessage }}
        </p>
        <p
          v-else-if="submitMessage"
          class="message-success"
        >
          {{ submitMessage }}
        </p>
        <button
          class="message-submit-button"
          type="submit"
          :disabled="isSubmitting"
        >
          {{ isSubmitting ? '提交中' : '提交留言' }}
        </button>
      </div>
    </form>

    <div
      v-if="loadErrorMessage"
      class="content-feedback"
      role="alert"
    >
      <p class="thought-error">
        {{ loadErrorMessage }}
      </p>
      <button
        v-if="messages.length === 0"
        class="load-more content-retry"
        type="button"
        :disabled="isLoading"
        @click="loadFirstPage"
      >
        {{ t('action.retry') }}
      </button>
    </div>

    <PageLoadingSkeleton
      v-if="initialLoadPending && messages.length === 0"
      variant="messages"
      label="正在读取留言…"
    />

    <div
      v-else
      class="message-list"
    >
      <article
        v-for="message in messages"
        :key="message.id"
        class="message-card"
      >
        <div class="message-avatar">
          <img
            v-if="message.avatarUrl"
            :src="message.avatarUrl"
            :alt="message.nickname"
          >
          <span v-else>{{ avatarText(message) }}</span>
        </div>
        <div>
          <div class="message-card-header">
            <strong>{{ message.nickname }}</strong>
            <time :datetime="message.createdAt">
              {{ new Date(message.createdAt).toLocaleDateString() }}
            </time>
          </div>
          <p>{{ message.content }}</p>
        </div>
      </article>
    </div>

    <div
      v-if="!initialLoadPending && !isLoading && !loadErrorMessage && messages.length === 0"
      class="empty-state"
    >
      暂无公开留言。
    </div>

    <div
      ref="loadMoreSentinel"
      class="message-scroll-sentinel"
      aria-hidden="true"
    />

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
