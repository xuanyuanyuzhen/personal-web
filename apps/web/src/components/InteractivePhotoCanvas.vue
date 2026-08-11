<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { PublicPhoto } from '../services/api';
import HeartLikeButton from './HeartLikeButton.vue';

type InteractionMode = 'move' | 'resize' | 'rotate';

interface PhotoLayout {
  rotation: number;
  width: number;
  x: number;
  y: number;
}

interface ActiveInteraction {
  centerX: number;
  centerY: number;
  id: number;
  mode: InteractionMode;
  moved: boolean;
  pointerAngle: number;
  pointerX: number;
  pointerY: number;
  start: PhotoLayout;
}

const props = defineProps<{
  busyLikeIds?: Set<number>;
  photos: PublicPhoto[];
  previewOpen: boolean;
  transitionPhotoId: number | null;
}>();

const emit = defineEmits<{
  preview: [photo: PublicPhoto];
  toggleLike: [photo: PublicPhoto];
}>();

const canvasRef = ref<HTMLElement | null>(null);
const canvasHeight = ref(600);
const layoutReady = ref(false);
const layouts = ref<Record<number, PhotoLayout>>({});
const initialLayouts = ref<Record<number, PhotoLayout>>({});
const selectedPhotoId = ref<number | null>(null);
const suppressPreviewId = ref<number | null>(null);
const photoElements = new Map<number, HTMLElement>();
let activeInteraction: ActiveInteraction | null = null;
let resizeObserver: ResizeObserver | null = null;
let lastCanvasWidth = 0;

watch(
  () => props.photos.map((photo) => photo.id).join(','),
  async () => {
    const photoIds = new Set(props.photos.map((photo) => photo.id));
    layouts.value = Object.fromEntries(
      Object.entries(layouts.value).filter(([id]) => photoIds.has(Number(id))),
    );
    initialLayouts.value = Object.fromEntries(
      Object.entries(initialLayouts.value).filter(([id]) => photoIds.has(Number(id))),
    );
    layoutReady.value = false;
    await nextTick();
    layoutPhotos();
  },
  { flush: 'post' },
);

onMounted(async () => {
  await nextTick();
  layoutPhotos();

  if (typeof ResizeObserver !== 'undefined' && canvasRef.value) {
    resizeObserver = new ResizeObserver(([entry]) => {
      const nextWidth = entry?.contentRect.width ?? 0;
      if (Math.abs(nextWidth - lastCanvasWidth) > 1) {
        layoutPhotos(true);
      }
    });
    resizeObserver.observe(canvasRef.value);
  }
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  removePointerListeners();
});

function setPhotoElement(id: number, element: unknown) {
  if (element instanceof HTMLElement) {
    photoElements.set(id, element);
  } else {
    photoElements.delete(id);
  }
}

function layoutPhotos(force = false) {
  const canvas = canvasRef.value;
  if (!canvas || props.photos.length === 0) {
    layoutReady.value = true;
    return;
  }

  const canvasWidth = canvas.clientWidth || 960;
  lastCanvasWidth = canvasWidth;
  const padding = canvasWidth < 520 ? 16 : 24;
  const gap = canvasWidth < 520 ? 18 : 28;
  const cardWidth =
    canvasWidth >= 900 ? 250 : canvasWidth >= 620 ? 220 : Math.min(240, canvasWidth - 40);
  const columns = Math.max(1, Math.floor((canvasWidth - padding * 2 + gap) / (cardWidth + gap)));
  const rowHeight = cardWidth * 0.75 + 116;
  const rows = Math.ceil(props.photos.length / columns);

  canvasHeight.value = Math.max(canvasWidth < 520 ? 520 : 600, rows * rowHeight + 88);

  const nextLayouts = { ...layouts.value };
  const nextInitialLayouts = { ...initialLayouts.value };
  props.photos.forEach((photo, index) => {
    if (!force && nextLayouts[photo.id]) {
      nextLayouts[photo.id] = constrainLayout(nextLayouts[photo.id], photo.id, canvasWidth);
      return;
    }

    const column = index % columns;
    const row = Math.floor(index / columns);
    const rowItems = Math.min(columns, props.photos.length - row * columns);
    const rowWidth = rowItems * cardWidth + (rowItems - 1) * gap;
    const rowOffset = Math.max(padding, (canvasWidth - rowWidth) / 2);
    const rotationPattern = [-3, 2, -1, 3, -2, 1];

    const initialLayout = constrainLayout(
      {
        rotation: rotationPattern[index % rotationPattern.length],
        width: cardWidth,
        x: rowOffset + column * (cardWidth + gap),
        y: 58 + row * rowHeight,
      },
      photo.id,
      canvasWidth,
    );
    nextLayouts[photo.id] = initialLayout;
    nextInitialLayouts[photo.id] = { ...initialLayout };
  });

  layouts.value = nextLayouts;
  initialLayouts.value = nextInitialLayouts;
  layoutReady.value = true;
}

function photoStyle(photo: PublicPhoto) {
  const layout = layouts.value[photo.id];
  if (!layout) {
    return { opacity: 0 };
  }

  return {
    opacity: 1,
    transform: `translate3d(${layout.x}px, ${layout.y}px, 0) rotate(${layout.rotation}deg)`,
    width: `${layout.width}px`,
    zIndex: selectedPhotoId.value === photo.id ? 20 : 1,
  };
}

function thumbnailTransitionName(photo: PublicPhoto) {
  return props.transitionPhotoId === photo.id && !props.previewOpen ? 'photo-preview' : 'none';
}

function startMove(id: number, event: PointerEvent) {
  const target = event.target instanceof Element ? event.target : null;
  if (
    target?.closest(
      '.photo-card-controls, .photo-resize-handle, .photo-rotate-handle, .heart-like-button',
    )
  ) {
    return;
  }

  startInteraction(id, 'move', event);
}

function startInteraction(id: number, mode: InteractionMode, event: PointerEvent) {
  const layout = layouts.value[id];
  const canvas = canvasRef.value;
  if (!layout || !canvas || event.button !== 0) {
    return;
  }

  selectedPhotoId.value = id;
  const canvasRect = canvas.getBoundingClientRect();
  const height = estimatePhotoHeight(layout, id);
  const centerX = canvasRect.left + layout.x + layout.width / 2;
  const centerY = canvasRect.top + layout.y + height / 2;

  activeInteraction = {
    centerX,
    centerY,
    id,
    mode,
    moved: false,
    pointerAngle: Math.atan2(event.clientY - centerY, event.clientX - centerX),
    pointerX: event.clientX,
    pointerY: event.clientY,
    start: { ...layout },
  };

  window.addEventListener('pointermove', handlePointerMove, { passive: false });
  window.addEventListener('pointerup', handlePointerUp, { once: true });
}

function handlePointerMove(event: PointerEvent) {
  const interaction = activeInteraction;
  if (!interaction) {
    return;
  }

  event.preventDefault();
  const deltaX = event.clientX - interaction.pointerX;
  const deltaY = event.clientY - interaction.pointerY;
  interaction.moved ||= Math.hypot(deltaX, deltaY) > 3;

  let nextLayout = { ...interaction.start };
  if (interaction.mode === 'move') {
    nextLayout.x += deltaX;
    nextLayout.y += deltaY;
  } else if (interaction.mode === 'resize') {
    nextLayout.width += (deltaX + deltaY) * 0.5;
  } else {
    const nextAngle = Math.atan2(
      event.clientY - interaction.centerY,
      event.clientX - interaction.centerX,
    );
    nextLayout.rotation += ((nextAngle - interaction.pointerAngle) * 180) / Math.PI;
  }

  layouts.value = {
    ...layouts.value,
    [interaction.id]: constrainLayout(nextLayout, interaction.id),
  };
}

function handlePointerUp() {
  if (activeInteraction?.mode === 'move' && activeInteraction.moved) {
    suppressPreviewId.value = activeInteraction.id;
  }
  activeInteraction = null;
  removePointerListeners();
}

function removePointerListeners() {
  window.removeEventListener('pointermove', handlePointerMove);
  window.removeEventListener('pointerup', handlePointerUp);
}

function constrainLayout(layout: PhotoLayout, id: number, forcedCanvasWidth?: number) {
  const canvas = canvasRef.value;
  const canvasWidth = forcedCanvasWidth ?? canvas?.clientWidth ?? 960;
  const availableHeight = canvasHeight.value;
  const maxWidth = Math.min(420, canvasWidth * 0.72);
  const width = clamp(layout.width, Math.min(140, maxWidth), maxWidth);
  const normalizedRotation = normalizeRotation(layout.rotation);
  const height = estimatePhotoHeight({ ...layout, width }, id);
  const radians = (normalizedRotation * Math.PI) / 180;
  const halfWidth =
    (Math.abs(Math.cos(radians)) * width + Math.abs(Math.sin(radians)) * height) / 2;
  const halfHeight =
    (Math.abs(Math.sin(radians)) * width + Math.abs(Math.cos(radians)) * height) / 2;
  const padding = 8;
  const minCenterX = halfWidth + padding;
  const maxCenterX = Math.max(minCenterX, canvasWidth - halfWidth - padding);
  const minCenterY = halfHeight + padding;
  const maxCenterY = Math.max(minCenterY, availableHeight - halfHeight - padding);
  const centerX = clamp(layout.x + width / 2, minCenterX, maxCenterX);
  const centerY = clamp(layout.y + height / 2, minCenterY, maxCenterY);

  return {
    rotation: normalizedRotation,
    width,
    x: centerX - width / 2,
    y: centerY - height / 2,
  };
}

function estimatePhotoHeight(layout: PhotoLayout, id: number) {
  const elementHeight = photoElements.get(id)?.offsetHeight ?? 0;
  return Math.max(elementHeight, layout.width * 0.75 + 72);
}

function normalizeRotation(value: number) {
  return ((((value + 180) % 360) + 360) % 360) - 180;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function handlePreview(photo: PublicPhoto) {
  if (suppressPreviewId.value === photo.id) {
    suppressPreviewId.value = null;
    return;
  }
  emit('preview', photo);
}

function rotatePhoto(id: number, delta: number) {
  const layout = layouts.value[id];
  if (!layout) {
    return;
  }
  layouts.value = {
    ...layouts.value,
    [id]: constrainLayout({ ...layout, rotation: layout.rotation + delta }, id),
  };
}

function resetPhoto(id: number) {
  const initialLayout = initialLayouts.value[id];
  if (!initialLayout) {
    return;
  }
  layouts.value = { ...layouts.value, [id]: constrainLayout({ ...initialLayout }, id) };
}

function handleKeydown(id: number, event: KeyboardEvent) {
  const layout = layouts.value[id];
  if (!layout) {
    return;
  }

  const step = event.shiftKey ? 24 : 8;
  const nextLayout = { ...layout };
  if (event.key === 'ArrowLeft') {
    nextLayout.x -= step;
  } else if (event.key === 'ArrowRight') {
    nextLayout.x += step;
  } else if (event.key === 'ArrowUp') {
    nextLayout.y -= step;
  } else if (event.key === 'ArrowDown') {
    nextLayout.y += step;
  } else if (event.key === '[') {
    nextLayout.rotation -= 5;
  } else if (event.key === ']') {
    nextLayout.rotation += 5;
  } else if (event.key === '-' || event.key === '_') {
    nextLayout.width -= 12;
  } else if (event.key === '+' || event.key === '=') {
    nextLayout.width += 12;
  } else {
    return;
  }

  event.preventDefault();
  selectedPhotoId.value = id;
  layouts.value = { ...layouts.value, [id]: constrainLayout(nextLayout, id) };
}
</script>

<template>
  <div
    ref="canvasRef"
    class="photo-canvas"
    :class="{ 'is-ready': layoutReady }"
    :style="{ height: `${canvasHeight}px` }"
    role="group"
    aria-label="可自由排列的照片墙"
  >
    <p class="photo-canvas-hint">
      拖动照片调整位置，拖拽上方圆点旋转，拖拽右下角缩放。
    </p>

    <article
      v-for="photo in photos"
      :key="photo.id"
      :ref="(element) => setPhotoElement(photo.id, element)"
      class="photo-tile photo-tile-interactive"
      :class="{ selected: selectedPhotoId === photo.id }"
      :style="photoStyle(photo)"
      :aria-label="`${photo.title}，可拖拽调整`"
      tabindex="0"
      @focus="selectedPhotoId = photo.id"
      @keydown="handleKeydown(photo.id, $event)"
      @pointerdown="startMove(photo.id, $event)"
    >
      <div
        v-if="selectedPhotoId === photo.id"
        class="photo-card-controls"
        aria-label="照片调整工具"
      >
        <button
          class="photo-card-control"
          type="button"
          @click="rotatePhoto(photo.id, -15)"
        >
          −15°
        </button>
        <button
          class="photo-card-control"
          type="button"
          @click="rotatePhoto(photo.id, 15)"
        >
          +15°
        </button>
        <button
          class="photo-card-control"
          type="button"
          @click="resetPhoto(photo.id)"
        >
          复位
        </button>
      </div>

      <button
        v-if="selectedPhotoId === photo.id"
        class="photo-rotate-handle"
        type="button"
        :aria-label="`旋转${photo.title}`"
        @pointerdown.stop="startInteraction(photo.id, 'rotate', $event)"
      />

      <button
        type="button"
        class="photo-preview-button"
        @click="handlePreview(photo)"
      >
        <img
          :src="photo.thumbUrl || photo.largeUrl || photo.originalUrl"
          :alt="photo.title"
          :style="{ viewTransitionName: thumbnailTransitionName(photo) }"
          draggable="false"
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
          :disabled="busyLikeIds?.has(photo.id)"
          @toggle="emit('toggleLike', photo)"
        />
      </div>

      <button
        v-if="selectedPhotoId === photo.id"
        class="photo-resize-handle"
        type="button"
        :aria-label="`缩放${photo.title}`"
        @pointerdown.stop="startInteraction(photo.id, 'resize', $event)"
      />
    </article>
  </div>
</template>
