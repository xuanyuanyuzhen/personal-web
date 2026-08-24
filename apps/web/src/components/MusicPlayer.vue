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
const playbackError = ref('');
let lyricRequestSequence = 0;

const currentTrack = computed(() => tracks.value[currentIndex.value] ?? null);
const currentSrc = computed(
  () => currentTrack.value?.localUrl || currentTrack.value?.externalUrl || '',
);
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
    tracks.value = Array.isArray(result)
      ? result.filter((item) => item && (item.localUrl || item.externalUrl))
      : [];
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
  // 后台删歌后，用户 localStorage 里存的旧索引可能超出当前列表长度。
  // 不修正的话 currentTrack 会是 undefined，模板里 currentTrack?.title 显示空白，
  // 播放器看起来「坏了」但不报错。
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
    playbackError.value = '';
    await audioRef.value.play();
    isPlaying.value = true;
  } catch {
    // 播放失败最常见的原因是浏览器自动播放策略拦截，其次是音频地址失效。
    // 原来这里静默吞掉异常，用户只看到「点了没反应」，无从判断。
    isPlaying.value = false;
    playbackError.value = t('music.playFailed');
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
    currentIndex.value = pickRandomOtherIndex(currentIndex.value, tracks.value.length);
  } else {
    currentIndex.value = (currentIndex.value + 1) % tracks.value.length;
  }

  void syncAudioAfterTrackChange();
}

/**
 * 从「除 current 之外」的下标里等概率取一个。
 *
 * 原来是 `while (next === current) next = random()` —— 无界循环，虽然
 * length > 1 时期望只转两次，但没有上界。这里先在 length-1 个候选里取，
 * 再把落在 current 及其之后的下标后移一位，一次就得到结果。
 */
function pickRandomOtherIndex(current, length) {
  const picked = Math.floor(Math.random() * (length - 1));

  return picked >= current ? picked + 1 : picked;
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
  // 快速切歌时，先发出的歌词请求可能后返回，把当前曲目的歌词覆盖成上一首的。
  // 用递增序号标记本次请求，返回时对不上就丢弃（与 MessagesView 里同一套做法）。
  const requestId = ++lyricRequestSequence;

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

  if (requestId !== lyricRequestSequence) {
    return;
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
      <p
        v-if="playbackError"
        class="music-error"
        role="alert"
      >
        {{ playbackError }}
      </p>
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
        {{
          mode === 'single'
            ? t('music.single')
            : mode === 'random'
              ? t('music.random')
              : t('music.list')
        }}
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
          @click="
            currentIndex = index;
            syncAudioAfterTrackChange();
          "
        >
          <span>{{ track.title }}</span>
          <small>{{ track.artist }}</small>
        </button>
      </div>
    </div>
  </aside>
</template>
