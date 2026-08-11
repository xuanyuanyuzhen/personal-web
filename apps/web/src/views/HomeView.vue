<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import HeartLikeButton from '../components/HeartLikeButton.vue';
import { useI18n } from '../composables/useI18n';
import { publicApi, type PublicAnnouncement, type SiteSettings } from '../services/api';
import { sanitizeRichHtml } from '../utils/sanitizeHtml';

const { t } = useI18n();

const ANNOUNCEMENT_DISMISSED_KEY = 'yuer.home.announcement.dismissed';

const settings = ref<SiteSettings | null>(null);
const announcement = ref<PublicAnnouncement | null>(null);
const announcementDismissed = ref(false);
const siteLike = ref({
  likeCount: 0,
  liked: false,
});
const likeBusy = ref(false);
const likeError = ref('');

// 后台配置的内容对所有语言都生效，只在字段为空时才回退到静态翻译文案。
// 之前的写法是 `locale === 'zh' && field`，切到 en/ja 会直接丢弃后台内容。
const siteName = computed(() => settings.value?.siteName || t('home.title'));
const publicName = computed(() => settings.value?.publicName || t('home.kicker'));
const homeIntroduction = computed(() => settings.value?.homeIntroduction || t('home.intro'));
const announcementTitle = computed(() => announcement.value?.title || t('home.announcement'));
const announcementContent = computed(
  () => announcement.value?.content || t('home.announcementBody'),
);
// 用 computed 缓存净化结果，避免模板里每次重渲染都重新 parse 一遍整段 HTML。
const announcementHtml = computed(() => sanitizeRichHtml(announcementContent.value));
const showAnnouncement = computed(() =>
  Boolean(announcement.value && !announcementDismissed.value),
);

onMounted(() => {
  void loadHomeData();
  window.addEventListener('open-site-announcement', handleOpenAnnouncement);
});

onBeforeUnmount(() => {
  window.removeEventListener('open-site-announcement', handleOpenAnnouncement);
});

async function loadHomeData() {
  const [nextSettings, nextAnnouncement, nextSiteLike] = await Promise.allSettled([
    publicApi.getSiteSettings(),
    publicApi.getAnnouncement(),
    publicApi.getSiteLikeStatus(),
  ]);

  if (nextSettings.status === 'fulfilled') {
    settings.value = nextSettings.value;
  }

  if (nextAnnouncement.status === 'fulfilled') {
    announcement.value = nextAnnouncement.value;
    announcementDismissed.value = Boolean(
      nextAnnouncement.value &&
      localStorage.getItem(ANNOUNCEMENT_DISMISSED_KEY) ===
        announcementIdentity(nextAnnouncement.value),
    );
  }

  if (nextSiteLike.status === 'fulfilled') {
    siteLike.value = nextSiteLike.value;
  }
}

function closeAnnouncement() {
  announcementDismissed.value = true;
  if (announcement.value) {
    localStorage.setItem(ANNOUNCEMENT_DISMISSED_KEY, announcementIdentity(announcement.value));
  }
}

function handleOpenAnnouncement() {
  announcementDismissed.value = false;
  localStorage.removeItem(ANNOUNCEMENT_DISMISSED_KEY);
}

async function toggleSiteLike() {
  if (likeBusy.value) {
    return;
  }

  likeBusy.value = true;
  likeError.value = '';
  try {
    siteLike.value = await publicApi.toggleSiteLike();
  } catch {
    likeError.value = t('feedback.likeFailed');
  } finally {
    likeBusy.value = false;
  }
}

function announcementIdentity(value: PublicAnnouncement) {
  return `${value.publishedAt ?? 'draft'}:${value.title}`;
}
</script>

<template>
  <section
    class="home-view"
    aria-labelledby="home-title"
  >
    <div class="intro">
      <p class="eyebrow">
        {{ publicName }}
      </p>
      <h1 id="home-title">
        {{ siteName }}
      </h1>
      <p class="summary">
        {{ homeIntroduction }}
      </p>
      <div class="home-actions">
        <HeartLikeButton
          :liked="siteLike.liked"
          :like-count="siteLike.likeCount"
          :disabled="likeBusy"
          :idle-label="t('home.like')"
          :active-label="t('home.liked')"
          @toggle="toggleSiteLike"
        />
      </div>
      <p
        v-if="likeError"
        class="thought-error"
        role="alert"
      >
        {{ likeError }}
      </p>
      <aside
        v-if="showAnnouncement && announcement"
        class="notice-strip"
        aria-label="site notice"
      >
        <div class="notice-strip-header">
          <span>{{ announcementTitle }}</span>
          <button
            type="button"
            :aria-label="t('action.close')"
            @click="closeAnnouncement"
          >
            ×
          </button>
        </div>
        <!-- eslint-disable vue/no-v-html -->
        <div
          class="notice-strip-content"
          v-html="announcementHtml"
        />
        <!-- eslint-enable vue/no-v-html -->
      </aside>
    </div>
  </section>
</template>
