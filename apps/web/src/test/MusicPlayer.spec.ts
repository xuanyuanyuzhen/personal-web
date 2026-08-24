import { flushPromises, mount } from '@vue/test-utils';
import MusicPlayer from '../components/MusicPlayer.vue';
import { setLocale } from '../composables/useI18n';

function jsonResponse(body: unknown) {
  return {
    json: async () => body,
    ok: true,
  } as Response;
}

function musicTracks() {
  return [
    {
      artist: '语尔',
      createdAt: '2026-06-01T00:00:00.000Z',
      externalUrl: null,
      id: 1,
      isEnabled: true,
      localUrl: '/uploads/music/spring.mp3',
      lyricFileUrl: null,
      lyricText: '[00:00.00]第一句\n[00:10.00]第二句',
      sortOrder: 0,
      title: '春日散步',
      updatedAt: '2026-06-01T00:00:00.000Z',
    },
    {
      artist: '远山',
      createdAt: '2026-06-01T00:00:00.000Z',
      externalUrl: 'https://cdn.example.com/night.mp3',
      id: 2,
      isEnabled: true,
      localUrl: null,
      lyricFileUrl: null,
      lyricText: null,
      sortOrder: 1,
      title: '夜色回声',
      updatedAt: '2026-06-01T00:00:00.000Z',
    },
  ];
}

describe('MusicPlayer', () => {
  let playMock: ReturnType<typeof vi.spyOn>;
  let pauseMock: ReturnType<typeof vi.spyOn>;
  let loadMock: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    window.localStorage.clear();
    setLocale('zh');
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse(musicTracks()))),
    );
    playMock = vi
      .spyOn(window.HTMLMediaElement.prototype, 'play')
      .mockImplementation(() => Promise.resolve());
    pauseMock = vi
      .spyOn(window.HTMLMediaElement.prototype, 'pause')
      .mockImplementation(() => undefined);
    loadMock = vi
      .spyOn(window.HTMLMediaElement.prototype, 'load')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('loads tracks without autoplay and plays only after user action', async () => {
    const wrapper = mount(MusicPlayer);
    await flushPromises();

    expect(fetch).toHaveBeenCalledWith('/api/music/public', expect.any(Object));
    expect(wrapper.text()).toContain('春日散步');
    expect(playMock).not.toHaveBeenCalled();
    expect(loadMock).toHaveBeenCalled();

    await wrapper.get('.music-play-button').trigger('click');
    await flushPromises();

    expect(playMock).toHaveBeenCalledTimes(1);
    expect(pauseMock).not.toHaveBeenCalled();
  });

  it('restores selection, mode, expanded panel, and shows lyrics', async () => {
    window.localStorage.setItem(
      'yuer.musicPlayer',
      JSON.stringify({
        currentIndex: 1,
        expanded: true,
        mode: 'random',
      }),
    );

    const wrapper = mount(MusicPlayer);
    await flushPromises();

    expect(wrapper.text()).toContain('夜色回声');
    expect(wrapper.text()).toContain('随机');
    expect(wrapper.text()).toContain('夜色回声 - 远山');

    await wrapper.get('.music-mode-button').trigger('click');
    await flushPromises();

    expect(window.localStorage.getItem('yuer.musicPlayer')).toContain('"mode":"list"');
  });

  it('switches tracks from the playlist and persists the current index', async () => {
    window.localStorage.setItem(
      'yuer.musicPlayer',
      JSON.stringify({
        currentIndex: 0,
        expanded: true,
        mode: 'list',
      }),
    );

    const wrapper = mount(MusicPlayer);
    await flushPromises();

    expect(wrapper.text()).toContain('第一句');

    const playlistItems = wrapper.findAll('.music-playlist button');
    await playlistItems[1].trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('夜色回声');
    expect(window.localStorage.getItem('yuer.musicPlayer')).toContain('"currentIndex":1');
  });

  it('recovers when the stored index points past a shortened playlist', async () => {
    // 后台删歌后，localStorage 里的旧索引会越界。不修正的话 currentTrack 是
    // undefined，标题渲染成空白 —— 播放器看起来坏了但不报错。
    window.localStorage.setItem(
      'yuer.musicPlayer',
      JSON.stringify({ currentIndex: 7, expanded: false, mode: 'list' }),
    );

    const wrapper = mount(MusicPlayer);
    await flushPromises();

    expect(wrapper.text()).toContain('春日散步');
  });

  it('surfaces a message when playback is blocked instead of failing silently', async () => {
    // 浏览器自动播放策略拦截时，原来静默吞掉异常，用户只看到「点了没反应」。
    playMock.mockImplementation(() => Promise.reject(new Error('NotAllowedError')));

    const wrapper = mount(MusicPlayer);
    await flushPromises();

    await wrapper.get('.music-play-button').trigger('click');
    await flushPromises();

    expect(wrapper.get('.music-error').text()).toContain('播放失败');
  });

  it('keeps the lyrics of the track that was selected last', async () => {
    // 竞态：快速切歌时先发的歌词请求可能后返回，把当前曲目的歌词覆盖成上一首的。
    // 第二首用 lyricFileUrl（需要 fetch），第一首用内联 lyricText。
    const slowLyrics = musicTracks();
    slowLyrics[1].lyricFileUrl = '/uploads/music/night.lrc';

    let releaseLyricFetch = () => undefined;
    const pendingLyric = new Promise<string>((resolve) => {
      releaseLyricFetch = () => resolve('[00:00.00]夜色第一句');
    });

    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.endsWith('.lrc')) {
          return Promise.resolve({ ok: true, text: () => pendingLyric } as unknown as Response);
        }

        return Promise.resolve(jsonResponse(slowLyrics));
      }),
    );

    const wrapper = mount(MusicPlayer);
    await flushPromises();
    // .music-track 是展开面板的按钮，展开后才能拿到播放列表。
    await wrapper.get('.music-track').trigger('click');
    await flushPromises();

    // 切到第二首（歌词请求悬而未决），再立刻切回第一首。
    const playlistItems = wrapper.findAll('.music-playlist button');
    await playlistItems[1].trigger('click');
    await flushPromises();
    await playlistItems[0].trigger('click');
    await flushPromises();

    // 此刻第二首的歌词才返回 —— 必须被丢弃。
    releaseLyricFetch();
    await flushPromises();

    expect(wrapper.text()).toContain('第一句');
    expect(wrapper.text()).not.toContain('夜色第一句');
  });

  it('never repeats the current track in random mode', async () => {
    // 原实现是 while (next === current) next = random()，无界循环。
    // 遍历随机值的边界采样，确认每个都落在「非当前曲目」上。
    window.localStorage.setItem(
      'yuer.musicPlayer',
      JSON.stringify({ currentIndex: 0, expanded: false, mode: 'random' }),
    );

    const wrapper = mount(MusicPlayer);
    await flushPromises();

    // 收起状态下 .music-icon-button 依次是 上一首 / 下一首（播放键是
    // .music-play-button，静音键在展开面板里）。用 aria-label 定位更抗重构。
    const nextButton = () => wrapper.get('[aria-label="下一首"]');

    for (const sample of [0, 0.49, 0.99]) {
      vi.spyOn(Math, 'random').mockReturnValue(sample);
      await nextButton().trigger('click');
      await flushPromises();

      // 只有两首歌，所以「不是当前这首」等价于「是另一首」。
      expect(wrapper.text()).toContain('夜色回声');

      // 切回第一首，为下一轮采样复位。
      await nextButton().trigger('click');
      await flushPromises();
      expect(wrapper.text()).toContain('春日散步');
    }
  });

  it('commits a seek only on release, so dragging is not fought by timeupdate', async () => {
    const wrapper = mount(MusicPlayer);
    await flushPromises();

    const audio = wrapper.get('audio').element as HTMLAudioElement;
    Object.defineProperty(audio, 'duration', { configurable: true, value: 120 });
    await wrapper.get('audio').trigger('loadedmetadata');

    const slider = wrapper.get('.music-progress');
    const input = slider.element as HTMLInputElement;

    // 拖动中只更新显示，不动 audio.currentTime。
    // 注意不能用 setValue —— 它会连带触发 change，正是这里要区分的那个事件。
    input.value = '40';
    await slider.trigger('input');

    expect(audio.currentTime).toBe(0);
    expect(wrapper.get('.music-progress-row').text()).toContain('0:40');

    // 松手（change）才提交。
    await slider.trigger('change');
    expect(audio.currentTime).toBe(40);
  });

  it('shows --:-- instead of NaN when the duration is not known yet', async () => {
    const wrapper = mount(MusicPlayer);
    await flushPromises();

    // 直播流的 duration 是 Infinity，未加载完是 NaN —— 都不能显示成 NaN:NaN。
    const audio = wrapper.get('audio').element as HTMLAudioElement;
    Object.defineProperty(audio, 'duration', { configurable: true, value: Number.NaN });
    await wrapper.get('audio').trigger('loadedmetadata');

    expect(wrapper.get('.music-progress-row').text()).toContain('--:--');
    expect(wrapper.get('.music-progress').attributes('disabled')).toBeDefined();
  });

  it('persists volume and mute, and applies them to the audio element', async () => {
    const wrapper = mount(MusicPlayer);
    await flushPromises();
    await wrapper.get('.music-track').trigger('click');
    await flushPromises();

    const audio = wrapper.get('audio').element as HTMLAudioElement;

    await wrapper.get('.music-volume').setValue('0.35');
    await flushPromises();
    expect(audio.volume).toBeCloseTo(0.35);
    expect(window.localStorage.getItem('yuer.musicPlayer')).toContain('"volume":0.35');

    await wrapper.get('[aria-label="静音"]').trigger('click');
    await flushPromises();
    expect(audio.muted).toBe(true);
    expect(window.localStorage.getItem('yuer.musicPlayer')).toContain('"isMuted":true');
  });

  it('ignores a corrupted stored volume instead of breaking the player', async () => {
    // audio.volume 超出 0~1 会抛 IndexSizeError，一个坏值能让整个播放器不可用。
    window.localStorage.setItem(
      'yuer.musicPlayer',
      JSON.stringify({ currentIndex: 0, expanded: true, mode: 'list', volume: 42 }),
    );

    const wrapper = mount(MusicPlayer);
    await flushPromises();

    const audio = wrapper.get('audio').element as HTMLAudioElement;
    expect(audio.volume).toBeCloseTo(0.7);
  });

  it('highlights the lyric line matching the current playback time', async () => {
    window.localStorage.setItem(
      'yuer.musicPlayer',
      JSON.stringify({ currentIndex: 0, expanded: true, mode: 'list' }),
    );

    const wrapper = mount(MusicPlayer);
    await flushPromises();

    // 两行歌词：[00:00] 第一句 / [00:10] 第二句。
    const lines = () => wrapper.findAll('.music-lyric-line');
    expect(lines()).toHaveLength(2);
    expect(lines()[0].classes()).toContain('active');

    const audio = wrapper.get('audio').element as HTMLAudioElement;
    Object.defineProperty(audio, 'currentTime', { configurable: true, value: 12 });
    await wrapper.get('audio').trigger('timeupdate');

    expect(lines()[0].classes()).not.toContain('active');
    expect(lines()[1].classes()).toContain('active');
  });
});
