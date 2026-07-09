import { flushPromises, mount } from '@vue/test-utils';
import { setLocale } from '../composables/useI18n';
import PhotosView from '../views/PhotosView.vue';

function jsonResponse(body: unknown) {
  return { ok: true, json: async () => body } as Response;
}

function photo(id: number, title: string) {
  return {
    album: { id: 1, name: '春日', slug: 'spring' },
    albumId: 1,
    createdAt: '2026-06-03T00:00:00.000Z',
    description: '描述',
    id,
    largeUrl: `/large-${id}.jpg`,
    likeCount: 2,
    liked: false,
    originalUrl: `/original-${id}.jpg`,
    sortOrder: 0,
    thumbUrl: `/thumb-${id}.jpg`,
    title,
    updatedAt: '2026-06-03T00:00:00.000Z',
  };
}

describe('PhotosView', () => {
  beforeEach(() => {
    window.localStorage.clear();
    setLocale('zh');
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: vi.fn((callback: () => Promise<void>) => {
        void callback();

        return { finished: Promise.resolve() };
      }),
    });
    vi.stubGlobal(
      'fetch',
      vi.fn((input: URL | RequestInfo) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.pathname + input.search : input.url;

        if (url === '/api/albums/public') {
          return Promise.resolve(jsonResponse([{ id: 1, name: '春日', slug: 'spring' }]));
        }

        if (url.startsWith('/api/photos/public/1/like')) {
          return Promise.resolve(jsonResponse({ likeCount: 3, liked: true }));
        }

        if (url.includes('albumId=1')) {
          return Promise.resolve(jsonResponse({ items: [photo(2, '筛选照片')], pagination: { page: 1, pageSize: 18, total: 1 } }));
        }

        return Promise.resolve(jsonResponse({ items: [photo(1, '第一张')], pagination: { page: 1, pageSize: 18, total: 1 } }));
      }),
    );
  });

  afterEach(() => {
    Reflect.deleteProperty(document, 'startViewTransition');
    vi.unstubAllGlobals();
  });

  it('filters albums, prefers thumbnails, previews large image, and toggles likes', async () => {
    const wrapper = mount(PhotosView);
    await flushPromises();

    expect(wrapper.text()).toContain('第一张');
    expect(wrapper.get('.photo-preview-button img').attributes('src')).toBe('/thumb-1.jpg');

    await wrapper.get('.photo-preview-button').trigger('click');
    await flushPromises();
    expect((document as Document & { startViewTransition?: unknown }).startViewTransition).toHaveBeenCalledTimes(1);
    expect(wrapper.get('.photo-lightbox img').attributes('src')).toBe('/large-1.jpg');
    await wrapper.get('.photo-lightbox button').trigger('click');
    await flushPromises();
    expect((document as Document & { startViewTransition?: unknown }).startViewTransition).toHaveBeenCalledTimes(2);
    expect(wrapper.find('.photo-lightbox').exists()).toBe(false);

    await wrapper.get('.photo-tile-caption button').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('已喜欢 · 3');

    await wrapper.findAll('.photo-filter button').find((button) => button.text() === '春日')?.trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('筛选照片');
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('albumId=1'), expect.any(Object));
  });
});
