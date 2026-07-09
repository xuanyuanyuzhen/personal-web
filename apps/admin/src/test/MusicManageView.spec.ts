import ElementPlus from 'element-plus';
import { flushPromises, mount } from '@vue/test-utils';
import MusicManageView from '../views/MusicManageView.vue';

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json',
    },
    status: 200,
    ...init,
  });
}

function musicPayload() {
  return {
    items: [
      {
        artist: '语尔',
        externalUrl: null,
        id: 1,
        isEnabled: true,
        localUrl: '/uploads/music/spring.mp3',
        lyricFileUrl: null,
        lyricText: '[00:00.00]春日散步',
        sortOrder: 0,
        title: '春日散步',
      },
    ],
    pagination: { page: 1, pageSize: 10, total: 1 },
  };
}

describe('MusicManageView', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('loads list, blocks empty source, and submits create form', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/admin/music' && init?.method === 'POST') {
        return Promise.resolve(jsonResponse({ id: 2 }));
      }

      return Promise.resolve(jsonResponse(musicPayload()));
    });
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mount(MusicManageView, {
      global: {
        plugins: [ElementPlus],
      },
    });
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith('/api/admin/music?page=1&pageSize=10', expect.any(Object));
    expect(wrapper.text()).toContain('春日散步');

    const vm = wrapper.vm as unknown as {
      form: {
        artist: string;
        externalUrl: string | null;
        localUrl: string | null;
        title: string;
      };
      handleSubmit: () => Promise<void>;
      openCreateDialog: () => void;
    };

    vm.openCreateDialog();
    await flushPromises();
    vm.form.title = '无声片段';
    vm.form.artist = '语尔';
    vm.form.localUrl = '';
    vm.form.externalUrl = '';
    await vm.handleSubmit();
    await flushPromises();

    expect(wrapper.text()).toContain('至少填写一种');
    expect(fetchMock.mock.calls.some(([url, init]) => url === '/api/admin/music' && init?.method === 'POST')).toBe(false);

    vm.form.externalUrl = 'https://cdn.example.com/spring.mp3';
    await vm.handleSubmit();
    await flushPromises();

    const createCall = fetchMock.mock.calls.find(([url, init]) => url === '/api/admin/music' && init?.method === 'POST');
    expect(createCall).toBeTruthy();
    expect(JSON.parse(createCall?.[1]?.body as string)).toMatchObject({
      artist: '语尔',
      externalUrl: 'https://cdn.example.com/spring.mp3',
      localUrl: null,
      title: '无声片段',
    });
  });

  it('uploads music and lyric files into the form', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/admin/uploads/music' && init?.method === 'POST') {
        return Promise.resolve(
          jsonResponse({
            filename: 'spring.mp3',
            kind: 'music',
            mimeType: 'audio/mpeg',
            originalName: 'spring.mp3',
            relativePath: 'music/spring.mp3',
            size: 20,
            storagePath: 'uploads/music/spring.mp3',
            url: '/uploads/music/spring.mp3',
          }),
        );
      }

      if (url === '/api/admin/uploads/lyric' && init?.method === 'POST') {
        return Promise.resolve(
          jsonResponse({
            filename: 'spring.lrc',
            kind: 'lyric',
            mimeType: 'text/plain',
            originalName: 'spring.lrc',
            relativePath: 'lyric/spring.lrc',
            size: 20,
            storagePath: 'uploads/lyric/spring.lrc',
            url: '/uploads/lyric/spring.lrc',
          }),
        );
      }

      return Promise.resolve(jsonResponse(musicPayload()));
    });
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mount(MusicManageView, {
      global: {
        plugins: [ElementPlus],
      },
    });
    await flushPromises();

    const vm = wrapper.vm as unknown as {
      form: {
        localUrl: string | null;
        lyricFileUrl: string | null;
        title: string;
      };
      handleLyricSelected: (event: Event) => Promise<void>;
      handleMusicSelected: (event: Event) => Promise<void>;
      openCreateDialog: () => void;
    };

    vm.openCreateDialog();
    await flushPromises();

    await vm.handleMusicSelected(fileChangeEvent(new File(['music'], 'spring.mp3', { type: 'audio/mpeg' })));
    await flushPromises();
    await vm.handleLyricSelected(fileChangeEvent(new File(['lyric'], 'spring.lrc', { type: 'text/plain' })));
    await flushPromises();

    expect(vm.form.localUrl).toBe('/uploads/music/spring.mp3');
    expect(vm.form.lyricFileUrl).toBe('/uploads/lyric/spring.lrc');
    expect(vm.form.title).toBe('spring');
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/uploads/music', expect.objectContaining({ method: 'POST' }));
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/uploads/lyric', expect.objectContaining({ method: 'POST' }));
  });
});

function fileChangeEvent(file: File) {
  const input = document.createElement('input');
  Object.defineProperty(input, 'files', {
    value: [file],
  });

  return { target: input } as unknown as Event;
}
