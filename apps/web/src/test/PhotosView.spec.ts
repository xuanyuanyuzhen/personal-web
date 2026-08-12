import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';
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
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.pathname + input.search
              : input.url;

        if (url === '/api/albums/public') {
          return Promise.resolve(jsonResponse([{ id: 1, name: '春日', slug: 'spring' }]));
        }

        if (url.startsWith('/api/photos/public/1/like')) {
          return Promise.resolve(jsonResponse({ likeCount: 3, liked: true }));
        }

        if (url.includes('albumId=1')) {
          return Promise.resolve(
            jsonResponse({
              items: [photo(2, '筛选照片')],
              pagination: { page: 1, pageSize: 18, total: 1 },
            }),
          );
        }

        return Promise.resolve(
          jsonResponse({
            items: [photo(1, '第一张')],
            pagination: { page: 1, pageSize: 18, total: 1 },
          }),
        );
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
    expect(
      (document as Document & { startViewTransition?: unknown }).startViewTransition,
    ).toHaveBeenCalledTimes(1);
    expect(wrapper.get('.photo-lightbox img').attributes('src')).toBe('/large-1.jpg');
    expect(wrapper.get('.photos-page').attributes('inert')).toBe('true');
    expect(wrapper.get('.photos-page').attributes('aria-hidden')).toBe('true');
    expect(document.body.style.overflow).toBe('hidden');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await flushPromises();
    expect(
      (document as Document & { startViewTransition?: unknown }).startViewTransition,
    ).toHaveBeenCalledTimes(2);
    expect(wrapper.find('.photo-lightbox').exists()).toBe(false);
    expect(document.body.style.overflow).toBe('');

    await wrapper.get('.photo-tile-caption button').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('已喜欢 · 3');

    await wrapper
      .findAll('.photo-filter button')
      .find((button) => button.text() === '春日')
      ?.trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('筛选照片');
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('albumId=1'), expect.any(Object));
  });

  it('keeps a stable photo wall skeleton visible during the initial request', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => undefined)),
    );

    const wrapper = mount(PhotosView);
    await wrapper.vm.$nextTick();

    expect(wrapper.get('.photo-loading-canvas').attributes('aria-label')).toBe('正在装裱照片…');
    expect(wrapper.findAll('.photo-loading-card')).toHaveLength(4);
    expect(wrapper.find('.empty-state').exists()).toBe(false);
  });

  it('moves and rotates a selected photo inside the interactive canvas', async () => {
    const wrapper = mount(PhotosView);
    await flushPromises();

    const tile = wrapper.get('.photo-tile-interactive');
    expect(wrapper.get('.photo-canvas').attributes('style')).toContain('height:');
    expect(tile.attributes('style')).toContain('rotate(');

    await tile.trigger('focus');
    const controls = tile.findAll('.photo-card-control');
    expect(controls).toHaveLength(3);

    const beforeMove = tile.attributes('style');
    await tile.trigger('keydown', { key: 'ArrowLeft' });
    expect(tile.attributes('style')).not.toBe(beforeMove);

    const beforeRotation = tile.attributes('style');
    await controls[1].trigger('click');
    expect(tile.attributes('style')).not.toBe(beforeRotation);
  });

  it('deselects a photo when clicking the canvas background or pressing Escape', async () => {
    const wrapper = mount(PhotosView);
    await flushPromises();

    const tile = wrapper.get('.photo-tile-interactive');
    await tile.trigger('focus');
    expect(tile.findAll('.photo-card-control')).toHaveLength(3);
    expect(tile.classes()).toContain('selected');

    // 点击画布空白处（不在任何照片瓦片上）：取消选中，收起角度徽标与手柄
    await wrapper.get('.photo-canvas').trigger('pointerdown');
    await nextTick();
    expect(tile.classes()).not.toContain('selected');
    expect(tile.findAll('.photo-card-control')).toHaveLength(0);
    expect(tile.find('.photo-rotate-handle').exists()).toBe(false);

    // 重新选中后按 Escape：同样取消选中
    await tile.trigger('focus');
    expect(tile.classes()).toContain('selected');
    await tile.trigger('keydown', { key: 'Escape' });
    await nextTick();
    expect(tile.classes()).not.toContain('selected');
    expect(tile.findAll('.photo-card-control')).toHaveLength(0);
  });

  it('shows a retry action instead of an empty state when photos fail to load', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: URL | RequestInfo) => {
        const url =
          typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

        if (url.includes('/api/albums/public')) {
          return Promise.resolve(jsonResponse([]));
        }

        return Promise.resolve({ ok: false, json: async () => ({}) } as Response);
      }),
    );

    const wrapper = mount(PhotosView);
    await flushPromises();

    expect(wrapper.find('.content-retry').exists()).toBe(true);
    expect(wrapper.find('.empty-state').exists()).toBe(false);
  });
});
