<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import HeartLikeButton from '../components/HeartLikeButton.vue';
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
const errorMessage = ref('');
const previewPhoto = ref<PublicPhoto | null>(null);
const transitionPhotoId = ref<number | null>(null);

const hasMore = computed(() => photos.value.length < total.value);

onMounted(() => {
  void Promise.all([loadAlbums(), loadFirstPage()]);
});

async function loadAlbums() {
  try {
    albums.value = await publicApi.getPhotoAlbums();
  } catch {
    albums.value = [];
  }
}

async function loadFirstPage() {
  page.value = 1;
  photos.value = [];
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
    const result = await publicApi.listPhotos({
      albumId: activeAlbumId.value ?? undefined,
      page: page.value,
      pageSize,
    });
    const seen = new Set(photos.value.map((photo) => photo.id));
    photos.value = [...photos.value, ...result.items.filter((photo) => !seen.has(photo.id))];
    total.value = result.pagination.total;
    page.value += 1;
  } catch {
    errorMessage.value = '照片加载失败，请稍后重试。';
  } finally {
    isLoading.value = false;
  }
}

async function selectAlbum(albumId: number | null) {
  activeAlbumId.value = activeAlbumId.value === albumId ? null : albumId;
  await loadFirstPage();
}

async function toggleLike(photo: PublicPhoto) {
  try {
    const result = await publicApi.togglePhotoLike(photo.id);
    photo.liked = result.liked;
    photo.likeCount = result.likeCount;
  } catch {
    errorMessage.value = '点赞失败，请稍后重试。';
  }
}

function thumbnailTransitionName(photo: PublicPhoto) {
  return transitionPhotoId.value === photo.id && previewPhoto.value === null
    ? 'photo-preview'
    : 'none';
}

function previewTransitionName(photo: PublicPhoto | null) {
  return photo && transitionPhotoId.value === photo.id && previewPhoto.value !== null
    ? 'photo-preview'
    : 'none';
}

async function runPhotoViewTransition(update: () => Promise<void>) {
  const startViewTransition = (
    document as Document & {
      startViewTransition?: (callback: () => Promise<void>) => { finished?: Promise<unknown> };
    }
  ).startViewTransition;

  if (!startViewTransition) {
    await update();
    return;
  }

  const transition = startViewTransition(update);
  await transition.finished?.catch(() => undefined);
}

async function openPreview(photo: PublicPhoto) {
  transitionPhotoId.value = photo.id;
  await nextTick();
  await runPhotoViewTransition(async () => {
    previewPhoto.value = photo;
    await nextTick();
  });
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
}
</script>

<template>
  <div class="photos-route">
    <section
      class="photos-page"
      aria-labelledby="photos-title"
      :aria-busy="isLoading"
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

      <p
        v-if="errorMessage"
        class="thought-error"
      >
        {{ errorMessage }}
      </p>

      <div class="photo-wall">
        <article
          v-for="photo in photos"
          :key="photo.id"
          class="photo-tile"
        >
          <button
            type="button"
            class="photo-preview-button"
            @click="openPreview(photo)"
          >
            <img
              :src="photo.thumbUrl || photo.largeUrl || photo.originalUrl"
              :alt="photo.title"
              :style="{ viewTransitionName: thumbnailTransitionName(photo) }"
            >
          </button>
          <div class="photo-tile-caption">
            <div>
              <strong>{{ photo.title }}</strong>
              <span>{{ photo.album?.name ?? '未分组' }}</span>
            </div>
            <HeartLikeButton
              :liked="photo.liked"
              :like-count="photo.likeCount"
              @toggle="toggleLike(photo)"
            />
          </div>
        </article>
      </div>

      <div
        v-if="!isLoading && photos.length === 0"
        class="empty-state"
      >
        暂无公开照片。
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

    <div
      v-if="previewPhoto"
      class="photo-lightbox"
      role="dialog"
      aria-modal="true"
      @click.self="closePreview"
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
          type="button"
          @click="closePreview"
        >
          关闭
        </button>
      </figure>
    </div>
  </div>
</template>
