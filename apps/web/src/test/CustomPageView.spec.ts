import { flushPromises, mount } from '@vue/test-utils';
import { setLocale } from '../composables/useI18n';
import { router } from '../router';
import CustomPageView from '../views/CustomPageView.vue';

describe('CustomPageView', () => {
  beforeEach(async () => {
    window.localStorage.clear();
    setLocale('en');
    vi.stubGlobal('fetch', vi.fn());
    await router.push('/pages/about-site');
    await router.isReady();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows a full article skeleton before custom-page content arrives', () => {
    vi.mocked(fetch).mockImplementation(() => new Promise<Response>(() => undefined));

    const wrapper = mount(CustomPageView, {
      global: { plugins: [router] },
    });

    expect(wrapper.find('.content-skeleton-article').exists()).toBe(true);
    expect(wrapper.text()).not.toContain('Page not found');
  });

  it('renders a public custom page from the API', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 12,
        title: 'About This Site',
        slug: 'about-site',
        summary: 'A short public page.',
        content: '<p>Welcome to the public custom page.</p>',
        seoTitle: null,
        seoDescription: null,
        seoKeywords: null,
        publishedAt: '2026-06-03T00:00:00.000Z',
        createdAt: '2026-06-03T00:00:00.000Z',
        updatedAt: '2026-06-03T00:00:00.000Z',
      }),
    } as Response);

    const wrapper = mount(CustomPageView, {
      global: {
        plugins: [router],
      },
    });

    await flushPromises();

    expect(fetch).toHaveBeenCalledWith('/api/pages/public/about-site', expect.any(Object));
    expect(wrapper.get('h1').text()).toBe('About This Site');
    expect(wrapper.text()).toContain('A short public page.');
    expect(wrapper.html()).toContain('Welcome to the public custom page.');
  });
});
