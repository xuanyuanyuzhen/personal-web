import { flushPromises, mount } from '@vue/test-utils';
import { setLocale } from '../composables/useI18n';
import ThoughtsView from '../views/ThoughtsView.vue';

function jsonResponse(body: unknown) {
  return {
    ok: true,
    json: async () => body,
  } as Response;
}

function thought(id: number, content: string) {
  return {
    content,
    createdAt: '2026-06-03T00:00:00.000Z',
    id,
    imageUrl: null,
    isPinned: false,
    likeCount: 2,
    liked: false,
    publishedAt: '2026-06-03T00:00:00.000Z',
    summary: null,
    tags: [{ color: null, id: 1, name: '日常', slug: 'daily' }],
    updatedAt: '2026-06-03T00:00:00.000Z',
  };
}

describe('ThoughtsView', () => {
  beforeEach(() => {
    window.localStorage.clear();
    setLocale('zh');
    vi.stubGlobal(
      'fetch',
      vi.fn((input: URL | RequestInfo) => {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.pathname + input.search
              : input.url;

        if (url === '/api/thoughts/tags/public') {
          return Promise.resolve(
            jsonResponse([{ color: null, id: 1, name: '日常', slug: 'daily' }]),
          );
        }

        if (url.startsWith('/api/thoughts/public/1/like')) {
          return Promise.resolve(jsonResponse({ likeCount: 3, liked: true }));
        }

        if (url.includes('tag=daily')) {
          return Promise.resolve(
            jsonResponse({
              items: [thought(3, '<p>筛选结果</p>')],
              pagination: { page: 1, pageSize: 10, total: 1 },
            }),
          );
        }

        if (url.includes('page=2')) {
          return Promise.resolve(
            jsonResponse({
              items: [thought(1, '<p>第一条</p>'), thought(2, '<p>第二条</p>')],
              pagination: { page: 2, pageSize: 10, total: 2 },
            }),
          );
        }

        return Promise.resolve(
          jsonResponse({
            items: [thought(1, '<p>第一条</p>')],
            pagination: { page: 1, pageSize: 10, total: 2 },
          }),
        );
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows a stable first-screen skeleton before thoughts arrive', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => undefined)),
    );

    const wrapper = mount(ThoughtsView);

    expect(wrapper.get('.content-skeleton-thoughts').attributes('aria-label')).toBe(
      '正在整理碎碎念…',
    );
    expect(wrapper.find('.empty-state').exists()).toBe(false);
  });

  it('filters by tag, deduplicates loaded items, and toggles likes', async () => {
    const wrapper = mount(ThoughtsView);
    await flushPromises();

    expect(wrapper.text()).toContain('第一条');

    await wrapper.get('.load-more').trigger('click');
    await flushPromises();
    expect(wrapper.text().match(/第一条/g)).toHaveLength(1);
    expect(wrapper.text()).toContain('第二条');

    await wrapper.get('.thought-meta button').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('已喜欢 · 3');

    await wrapper
      .findAll('.thought-filter button')
      .find((button) => button.text() === '日常')
      ?.trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('筛选结果');
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('tag=daily'), expect.any(Object));
  });

  it('shows a retry action instead of an empty state when the list request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: URL | RequestInfo) => {
        const url =
          typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

        if (url.includes('/api/thoughts/tags/public')) {
          return Promise.resolve(jsonResponse([]));
        }

        return Promise.resolve({ ok: false, json: async () => ({}) } as Response);
      }),
    );

    const wrapper = mount(ThoughtsView);
    await flushPromises();

    expect(wrapper.find('.content-retry').exists()).toBe(true);
    expect(wrapper.find('.empty-state').exists()).toBe(false);
  });
});
