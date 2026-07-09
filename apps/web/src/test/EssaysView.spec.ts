import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { setLocale } from '../composables/useI18n';
import EssayDetailView from '../views/EssayDetailView.vue';
import EssaysView from '../views/EssaysView.vue';

function jsonResponse(body: unknown, ok = true) {
  return {
    ok,
    json: async () => body,
  } as Response;
}

function essay(id: number, title: string) {
  return {
    category: { id: 1, name: '札记', slug: 'notes' },
    categoryId: 1,
    content: `<p>${title} content</p>`,
    coverUrl: null,
    createdAt: '2026-06-03T00:00:00.000Z',
    id,
    isPinned: false,
    likeCount: 2,
    liked: false,
    publishedAt: '2026-06-03T00:00:00.000Z',
    slug: `note-${id}`,
    summary: `${title} summary`,
    tags: [{ color: null, id: 1, name: '日常', slug: 'daily' }],
    title,
    updatedAt: '2026-06-03T00:00:00.000Z',
  };
}

describe('EssaysView', () => {
  beforeEach(() => {
    window.localStorage.clear();
    setLocale('zh');
    vi.stubGlobal(
      'fetch',
      vi.fn((input: URL | RequestInfo) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.pathname + input.search : input.url;

        if (url === '/api/essays/categories/public') {
          return Promise.resolve(jsonResponse([{ description: null, id: 1, isEnabled: true, name: '札记', slug: 'notes' }]));
        }

        if (url.startsWith('/api/essays/public/1/like')) {
          return Promise.resolve(jsonResponse({ likeCount: 3, liked: true }));
        }

        if (url.includes('category=notes')) {
          return Promise.resolve(
            jsonResponse({
              items: [essay(3, '分类结果')],
              pagination: { page: 1, pageSize: 8, total: 1 },
            }),
          );
        }

        if (url.includes('page=2')) {
          return Promise.resolve(
            jsonResponse({
              items: [essay(1, '第一篇'), essay(2, '第二篇')],
              pagination: { page: 2, pageSize: 8, total: 2 },
            }),
          );
        }

        return Promise.resolve(
          jsonResponse({
            items: [essay(1, '第一篇')],
            pagination: { page: 1, pageSize: 8, total: 2 },
          }),
        );
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('filters by category, deduplicates loaded items, and toggles likes', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { component: { template: '<div />' }, path: '/' },
        { component: { template: '<div />' }, name: 'essay-detail', path: '/essays/:idOrSlug' },
      ],
    });
    const wrapper = mount(EssaysView, {
      global: {
        plugins: [router],
      },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('第一篇');

    await wrapper.get('.load-more').trigger('click');
    await flushPromises();
    expect(wrapper.findAll('.essay-card h2').map((heading) => heading.text()).filter((text) => text === '第一篇')).toHaveLength(1);
    expect(wrapper.text()).toContain('第二篇');

    await wrapper.get('.thought-meta button').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('已喜欢 · 3');

    await wrapper.findAll('.essay-filter button').find((button) => button.text() === '札记')?.trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('分类结果');
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('category=notes'), expect.any(Object));
  });
});

describe('EssayDetailView', () => {
  beforeEach(async () => {
    window.localStorage.clear();
    setLocale('zh');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders public essay detail without comment entry', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse(essay(1, '详情随笔')))),
    );
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ component: EssayDetailView, name: 'essay-detail', path: '/essays/:idOrSlug' }],
    });
    await router.push('/essays/note-1');
    await router.isReady();

    const wrapper = mount(EssayDetailView, {
      global: {
        plugins: [router],
      },
    });
    await flushPromises();

    expect(fetch).toHaveBeenCalledWith('/api/essays/public/note-1', expect.any(Object));
    expect(wrapper.get('h1').text()).toBe('详情随笔');
    expect(wrapper.html()).toContain('详情随笔 content');
    expect(wrapper.text()).not.toContain('评论');
  });
});
