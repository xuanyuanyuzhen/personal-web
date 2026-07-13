<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import HeartLikeButton from '../components/HeartLikeButton.vue';
import { useI18n } from '../composables/useI18n';
import { publicApi, type PublicAnnouncement, type SiteSettings } from '../services/api';

const { locale, t } = useI18n();

const ANNOUNCEMENT_DISMISSED_KEY = 'yuer.home.announcement.dismissed';

const settings = ref<SiteSettings | null>(null);
const announcement = ref<PublicAnnouncement | null>(null);
const announcementDismissed = ref(localStorage.getItem(ANNOUNCEMENT_DISMISSED_KEY) === '1');
const siteLike = ref({
  likeCount: 0,
  liked: false,
});
const likeBusy = ref(false);

const siteName = computed(() =>
  locale.value === 'zh' && settings.value?.siteName ? settings.value.siteName : t('home.title'),
);
const publicName = computed(() =>
  locale.value === 'zh' && settings.value?.publicName
    ? settings.value.publicName
    : t('home.kicker'),
);
const homeIntroduction = computed(() =>
  locale.value === 'zh' && settings.value?.homeIntroduction
    ? settings.value.homeIntroduction
    : t('home.intro'),
);
const announcementTitle = computed(() =>
  locale.value === 'zh' && announcement.value?.title
    ? announcement.value.title
    : t('home.announcement'),
);
const announcementContent = computed(() =>
  locale.value === 'zh' && announcement.value?.content
    ? announcement.value.content
    : t('home.announcementBody'),
);
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
  }

  if (nextSiteLike.status === 'fulfilled') {
    siteLike.value = nextSiteLike.value;
  }
}

function closeAnnouncement() {
  announcementDismissed.value = true;
  localStorage.setItem(ANNOUNCEMENT_DISMISSED_KEY, '1');
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
  try {
    siteLike.value = await publicApi.toggleSiteLike();
  } finally {
    likeBusy.value = false;
  }
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
          v-if="locale === 'zh'"
          class="notice-strip-content"
          v-html="announcementContent"
        />
        <!-- eslint-enable vue/no-v-html -->
        <p
          v-else
          class="notice-strip-content"
        >
          {{ announcementContent }}
        </p>
      </aside>
    </div>
  </section>
</template>
