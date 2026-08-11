import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import SearchDialog from '../components/SearchDialog.vue';
import { setLocale } from '../composables/useI18n';
import SearchResultsView from '../views/SearchResultsView.vue';

function jsonResponse(body: unknown) {
  return {
    ok: true,
    json: async () => body,
  } as Response;
}

function errorResponse() {
  return {
    ok: false,
    json: async () => ({}),
  } as Response;
}

function requestUrl(input: URL | RequestInfo): string {
  if (typeof input === 'string') {
    return input;
  }

  if (input instanceof URL) {
    return input.pathname + input.search;
  }

  return input.url;
}

function searchResponse(query = '春日') {
  return {
    query,
    sections: {
      essays: {
        items: [
          {
            createdAt: '2026-06-03T00:00:00.000Z',
            excerpt: `${query}摘要`,
            id: 1,
            title: `${query}随笔`,
            type: 'essays',
            url: '/essays/spring',
          },
        ],
        pagination: { page: 1, pageSize: 3, total: 1 },
      },
      messages: {
        items: [],
        pagination: { page: 1, pageSize: 3, total: 0 },
      },
      pages: {
        items: [],
        pagination: { page: 1, pageSize: 3, total: 0 },
      },
      photos: {
        items: [
          {
            createdAt: '2026-06-03T00:00:00.000Z',
            excerpt: `${query}照片描述`,
            id: 2,
            title: `${query}照片`,
            type: 'photos',
            url: '/photos',
          },
        ],
        pagination: { page: 1, pageSize: 3, total: 1 },
      },
      thoughts: {
        items: [],
        pagination: { page: 1, pageSize: 3, total: 0 },
      },
    },
  };
}

describe('Search UI', () => {
  beforeEach(() => {
    window.localStorage.clear();
    setLocale('zh');
    vi.stubGlobal(
      'fetch',
      vi.fn((input: URL | RequestInfo) => {
        const url = requestUrl(input);
        const parsed = new URL(url, 'http://localhost');
        const query = parsed.searchParams.get('q') ?? '春日';

        return Promise.resolve(jsonResponse(searchResponse(query)));
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses result-shaped placeholders while quick search is pending', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { component: { template: '<div />' }, path: '/' },
        { component: { template: '<div />' }, name: 'search', path: '/search' },
      ],
    });
    await router.push('/');
    await router.isReady();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => undefined)),
    );

    const wrapper = mount(SearchDialog, {
      global: { plugins: [router] },
      props: { open: true },
    });
    await wrapper.get('input[type="search"]').setValue('春日');
    await wrapper.get('form').trigger('submit');

    expect(wrapper.get('.content-skeleton-search').attributes('aria-label')).toBe('正在搜索…');
    expect(wrapper.findAll('.content-skeleton-item')).toHaveLength(2);
  });

  it('shows a stable results skeleton immediately for a routed query', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ component: SearchResultsView, name: 'search', path: '/search' }],
    });
    await router.push('/search?q=春日');
    await router.isReady();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => undefined)),
    );

    const wrapper = mount(SearchResultsView, {
      global: { plugins: [router] },
    });

    expect(wrapper.find('.content-skeleton-search').exists()).toBe(true);
    expect(wrapper.find('.search-empty').exists()).toBe(false);
  });

  it('shows quick sectioned results and links to the full result page', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { component: { template: '<div />' }, path: '/' },
        { component: { template: '<div />' }, name: 'search', path: '/search' },
        { component: { template: '<div />' }, name: 'essay-detail', path: '/essays/:idOrSlug' },
        { component: { template: '<div />' }, name: 'photos', path: '/photos' },
      ],
    });
    await router.push('/');
    await router.isReady();

    const wrapper = mount(SearchDialog, {
      global: {
        plugins: [router],
      },
      props: {
        open: true,
      },
    });

    await wrapper.get('input[type="search"]').setValue('春日');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/search/public?q=%E6%98%A5%E6%97%A5&page=1&pageSize=3'),
      expect.any(Object),
    );
    expect(wrapper.text()).toContain('春日随笔');
    expect(wrapper.text()).toContain('春日照片');

    await wrapper.get('.search-more-link').trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.name).toBe('search');
    expect(router.currentRoute.value.query.q).toBe('春日');
    expect(wrapper.emitted('close')).toBeTruthy();
  });

  it('renders full search results from the route query and can submit a new query', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { component: SearchResultsView, name: 'search', path: '/search' },
        { component: { template: '<div />' }, name: 'essay-detail', path: '/essays/:idOrSlug' },
        { component: { template: '<div />' }, name: 'photos', path: '/photos' },
      ],
    });
    await router.push('/search?q=春日');
    await router.isReady();

    const wrapper = mount(SearchResultsView, {
      global: {
        plugins: [router],
      },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('搜索');
    expect(wrapper.text()).toContain('春日随笔');
    expect(wrapper.text()).toContain('照片');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/search/public?q=%E6%98%A5%E6%97%A5&page=1&pageSize=10'),
      expect.any(Object),
    );

    await wrapper.get('input[type="search"]').setValue('夏日');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(router.currentRoute.value.query.q).toBe('夏日');
    expect(wrapper.text()).toContain('夏日随笔');
  });

  it('retries the same routed query after a failed request', async () => {
    let attempts = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        attempts += 1;
        return Promise.resolve(
          attempts === 1 ? errorResponse() : jsonResponse(searchResponse('春日')),
        );
      }),
    );
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { component: SearchResultsView, name: 'search', path: '/search' },
        { component: { template: '<div />' }, name: 'essay-detail', path: '/essays/:idOrSlug' },
        { component: { template: '<div />' }, name: 'photos', path: '/photos' },
      ],
    });
    await router.push('/search?q=春日');
    await router.isReady();

    const wrapper = mount(SearchResultsView, {
      global: { plugins: [router] },
    });
    await flushPromises();

    expect(wrapper.find('.content-retry').exists()).toBe(true);

    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(attempts).toBe(2);
    expect(wrapper.text()).toContain('春日随笔');
  });

  it('loads later search result pages without duplicating existing items', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: URL | RequestInfo) => {
        const parsed = new URL(requestUrl(input), 'http://localhost');
        const requestedPage = Number(parsed.searchParams.get('page') ?? 1);
        const response = searchResponse('分页');
        response.sections.essays.items = [
          {
            createdAt: '2026-06-03T00:00:00.000Z',
            excerpt: `第 ${requestedPage} 页`,
            id: requestedPage,
            title: `分页随笔 ${requestedPage}`,
            type: 'essays',
            url: `/essays/page-${requestedPage}`,
          },
        ];
        response.sections.essays.pagination = {
          page: requestedPage,
          pageSize: 10,
          total: 2,
        };
        return Promise.resolve(jsonResponse(response));
      }),
    );
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { component: SearchResultsView, name: 'search', path: '/search' },
        { component: { template: '<div />' }, name: 'essay-detail', path: '/essays/:idOrSlug' },
        { component: { template: '<div />' }, name: 'photos', path: '/photos' },
      ],
    });
    await router.push('/search?q=分页');
    await router.isReady();

    const wrapper = mount(SearchResultsView, {
      global: { plugins: [router] },
    });
    await flushPromises();

    expect(wrapper.findAll('.search-page-link')).toHaveLength(2);
    await wrapper.get('.load-more').trigger('click');
    await flushPromises();

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('page=2'), expect.any(Object));
    expect(wrapper.text()).toContain('分页随笔 1');
    expect(wrapper.text()).toContain('分页随笔 2');
  });
});
