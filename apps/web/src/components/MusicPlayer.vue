<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useI18n } from '../composables/useI18n';
import { publicApi } from '../services/api';

const STORAGE_KEY = 'yuer.musicPlayer';
const DEFAULT_VOLUME = 0.7;

const { t } = useI18n();
const audioRef = ref(null);
const lyricsRef = ref(null);
const tracks = ref([]);
const currentIndex = ref(0);
const isPlaying = ref(false);
const expanded = ref(false);
const mode = ref('list');
const currentTime = ref(0);
const duration = ref(0);
const volume = ref(DEFAULT_VOLUME);
const isMuted = ref(false);
const lyricLines = ref([]);
const lyricTextFallback = ref('');
const playbackError = ref('');
let lyricRequestSequence = 0;

// 拖动进度条期间，timeupdate 仍在推进 currentTime，会把滑块拽回播放位置。
// 所以拖动时改用 seekTime 显示，松手（change 事件）才提交给 audio。
const isSeeking = ref(false);
const seekTime = ref(0);

const currentTrack = computed(() => tracks.value[currentIndex.value] ?? null);
const currentSrc = computed(
  () => currentTrack.value?.localUrl || currentTrack.value?.externalUrl || '',
);
const hasTracks = computed(() => tracks.value.length > 0);
const hasTimedLyrics = computed(() => lyricLines.value.length > 0);

/** 进度条显示值：拖动中用手指的位置，否则跟着播放进度。 */
const sliderTime = computed(() => (isSeeking.value ? seekTime.value : currentTime.value));

/**
 * 可跳转的总时长。直播流的 duration 是 Infinity，未加载完是 NaN，
 * 两种都不能拿去当滑块上限，否则滑块会失效或算出 NaN 百分比。
 */
const seekableDuration = computed(() =>
  Number.isFinite(duration.value) && duration.value > 0 ? duration.value : 0,
);

/** 当前该高亮的歌词行下标；没有时间轴歌词时为 -1。 */
const activeLyricIndex = computed(() => {
  if (lyricLines.value.length === 0) {
    return -1;
  }

  let index = 0;
  for (let i = 0; i < lyricLines.value.length; i += 1) {
    if (lyricLines.value[i].time <= currentTime.value) {
      index = i;
    } else {
      break;
    }
  }

  return index;
});

const progressPercent = computed(() =>
  seekableDuration.value === 0 ? 0 : (sliderTime.value / seekableDuration.value) * 100,
);

onMounted(async () => {
  restoreState();
  await loadMusic();
  applyVolumeToAudio();
});

watch([currentIndex, mode, expanded, volume, isMuted], persistState);

watch(currentTrack, () => {
  void loadLyrics();
});

watch([volume, isMuted], applyVolumeToAudio);

// 歌词换行时把当前行滚到可视区中间。scroll-behavior: smooth 写在 CSS 里，
// reduced-motion 下会被全局规则降级成瞬间跳转 —— 这是无障碍上正确的行为，不覆盖。
watch(activeLyricIndex, (index) => {
  const container = lyricsRef.value;
  if (!container || index < 0) {
    return;
  }

  const group = container.children[index];
  if (!group) {
    return;
  }

  // 用 getBoundingClientRect 的相对差值，而不是 group.offsetTop。
  //
  // ⚠️ offsetTop 是相对「最近的定位祖先」，而 .music-lyrics 没有 position，
  // 于是基准变成了 .music-player-panel —— offsetTop 里混进了音量条等兄弟元素
  // 的高度，scrollTop 因此算得过大，把高亮那一组的顶部（双语时是原文那行）
  // 裁掉十几个像素。改成 rect 差值就与定位上下文无关了。
  const containerRect = container.getBoundingClientRect();
  const groupRect = group.getBoundingClientRect();
  const offsetWithinView = groupRect.top - containerRect.top;

  container.scrollTop += offsetWithinView - (container.clientHeight - groupRect.height) / 2;
});

function applyVolumeToAudio() {
  if (!audioRef.value) {
    return;
  }

  audioRef.value.volume = volume.value;
  audioRef.value.muted = isMuted.value;
}

/** 秒数转 m:ss。时长未知时给出 --:--，避免显示 NaN。 */
function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '--:--';
  }

  const whole = Math.floor(seconds);
  const minutes = Math.floor(whole / 60);

  return `${minutes}:${String(whole % 60).padStart(2, '0')}`;
}

function handleLoadedMetadata() {
  duration.value = audioRef.value?.duration ?? 0;
  applyVolumeToAudio();
}

function handleSeekInput(event) {
  isSeeking.value = true;
  seekTime.value = Number(event.target.value);
}

function handleSeekCommit(event) {
  const value = Number(event.target.value);

  if (audioRef.value && seekableDuration.value > 0) {
    audioRef.value.currentTime = value;
  }

  currentTime.value = value;
  isSeeking.value = false;
}

function handleVolumeInput(event) {
  volume.value = Number(event.target.value);

  // 拖动音量条即视为取消静音，否则用户拉了音量却没声音，看起来像坏了。
  if (volume.value > 0) {
    isMuted.value = false;
  }
}

function toggleMute() {
  isMuted.value = !isMuted.value;
}

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
    // 音量存的是 0~1 的小数，超范围或非数字都退回默认值，
    // 否则一个坏值会让 audio.volume 抛 IndexSizeError、整个播放器不可用。
    if (Number.isFinite(state.volume) && state.volume >= 0 && state.volume <= 1) {
      volume.value = state.volume;
    }
    isMuted.value = Boolean(state.isMuted);
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
      isMuted: isMuted.value,
      mode: mode.value,
      volume: volume.value,
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
  // 不重置的话，新歌加载出 loadedmetadata 之前，进度条会短暂停在上一首的
  // 时长和位置上。
  currentTime.value = 0;
  duration.value = 0;
  isSeeking.value = false;
  await nextTick();
  audioRef.value?.load();
  applyVolumeToAudio();

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

/**
 * 把 LRC 文本解析成按时间分组的歌词。
 *
 * 双语歌词（网易云等平台的常见导出格式）会给同一时刻写多行：
 *
 *   [00:12.00]沈むように溶けてゆくように
 *   [00:12.00]仿佛沉溺 又仿佛消融
 *
 * 所以这里返回的是「时间点 → 该时刻的若干行」，而不是平铺的行数组：
 * 平铺的话高亮只能落在其中一行（找最后一个 time <= currentTime 的下标，
 * 必然是译文），原文永远不亮。分组后整组一起高亮、一起居中。
 *
 * 同一时刻多行也让 `:key` 不能再用 time —— 分组后 key 用时间、组内用下标。
 */
function parseLyrics(text) {
  const byTime = new Map();

  for (const rawLine of text.split(/\r?\n/)) {
    const match = rawLine.match(/^\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?]\s*(.*)$/);
    if (!match) {
      continue;
    }

    const minutes = Number(match[1]);
    const seconds = Number(match[2]);
    const fraction = Number((match[3] ?? '0').padEnd(3, '0'));
    const time = minutes * 60 + seconds + fraction / 1000;
    const lineText = match[4]?.trim() ?? '';

    // 纯时间戳、没有文字的行（LRC 常用来标记间奏）不占一行位置，
    // 但要保留这个时间点本身，否则间奏时高亮会停在上一句不动。
    const existing = byTime.get(time);
    if (existing) {
      if (lineText) {
        existing.push(lineText);
      }
    } else {
      byTime.set(time, lineText ? [lineText] : []);
    }
  }

  return [...byTime.entries()]
    .map(([time, texts]) => ({ texts, time }))
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
      @loadedmetadata="handleLoadedMetadata"
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

      <div class="music-controls">
        <button
          class="music-play-button"
          type="button"
          :aria-label="isPlaying ? t('music.pause') : t('music.play')"
          @click="togglePlay"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
          >
            <g v-if="isPlaying">
              <rect
                x="7"
                y="5"
                width="3.4"
                height="14"
                rx="1.2"
              />
              <rect
                x="13.6"
                y="5"
                width="3.4"
                height="14"
                rx="1.2"
              />
            </g>
            <path
              v-else
              d="M8.5 5.6a1 1 0 0 1 1.53-.85l8 5.4a1 1 0 0 1 0 1.7l-8 5.4a1 1 0 0 1-1.53-.85Z"
            />
          </svg>
        </button>

        <button
          class="music-track"
          type="button"
          :aria-expanded="expanded"
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
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
          >
            <path
              d="M15.5 6.4a1 1 0 0 0-1.53-.85l-6.2 4.6a1 1 0 0 0 0 1.7l6.2 4.6a1 1 0 0 0 1.53-.85Z"
            />
            <rect
              x="6"
              y="5.5"
              width="2"
              height="13"
              rx="1"
            />
          </svg>
        </button>

        <button
          class="music-icon-button"
          type="button"
          :aria-label="t('music.next')"
          @click="nextTrack"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
          >
            <path
              d="M8.5 6.4a1 1 0 0 1 1.53-.85l6.2 4.6a1 1 0 0 1 0 1.7l-6.2 4.6a1 1 0 0 1-1.53-.85Z"
            />
            <rect
              x="16"
              y="5.5"
              width="2"
              height="13"
              rx="1"
            />
          </svg>
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

      <div class="music-progress-row">
        <span class="music-time">{{ formatTime(sliderTime) }}</span>
        <input
          class="music-range music-progress"
          type="range"
          min="0"
          :max="seekableDuration || 1"
          step="0.1"
          :value="sliderTime"
          :disabled="seekableDuration === 0"
          :style="{ '--fill': progressPercent + '%' }"
          :aria-label="t('music.progress')"
          :aria-valuetext="formatTime(sliderTime)"
          @input="handleSeekInput"
          @change="handleSeekCommit"
        >
        <span class="music-time">{{ formatTime(duration) }}</span>
      </div>
    </div>

    <div
      v-if="expanded"
      class="music-player-panel"
    >
      <div class="music-volume-row">
        <button
          class="music-icon-button"
          type="button"
          :aria-label="isMuted ? t('music.unmute') : t('music.mute')"
          @click="toggleMute"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
          >
            <path d="M4 9.5h3L11.5 6v12L7 14.5H4Z" />
            <path
              v-if="isMuted"
              d="M15 9.5l4.5 5m0-5-4.5 5"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
            />
            <path
              v-else
              d="M14.8 8.6a4.4 4.4 0 0 1 0 6.8M17 6.4a7.6 7.6 0 0 1 0 11.2"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
            />
          </svg>
        </button>
        <input
          class="music-range music-volume"
          type="range"
          min="0"
          max="1"
          step="0.01"
          :value="volume"
          :style="{ '--fill': (isMuted ? 0 : volume * 100) + '%' }"
          :aria-label="t('music.volume')"
          :aria-valuetext="Math.round(volume * 100) + '%'"
          @input="handleVolumeInput"
        >
      </div>

      <div
        v-if="hasTimedLyrics"
        ref="lyricsRef"
        class="music-lyrics"
      >
        <div
          v-for="(group, index) in lyricLines"
          :key="group.time"
          class="music-lyric-line"
          :class="{ active: index === activeLyricIndex }"
        >
          <p
            v-for="(text, textIndex) in group.texts"
            :key="textIndex"
            class="music-lyric-text"
            :class="{ translation: textIndex > 0 }"
          >
            {{ text }}
          </p>
          <p
            v-if="group.texts.length === 0"
            class="music-lyric-text"
          >
            ♪
          </p>
        </div>
      </div>
      <p
        v-else
        class="music-lyric"
      >
        {{ lyricTextFallback }}
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
