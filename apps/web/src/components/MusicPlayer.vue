<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useI18n } from '../composables/useI18n';
import { publicApi } from '../services/api';

const STORAGE_KEY = 'yuer.musicPlayer';

const { t } = useI18n();
const audioRef = ref(null);
const tracks = ref([]);
const currentIndex = ref(0);
const isPlaying = ref(false);
const expanded = ref(false);
const mode = ref('list');
const currentTime = ref(0);
const lyricLines = ref([]);
const lyricTextFallback = ref('');

const currentTrack = computed(() => tracks.value[currentIndex.value] ?? null);
const currentSrc = computed(() => currentTrack.value?.localUrl || currentTrack.value?.externalUrl || '');
const hasTracks = computed(() => tracks.value.length > 0);
const currentLyric = computed(() => {
  if (lyricLines.value.length === 0) {
    return lyricTextFallback.value;
  }

  let line = lyricLines.value[0];
  for (const item of lyricLines.value) {
    if (item.time <= currentTime.value) {
      line = item;
    } else {
      break;
    }
  }

  return line?.text ?? '';
});

onMounted(async () => {
  restoreState();
  await loadMusic();
});

watch([currentIndex, mode, expanded], persistState);

watch(currentTrack, () => {
  void loadLyrics();
});

async function loadMusic() {
  try {
    const result = await publicApi.getMusic();
    tracks.value = Array.isArray(result) ? result.filter((item) => item && (item.localUrl || item.externalUrl)) : [];
    clampCurrentIndex();
    await nextTick();
    audioRef.value?.load();
    await loadLyrics();
  } catch {
    tracks.value = [];
  }
}

function restoreState() {
  try {
    const state = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
    if (Number.isInteger(state.currentIndex) && state.currentIndex >= 0) {
      currentIndex.value = state.currentIndex;
    }
    if (['list', 'single', 'random'].includes(state.mode)) {
      mode.value = state.mode;
    }
    expanded.value = Boolean(state.expanded);
  } catch {
    currentIndex.value = 0;
  }
}

function persistState() {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      currentIndex: currentIndex.value,
      expanded: expanded.value,
      mode: mode.value,
    }),
  );
}

function clampCurrentIndex() {
  if (currentIndex.value >= tracks.value.length) {
    currentIndex.value = 0;
  }
}

async function togglePlay() {
  if (!audioRef.value || !currentSrc.value) {
    return;
  }

  if (isPlaying.value) {
    audioRef.value.pause();
    isPlaying.value = false;
    return;
  }

  try {
    await audioRef.value.play();
    isPlaying.value = true;
  } catch {
    isPlaying.value = false;
  }
}

function previousTrack() {
  if (tracks.value.length === 0) {
    return;
  }

  currentIndex.value = (currentIndex.value - 1 + tracks.value.length) % tracks.value.length;
  void syncAudioAfterTrackChange();
}

function nextTrack() {
  if (tracks.value.length === 0) {
    return;
  }

  if (mode.value === 'random' && tracks.value.length > 1) {
    let nextIndex = currentIndex.value;
    while (nextIndex === currentIndex.value) {
      nextIndex = Math.floor(Math.random() * tracks.value.length);
    }
    currentIndex.value = nextIndex;
  } else {
    currentIndex.value = (currentIndex.value + 1) % tracks.value.length;
  }

  void syncAudioAfterTrackChange();
}

async function syncAudioAfterTrackChange() {
  const shouldResume = isPlaying.value;
  isPlaying.value = false;
  await nextTick();
  audioRef.value?.load();

  if (shouldResume) {
    await togglePlay();
  }
}

function cycleMode() {
  mode.value = mode.value === 'list' ? 'single' : mode.value === 'single' ? 'random' : 'list';
}

function handleEnded() {
  if (!audioRef.value) {
    return;
  }

  if (mode.value === 'single') {
    audioRef.value.currentTime = 0;
    void togglePlay();
    return;
  }

  nextTrack();
}

function handleTimeUpdate() {
  currentTime.value = audioRef.value?.currentTime ?? 0;
}

async function loadLyrics() {
  lyricLines.value = [];
  lyricTextFallback.value = '';
  currentTime.value = 0;
  const track = currentTrack.value;
  if (!track) {
    return;
  }

  let text = track.lyricText?.trim() ?? '';
  if (!text && track.lyricFileUrl) {
    try {
      const response = await fetch(track.lyricFileUrl);
      text = response.ok ? await response.text() : '';
    } catch {
      text = '';
    }
  }

  const parsed = parseLyrics(text);
  if (parsed.length > 0) {
    lyricLines.value = parsed;
    return;
  }

  lyricTextFallback.value = text || `${track.title} - ${track.artist}`;
}

function parseLyrics(text) {
  return text
    .split(/\r?\n/)
    .map((line) => {
      const match = line.match(/^\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?]\s*(.*)$/);
      if (!match) {
        return null;
      }

      const minutes = Number(match[1]);
      const seconds = Number(match[2]);
      const fraction = Number((match[3] ?? '0').padEnd(3, '0'));
      return {
        text: match[4]?.trim() || '',
        time: minutes * 60 + seconds + fraction / 1000,
      };
    })
    .filter(Boolean)
    .sort((first, second) => first.time - second.time);
}
</script>

<template>
  <aside
    v-if="hasTracks"
    class="music-player"
    :class="{ 'music-player-expanded': expanded }"
    :aria-label="t('music.label')"
  >
    <audio
      ref="audioRef"
      :src="currentSrc"
      preload="metadata"
      @ended="handleEnded"
      @pause="isPlaying = false"
      @play="isPlaying = true"
      @timeupdate="handleTimeUpdate"
    />

    <div class="music-player-main">
      <button
        class="music-icon-button"
        type="button"
        :aria-label="isPlaying ? t('music.pause') : t('music.play')"
        @click="togglePlay"
      >
        {{ isPlaying ? 'Pause' : 'Play' }}
      </button>

      <button
        class="music-track"
        type="button"
        @click="expanded = !expanded"
      >
        <strong>{{ currentTrack?.title }}</strong>
        <span>{{ currentTrack?.artist }}</span>
      </button>

      <button
        class="music-icon-button"
        type="button"
        :aria-label="t('music.previous')"
        @click="previousTrack"
      >
        Prev
      </button>
      <button
        class="music-icon-button"
        type="button"
        :aria-label="t('music.next')"
        @click="nextTrack"
      >
        Next
      </button>
      <button
        class="music-mode-button"
        type="button"
        :aria-label="t('music.mode')"
        @click="cycleMode"
      >
        {{ mode === 'single' ? t('music.single') : mode === 'random' ? t('music.random') : t('music.list') }}
      </button>
    </div>

    <div
      v-if="expanded"
      class="music-player-panel"
    >
      <p class="music-lyric">
        {{ currentLyric }}
      </p>
      <div class="music-playlist">
        <button
          v-for="(track, index) in tracks"
          :key="track.id"
          class="music-playlist-item"
          type="button"
          :class="{ active: index === currentIndex }"
          @click="currentIndex = index; syncAudioAfterTrackChange()"
        >
          <span>{{ track.title }}</span>
          <small>{{ track.artist }}</small>
        </button>
      </div>
    </div>
  </aside>
</template>
