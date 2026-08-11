<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import InteractivePhotoCanvas from '../components/InteractivePhotoCanvas.vue';
import PageLoadingSkeleton from '../components/PageLoadingSkeleton.vue';
import { useI18n } from '../composables/useI18n';
import { publicApi, type PublicAlbum, type PublicPhoto } from '../services/api';

const { t } = useI18n();
const page = ref(1);
const pageSize = 18;
const total = ref(0);
const albums = ref<PublicAlbum[]>([]);
const photos = ref<PublicPhoto[]>([]);
const activeAlbumId = ref<number | null>(null);
const isLoading = ref(false);
const initialLoadPending = ref(true);
const loadErrorMessage = ref('');
const actionErrorMessage = ref('');
const busyLikeIds = ref(new Set<number>());
const previewPhoto = ref<PublicPhoto | null>(null);
const transitionPhotoId = ref<number | null>(null);
const closePreviewButton = ref<HTMLButtonElement | null>(null);
let requestSequence = 0;
let lastFocusedElement: HTMLElement | null = null;
let previousBodyOverflow = '';
let previewStateActive = false;

const hasMore = computed(() => photos.value.length < total.value);

onMounted(() => {
  void Promise.all([loadAlbums(), loadFirstPage()]);
  window.addEventListener('keydown', handleWindowKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleWindowKeydown);
  restorePreviewState(false);
});

async function loadAlbums() {
  try {
    albums.value = await publicApi.getPhotoAlbums();
  } catch {
    albums.value = [];
  }
}

async function loadFirstPage() {
  const requestId = ++requestSequence;
  initialLoadPending.value = true;
  actionErrorMessage.value = '';
  page.value = 1;
  photos.value = [];
  total.value = 0;
  await loadMore(requestId, true);
}

async function loadMore(requestId = requestSequence, force = false) {
  if (isLoading.value && !force) {
    return;
  }

  isLoading.value = true;
  loadErrorMessage.value = '';
  const requestedAlbumId = activeAlbumId.value;
  const requestedPage = page.value;

  try {
    const result = await publicApi.listPhotos({
      albumId: requestedAlbumId ?? undefined,
      page: requestedPage,
      pageSize,
    });
    if (requestId !== requestSequence) {
      return;
    }
    const seen = new Set(photos.value.map((photo) => photo.id));
    photos.value = [...photos.value, ...result.items.filter((photo) => !seen.has(photo.id))];
    total.value = result.pagination.total;
    page.value = requestedPage + 1;
  } catch {
    if (requestId === requestSequence) {
      loadErrorMessage.value = '照片加载失败，请稍后重试。';
    }
  } finally {
    if (requestId === requestSequence) {
      isLoading.value = false;
      initialLoadPending.value = false;
    }
  }
}

async function selectAlbum(albumId: number | null) {
  activeAlbumId.value = activeAlbumId.value === albumId ? null : albumId;
  await loadFirstPage();
}

async function toggleLike(photo: PublicPhoto) {
  if (busyLikeIds.value.has(photo.id)) {
    return;
  }

  busyLikeIds.value.add(photo.id);
  actionErrorMessage.value = '';
  try {
    const result = await publicApi.togglePhotoLike(photo.id);
    photo.liked = result.liked;
    photo.likeCount = result.likeCount;
  } catch {
    actionErrorMessage.value = t('feedback.likeFailed');
  } finally {
    busyLikeIds.value.delete(photo.id);
  }
}

function previewTransitionName(photo: PublicPhoto | null) {
  return photo && transitionPhotoId.value === photo.id && previewPhoto.value !== null
    ? 'photo-preview'
    : 'none';
}

async function runPhotoViewTransition(update: () => Promise<void>) {
  const viewTransitionDocument = document as Document & {
    startViewTransition?: (callback: () => Promise<void>) => { finished?: Promise<unknown> };
  };

  if (!viewTransitionDocument.startViewTransition) {
    await update();
    return;
  }

  const transition = viewTransitionDocument.startViewTransition(update);
  await transition.finished?.catch(() => undefined);
}

async function openPreview(photo: PublicPhoto) {
  if (previewPhoto.value) {
    return;
  }

  lastFocusedElement =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;
  previousBodyOverflow = document.body.style.overflow;
  previewStateActive = true;
  document.body.style.overflow = 'hidden';
  transitionPhotoId.value = photo.id;
  await nextTick();
  await runPhotoViewTransition(async () => {
    previewPhoto.value = photo;
    await nextTick();
  });
  closePreviewButton.value?.focus();
}

async function closePreview() {
  const current = previewPhoto.value;
  if (!current) {
    return;
  }

  transitionPhotoId.value = current.id;
  await nextTick();
  await runPhotoViewTransition(async () => {
    previewPhoto.value = null;
    await nextTick();
  });
  transitionPhotoId.value = null;
  restorePreviewState(true);
}

function handleWindowKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && previewPhoto.value) {
    event.preventDefault();
    void closePreview();
  }
}

function keepPreviewFocus(event: KeyboardEvent) {
  event.preventDefault();
  closePreviewButton.value?.focus();
}

function restorePreviewState(restoreFocus: boolean) {
  if (!previewStateActive) {
    return;
  }

  document.body.style.overflow = previousBodyOverflow;
  previewStateActive = false;

  if (restoreFocus && lastFocusedElement?.isConnected) {
    lastFocusedElement.focus();
  }

  lastFocusedElement = null;
}
</script>

<template>
  <div class="photos-route">
    <section
      class="photos-page"
      aria-labelledby="photos-title"
      :aria-hidden="previewPhoto ? 'true' : undefined"
      :inert="previewPhoto ? true : undefined"
    >
      <p class="page-placeholder-eyebrow">
        {{ t('nav.photos') }}
      </p>
      <h1 id="photos-title">
        {{ t('page.photos.title') }}
      </h1>

      <div
        v-if="albums.length"
        class="photo-filter"
        aria-label="photo albums"
      >
        <button
          type="button"
          :class="{ active: activeAlbumId === null }"
          @click="selectAlbum(null)"
        >
          全部
        </button>
        <button
          v-for="album in albums"
          :key="album.id"
          type="button"
          :class="{ active: activeAlbumId === album.id }"
          @click="selectAlbum(album.id)"
        >
          {{ album.name }}
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
          v-if="loadErrorMessage && photos.length === 0"
          class="load-more content-retry"
          type="button"
          :disabled="isLoading"
          @click="loadFirstPage"
        >
          {{ t('action.retry') }}
        </button>
      </div>

      <PageLoadingSkeleton
        v-if="initialLoadPending && photos.length === 0"
        variant="photos"
        label="正在装裱照片…"
      />

      <InteractivePhotoCanvas
        v-if="photos.length"
        :photos="photos"
        :busy-like-ids="busyLikeIds"
        :preview-open="previewPhoto !== null"
        :transition-photo-id="transitionPhotoId"
        @preview="openPreview"
        @toggle-like="toggleLike"
      />

      <div
        v-if="!initialLoadPending && !isLoading && !loadErrorMessage && photos.length === 0"
        class="empty-state"
      >
        暂无公开照片。
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

    <div
      v-if="previewPhoto"
      class="photo-lightbox"
      role="dialog"
      aria-modal="true"
      @click.self="closePreview"
      @keydown.tab="keepPreviewFocus"
    >
      <figure>
        <img
          :src="previewPhoto.largeUrl || previewPhoto.originalUrl"
          :alt="previewPhoto.title"
          :style="{ viewTransitionName: previewTransitionName(previewPhoto) }"
        >
        <figcaption>
          <strong>{{ previewPhoto.title }}</strong>
          <span
            v-if="previewPhoto.description"
            class="photo-lightbox-description"
          >
            {{ previewPhoto.description }}
          </span>
        </figcaption>
        <button
          ref="closePreviewButton"
          type="button"
          @click="closePreview"
        >
          关闭
        </button>
      </figure>
    </div>
  </div>
</template>
