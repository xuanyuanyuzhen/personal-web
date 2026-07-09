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
    playMock = vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
    pauseMock = vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    loadMock = vi.spyOn(window.HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
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

    await wrapper.get('.music-icon-button').trigger('click');
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
});
