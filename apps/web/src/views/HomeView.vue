<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import HeartLikeButton from '../components/HeartLikeButton.vue';
import HomeCarousel, { type HomeCarouselSlide } from '../components/HomeCarousel.vue';
import HomeClock from '../components/HomeClock.vue';
import HomeQuote from '../components/HomeQuote.vue';
import { useI18n } from '../composables/useI18n';
import {
  publicApi,
  type PaginatedResult,
  type PublicAnnouncement,
  type PublicEssay,
  type PublicMessage,
  type PublicPhoto,
  type SiteSettings,
} from '../services/api';
import { sanitizeRichHtml } from '../utils/sanitizeHtml';

const { t } = useI18n();

// 站点上线日，用于状态条的「已运行 N 天」。仓库首个版本在 2026-06 上线。
const SITE_LAUNCH_DATE = '2026-06-01T00:00:00+08:00';

const settings = ref<SiteSettings | null>(null);
const announcement = ref<PublicAnnouncement | null>(null);
const essays = ref<PublicEssay[]>([]);
const photos = ref<PublicPhoto[]>([]);
const messages = ref<PublicMessage[]>([]);
const totals = ref({ essays: 0, messages: 0, photos: 0 });
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

const essaySlides = computed<HomeCarouselSlide[]>(() =>
  essays.value.slice(0, 5).map((essay) => ({
    caption: formatDate(essay.publishedAt ?? essay.createdAt),
    id: essay.id,
    image: essay.coverUrl,
    title: essay.title,
    to: essayLink(essay),
  })),
);

const photoSlides = computed<HomeCarouselSlide[]>(() =>
  photos.value.slice(0, 6).map((photo) => ({
    caption: photo.title,
    id: photo.id,
    image: photo.thumbUrl || photo.largeUrl || photo.originalUrl,
    to: '/photos',
  })),
);

const latestEssay = computed(() => essays.value[0] ?? null);
const latestEssayStyle = computed(() => {
  const cover = latestEssay.value?.coverUrl;
  return cover ? { backgroundImage: `url("${cover.replaceAll('"', '%22')}")` } : undefined;
});
const recentMessages = computed(() => messages.value.slice(0, 3));

const runningDays = computed(() => {
  const elapsed = Date.now() - new Date(SITE_LAUNCH_DATE).getTime();
  return Math.max(1, Math.ceil(elapsed / 86_400_000));
});
const statusDaysLabel = computed(() =>
  t('home.statusDays').replace('{days}', String(runningDays.value)),
);
const statusCountsLabel = computed(() =>
  [
    `${t('search.section.essays')} ${totals.value.essays}`,
    `${t('search.section.photos')} ${totals.value.photos}`,
    `${t('search.section.messages')} ${totals.value.messages}`,
  ].join(' · '),
);

onMounted(() => {
  void loadHomeData();
});

async function loadHomeData() {
  const [nextSettings, nextAnnouncement, nextSiteLike, nextEssays, nextPhotos, nextMessages] =
    await Promise.allSettled([
      publicApi.getSiteSettings(),
      publicApi.getAnnouncement(),
      publicApi.getSiteLikeStatus(),
      publicApi.listEssays({ page: 1, pageSize: 6 }),
      publicApi.listPhotos({ page: 1, pageSize: 6 }),
      publicApi.listMessages({ page: 1, pageSize: 3 }),
    ]);

  if (nextSettings.status === 'fulfilled') {
    settings.value = nextSettings.value;
  }

  if (nextAnnouncement.status === 'fulfilled') {
    announcement.value = nextAnnouncement.value;
  }

  // 点赞状态同样防御非法结构，避免把 undefined 传进 HeartLikeButton 的必填 props。
  if (nextSiteLike.status === 'fulfilled' && typeof nextSiteLike.value?.likeCount === 'number') {
    siteLike.value = nextSiteLike.value;
  }

  const essayPage = readPage(nextEssays);
  essays.value = essayPage.items;
  const photoPage = readPage(nextPhotos);
  photos.value = photoPage.items;
  const messagePage = readPage(nextMessages);
  messages.value = messagePage.items;
  totals.value = {
    essays: essayPage.total,
    messages: messagePage.total,
    photos: photoPage.total,
  };
}

// 列表接口失败时首页要能整体降级成空态，同时防御「响应可解析但不是分页结构」的情况。
function readPage<T>(result: PromiseSettledResult<PaginatedResult<T>>) {
  if (result.status !== 'fulfilled' || !Array.isArray(result.value?.items)) {
    return { items: [] as T[], total: 0 };
  }

  return {
    items: result.value.items,
    total: result.value.pagination?.total ?? result.value.items.length,
  };
}

function essayLink(essay: PublicEssay) {
  return `/essays/${encodeURIComponent(essay.slug || String(essay.id))}`;
}

function formatDate(value: string | null) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
}

// 小卡片空间有限，超长文本按码点截断，避免撑破布局（CSS 多行 clamp 需要 -webkit-box 老语法）。
function clip(value: string, max: number) {
  const chars = Array.from(value);
  return chars.length > max ? `${chars.slice(0, max).join('')}…` : value;
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
</script>

<template>
  <section
    class="home-view"
    aria-labelledby="home-title"
  >
    <!-- 占满整栏的毛玻璃容器：比导航栏更透明（见 styles.css 的 .home-panel）。 -->
    <div class="home-panel">
      <!-- 欢迎语常驻：不提供关闭按钮，内容由后台公告接口控制。 -->
      <aside
        v-if="announcement"
        class="notice-strip"
        aria-label="site notice"
      >
        <div class="notice-strip-header">
          <span>{{ announcementTitle }}</span>
        </div>
        <!-- eslint-disable vue/no-v-html -->
        <div
          class="notice-strip-content"
          v-html="announcementHtml"
        />
        <!-- eslint-enable vue/no-v-html -->
      </aside>

      <div class="home-row-top">
        <article class="home-card home-quote-card">
          <p class="home-card-eyebrow">
            {{ t('home.quoteLabel') }}
          </p>
          <HomeQuote />
        </article>

        <article class="home-card home-clock-card">
          <p class="home-card-eyebrow">
            {{ t('home.clockLabel') }}
          </p>
          <HomeClock />
        </article>
      </div>

      <div class="home-row-middle">
        <article class="home-card home-carousel-card">
          <HomeCarousel
            :slides="essaySlides"
            :label="t('home.carouselLabel')"
            :empty-text="t('home.empty')"
            :interval="5200"
            show-dots
          />
        </article>

        <div class="home-stack">
          <RouterLink
            v-if="latestEssay"
            class="home-card home-latest-card home-latest-link"
            :class="{ 'has-cover': Boolean(latestEssay.coverUrl) }"
            :style="latestEssayStyle"
            :to="essayLink(latestEssay)"
          >
            <span class="home-latest-copy">
              <span class="home-card-eyebrow">{{ t('home.latestEssay') }}</span>
              <strong>{{ latestEssay.title }}</strong>
              <span
                v-if="latestEssay.summary"
                class="home-latest-summary"
              >{{
                clip(latestEssay.summary, 64)
              }}</span>
            </span>
          </RouterLink>
          <article
            v-else
            class="home-card home-latest-card"
          >
            <span class="home-latest-copy">
              <span class="home-card-eyebrow">{{ t('home.latestEssay') }}</span>
              <span class="home-empty-text">{{ t('home.empty') }}</span>
            </span>
          </article>

          <div class="home-row-mini">
            <article class="home-card home-photo-card">
              <p class="home-card-eyebrow">
                {{ t('home.photoWall') }}
              </p>
              <HomeCarousel
                :slides="photoSlides"
                :label="t('home.photoWall')"
                :empty-text="t('home.empty')"
                :interval="4200"
              />
            </article>

            <article class="home-card home-messages-card">
              <p class="home-card-eyebrow">
                {{ t('home.recentMessages') }}
              </p>
              <ul
                v-if="recentMessages.length"
                class="home-message-list"
              >
                <li
                  v-for="message in recentMessages"
                  :key="message.id"
                >
                  <RouterLink
                    class="home-message-link"
                    to="/messages"
                  >
                    <strong class="home-message-nick">{{ message.nickname }}</strong>
                    <span class="home-message-text">{{ clip(message.content, 42) }}</span>
                  </RouterLink>
                </li>
              </ul>
              <p
                v-else
                class="home-empty-text"
              >
                {{ t('home.empty') }}
              </p>
            </article>
          </div>
        </div>
      </div>

      <div
        class="home-card home-status-card"
        :aria-label="t('home.statusLabel')"
      >
        <div class="home-status-identity">
          <p class="eyebrow">
            {{ publicName }}
          </p>
          <h1
            id="home-title"
            class="home-status-title"
          >
            {{ siteName }}
          </h1>
          <p class="summary home-status-summary">
            {{ homeIntroduction }}
          </p>
        </div>

        <div class="home-status-meta">
          <span class="home-status-pill home-status-online">
            <span
              class="home-status-dot"
              aria-hidden="true"
            />
            {{ t('home.statusOnline') }}
          </span>
          <span class="home-status-pill">{{ statusDaysLabel }}</span>
          <span class="home-status-pill">{{ statusCountsLabel }}</span>
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
          class="thought-error home-status-error"
          role="alert"
        >
          {{ likeError }}
        </p>
      </div>
    </div>
  </section>
</template>
