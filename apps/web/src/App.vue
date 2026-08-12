<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import BootTerminal from './components/BootTerminal.vue';
import NavigationTree from './components/NavigationTree.vue';
import MascotWidget from './components/MascotWidget.vue';
import MusicPlayer from './components/MusicPlayer.vue';
import SearchDialog from './components/SearchDialog.vue';
import { mapApiNavigation, mapLocalNavigation, publicNavigation } from './config/navigation';
import { useI18n } from './composables/useI18n';
import { useLoading } from './composables/useLoading';
import { useTheme } from './composables/useTheme';
import { publicApi } from './services/api';
import { readPreviewMode } from './utils/preview';
import { getVisitorId } from './utils/visitor';

const route = useRoute();
const { isLoading } = useLoading();
const { isDark, toggleTheme } = useTheme();
const { locale, localeLabels, setLocale, t } = useI18n();

const apiNavigation = ref(null);
const announcementAvailable = ref(false);
const mobileMenuOpen = ref(false);
const searchOpen = ref(false);
const isPreview = ref(readPreviewMode());
// 开屏终端：进入首页时置 true（全新挂载），播完/离开时置 false（卸载）。
// 用 v-if 而非 :key，确保「每次进入首页」都是一次完整的新挂载，
// onMounted 才会重新执行、动画才会重播。
const bootOpen = ref(false);
const lastTrackedVisit = ref('');

const sortedNavigation = computed(() =>
  apiNavigation.value
    ? mapApiNavigation(apiNavigation.value, t)
    : mapLocalNavigation(publicNavigation, t),
);
const themeLabel = computed(() =>
  isDark.value ? t('settings.themeDark') : t('settings.themeLight'),
);
getVisitorId();

onMounted(() => {
  loadPublicNavigation();
  loadAnnouncementAvailability();
  recordCurrentVisit();
});

watch(
  () => route.name,
  (name) => {
    // 开屏终端：每次进入首页都重新挂载（v-if false→true），由
    // BootTerminal 内部决定本次是否播放（开发期总播 / 定稿后按记忆）。
    // 离开首页时强制卸载，保证「再进首页」能再次完整挂载。
    if (name === 'home') {
      bootOpen.value = true;
    } else {
      bootOpen.value = false;
    }
  },
  { immediate: true },
);

watch(
  () => route.fullPath,
  () => {
    mobileMenuOpen.value = false;
    searchOpen.value = false;
    isPreview.value = readPreviewMode();
    recordCurrentVisit();
  },
);

function updateLocale(event) {
  if (event.target instanceof HTMLSelectElement) {
    setLocale(event.target.value);
  }
}

async function loadPublicNavigation() {
  try {
    apiNavigation.value = await publicApi.getNavigation();
  } catch {
    apiNavigation.value = null;
  }
}

async function loadAnnouncementAvailability() {
  try {
    announcementAvailable.value = Boolean(await publicApi.getAnnouncement());
  } catch {
    announcementAvailable.value = false;
  }
}

function openAnnouncement() {
  window.dispatchEvent(new CustomEvent('open-site-announcement'));
}

function recordCurrentVisit() {
  if (isPreview.value || lastTrackedVisit.value === route.fullPath) {
    return;
  }

  lastTrackedVisit.value = route.fullPath;
  publicApi.recordVisit(resolveVisitTarget()).catch(() => undefined);
}

function resolveVisitTarget() {
  const routeName = typeof route.name === 'string' ? route.name : '';

  if (routeName === 'thoughts') {
    return { pageId: 'thoughts', pageType: 'thought', path: route.path };
  }

  if (routeName === 'essays') {
    return { pageId: 'essays', pageType: 'essay', path: route.path };
  }

  if (routeName === 'essay-detail') {
    return { pageId: String(route.params.idOrSlug ?? ''), pageType: 'essay', path: route.path };
  }

  if (routeName === 'photos') {
    return { pageId: 'photos', pageType: 'photo', path: route.path };
  }

  if (routeName === 'messages') {
    return { pageId: 'messages', pageType: 'message', path: route.path };
  }

  if (routeName === 'custom-page') {
    return { pageId: String(route.params.slug ?? ''), pageType: 'page', path: route.path };
  }

  if (routeName === 'about') {
    return { pageId: 'about', pageType: 'page', path: route.path };
  }

  if (routeName === 'error-500') {
    return { pageId: '500', pageType: 'site', path: route.path };
  }

  if (routeName === 'not-found') {
    return { pageId: '404', pageType: 'site', path: route.path };
  }

  return { pageId: routeName || 'home', pageType: 'site', path: route.path };
}

function resolveRouteViewKey(activeRoute) {
  if (activeRoute.name === 'search') {
    return `${activeRoute.path}?preview=${String(activeRoute.query.preview ?? '')}`;
  }

  return activeRoute.fullPath;
}
</script>

<template>
  <div class="site-shell">
    <header class="site-header">
      <RouterLink
        class="brand"
        to="/"
        @click="mobileMenuOpen = false"
      >
        <span
          class="brand-mark"
          aria-hidden="true"
        > Y </span>
        <span>
          {{ t('app.brand') }}
        </span>
      </RouterLink>

      <nav
        class="desktop-nav"
        aria-label="primary navigation"
      >
        <NavigationTree
          :items="sortedNavigation"
          variant="desktop"
        />
      </nav>

      <div class="site-actions">
        <label
          class="visually-hidden"
          for="language-select"
        >
          {{ t('settings.language') }}
        </label>
        <select
          id="language-select"
          :value="locale"
          @change="updateLocale"
        >
          <option
            v-for="(label, value) in localeLabels"
            :key="value"
            :value="value"
          >
            {{ label }}
          </option>
        </select>

        <button
          class="search-toggle"
          type="button"
          @click="searchOpen = true"
        >
          {{ t('search.action') }}
        </button>

        <button
          class="theme-toggle"
          type="button"
          @click="toggleTheme"
        >
          <span aria-hidden="true">{{ isDark ? 'Moon' : 'Sun' }}</span>
          {{ themeLabel }}
        </button>

        <button
          v-if="announcementAvailable"
          class="announcement-toggle"
          type="button"
          aria-label="查看公告"
          @click="openAnnouncement"
        >
          <span aria-hidden="true">i</span>
        </button>

        <button
          class="menu-toggle"
          type="button"
          :aria-expanded="mobileMenuOpen"
          aria-controls="mobile-navigation"
          @click="mobileMenuOpen = !mobileMenuOpen"
        >
          {{ t('settings.menu') }}
        </button>
      </div>
    </header>

    <Transition name="mobile-panel">
      <nav
        v-if="mobileMenuOpen"
        id="mobile-navigation"
        class="mobile-nav"
        aria-label="mobile navigation"
      >
        <NavigationTree
          :items="sortedNavigation"
          variant="mobile"
          @navigate="mobileMenuOpen = false"
        />
      </nav>
    </Transition>

    <div
      v-if="isPreview"
      class="preview-badge"
      role="status"
    >
      {{ t('app.preview') }}
    </div>

    <Transition name="loader-fade">
      <div
        v-if="isLoading"
        class="global-loader"
        role="status"
        aria-live="polite"
      >
        <span
          class="global-loader-dot"
          aria-hidden="true"
        />
        {{ t('loading.label') }}
      </div>
    </Transition>

    <main class="site-main">
      <RouterView v-slot="{ Component, route: activeRoute }">
        <Transition
          name="page-shift"
          mode="out-in"
        >
          <component
            :is="Component"
            :key="resolveRouteViewKey(activeRoute)"
          />
        </Transition>
      </RouterView>
    </main>

    <SearchDialog
      :open="searchOpen"
      @close="searchOpen = false"
    />
    <MusicPlayer />
    <MascotWidget />
    <BootTerminal
      v-if="bootOpen"
      @done="bootOpen = false"
    />
  </div>
</template>
