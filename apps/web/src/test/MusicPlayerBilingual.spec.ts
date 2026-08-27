import { flushPromises, mount } from '@vue/test-utils';
import MusicPlayer from '../components/MusicPlayer.vue';
import { setLocale } from '../composables/useI18n';

function jsonResponse(body: unknown) {
  return {
    json: async () => body,
    ok: true,
  } as Response;
}

/** 双语 LRC：同一时间戳两行，原文在前、翻译在后。这是网易云等平台的常见导出格式。 */
const BILINGUAL_LRC = [
  '[00:00.00]夜に駆ける',
  '[00:00.00]向着夜晚奔去',
  '[00:12.00]沈むように溶けてゆくように',
  '[00:12.00]仿佛沉溺 又仿佛消融',
  '[00:24.00]二人だけの空が広がる夜に',
  '[00:24.00]在只属于两人的夜空下',
].join('\n');

function bilingualTrack() {
  return [
    {
      artist: 'YOASOBI',
      createdAt: '2026-08-01T00:00:00.000Z',
      externalUrl: null,
      id: 1,
      isEnabled: true,
      localUrl: '/uploads/music/yoru.mp3',
      lyricFileUrl: null,
      lyricText: BILINGUAL_LRC,
      sortOrder: 0,
      title: '夜に駆ける',
      updatedAt: '2026-08-01T00:00:00.000Z',
    },
  ];
}

describe('MusicPlayer 双语歌词', () => {
  beforeEach(() => {
    window.localStorage.clear();
    setLocale('zh');
    window.localStorage.setItem(
      'yuer.musicPlayer',
      JSON.stringify({
        currentIndex: 0,
        expanded: true,
        isMuted: false,
        mode: 'list',
        volume: 0.6,
      }),
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse(bilingualTrack()))),
    );
    vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
    vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    vi.spyOn(window.HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders both languages and highlights them together', async () => {
    const wrapper = mount(MusicPlayer);
    await flushPromises();

    const audio = wrapper.get('audio').element as HTMLAudioElement;
    Object.defineProperty(audio, 'currentTime', { configurable: true, value: 13 });
    await wrapper.get('audio').trigger('timeupdate');

    // 一个 .music-lyric-line 是「同一时间戳的一组」，双语下含原文 + 译文。
    const activeGroups = wrapper.findAll('.music-lyric-line.active');
    expect(activeGroups).toHaveLength(1);

    const activeTexts = activeGroups[0].findAll('.music-lyric-text').map((node) => node.text());
    // 关键断言：13 秒时原文和译文同时高亮。改成平铺渲染会让原文永远不亮。
    expect(activeTexts).toEqual(['沈むように溶けてゆくように', '仿佛沉溺 又仿佛消融']);
  });

  it('marks the second line of a group as the translation', async () => {
    const wrapper = mount(MusicPlayer);
    await flushPromises();

    const firstGroup = wrapper.findAll('.music-lyric-line')[0];
    const texts = firstGroup.findAll('.music-lyric-text');

    // 原文不带 translation 类，译文带 —— CSS 靠它把译文做小一号、淡一点。
    expect(texts[0].classes()).not.toContain('translation');
    expect(texts[1].classes()).toContain('translation');
  });

  it('groups same-timestamp lines instead of flattening them', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const wrapper = mount(MusicPlayer);
    await flushPromises();

    // 6 行歌词、3 个时间戳 → 3 组、6 行文本。
    expect(wrapper.findAll('.music-lyric-line')).toHaveLength(3);
    expect(wrapper.findAll('.music-lyric-text')).toHaveLength(6);

    // 分组后组的 key 是时间戳，不再重复。
    const duplicateKeyWarning = warn.mock.calls
      .flat()
      .some((arg) => typeof arg === 'string' && arg.includes('Duplicate keys'));
    expect(duplicateKeyWarning).toBe(false);
  });

  it('keeps an instrumental timestamp as its own group', async () => {
    // LRC 常用纯时间戳标记间奏。丢掉这个时间点的话，间奏时高亮会停在上一句不动。
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          jsonResponse([
            {
              ...bilingualTrack()[0],
              lyricText: '[00:00.00]第一句\n[00:20.00]\n[00:30.00]第二句',
            },
          ]),
        ),
      ),
    );

    const wrapper = mount(MusicPlayer);
    await flushPromises();

    const groups = wrapper.findAll('.music-lyric-line');
    expect(groups).toHaveLength(3);
    expect(groups[1].text()).toBe('♪');

    const audio = wrapper.get('audio').element as HTMLAudioElement;
    Object.defineProperty(audio, 'currentTime', { configurable: true, value: 22 });
    await wrapper.get('audio').trigger('timeupdate');

    // 22 秒落在间奏里，高亮应当移到间奏那一组，而不是停在「第一句」。
    expect(wrapper.findAll('.music-lyric-line.active')[0].text()).toBe('♪');
  });
});
