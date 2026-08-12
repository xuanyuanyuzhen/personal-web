import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import App from '../App.vue';
import { setLocale } from '../composables/useI18n';
import { setTheme } from '../composables/useTheme';
import { router } from '../router';

function jsonResponse(body: unknown) {
  return {
    ok: true,
    json: async () => body,
  } as Response;
}

function requestUrl(input: URL | RequestInfo): string {
  if (typeof input === 'string') {
    return input;
  }

  if (input instanceof URL) {
    return input.pathname;
  }

  return input.url;
}

describe('App shell', () => {
  beforeEach(async () => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    // 开屏动画在组件测试里直接跳过（模拟 reduced-motion），
    // 保证断言不受动画定时器 / rAF 干扰。
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    );
    setLocale('en');
    setTheme('light');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('navigation unavailable')));
    await router.push('/');
    await router.isReady();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('persists theme changes', async () => {
    const wrapper = mount(App, {
      global: {
        plugins: [router],
      },
    });

    await wrapper.get('.theme-toggle').trigger('click');

    expect(window.localStorage.getItem('yuer.theme')).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('uses the lightweight route transition', () => {
    const wrapper = mount(App, {
      global: {
        plugins: [router],
      },
    });

    const transition = wrapper.get('transition-stub[name="page-shift"]');

    expect(transition.attributes('mode')).toBe('out-in');
  });

  it('persists language changes and updates fixed UI text', async () => {
    const wrapper = mount(App, {
      global: {
        plugins: [router],
      },
    });

    await wrapper.get('select').setValue('en');

    expect(window.localStorage.getItem('yuer.locale')).toBe('en');
    expect(wrapper.text()).toContain('Home');
    expect(wrapper.text()).toContain('Guestbook');
  });

  it('renders public navigation from the API when available', async () => {
    vi.mocked(fetch).mockImplementation((input: URL | RequestInfo) => {
      const url = requestUrl(input);

      if (url === '/api/navigations/public') {
        return Promise.resolve(
          jsonResponse([
            {
              children: [],
              id: 1,
              key: 'journal',
              page: null,
              path: '/essays',
              target: null,
              title: 'Journal',
              type: 'INTERNAL',
              url: null,
            },
          ]),
        );
      }

      if (url === '/api/site/announcement') {
        return Promise.resolve(jsonResponse(null));
      }

      if (url === '/api/likes/status?targetType=site') {
        return Promise.resolve(jsonResponse({ likeCount: 0, liked: false }));
      }

      return Promise.resolve(
        jsonResponse({
          aboutContent: '<p>About</p>',
          avatarUrl: '',
          faviconUrl: '',
          githubUrl: '',
          homeIntroduction: 'Home intro',
          publicName: 'Public name',
          siteName: 'Site name',
          theme: { primary: 'pink' },
        }),
      );
    });

    const wrapper = mount(App, {
      global: {
        plugins: [router],
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain('Journal');
    expect(wrapper.text()).not.toContain('Guestbook');
  });

  it('uses local navigation when the public navigation API fails', async () => {
    const wrapper = mount(App, {
      global: {
        plugins: [router],
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain('Home');
    expect(wrapper.text()).toContain('Guestbook');
  });

  it('maps PAGE navigation items to public page routes', async () => {
    vi.mocked(fetch).mockImplementation((input: URL | RequestInfo) => {
      const url = requestUrl(input);

      if (url === '/api/navigations/public') {
        return Promise.resolve(
          jsonResponse([
            {
              children: [],
              id: 9,
              key: 'garden',
              page: {
                id: 4,
                slug: 'garden',
                title: 'Garden',
              },
              path: null,
              target: null,
              title: 'Garden Page',
              type: 'PAGE',
              url: null,
            },
          ]),
        );
      }

      if (url === '/api/site/announcement') {
        return Promise.resolve(jsonResponse(null));
      }

      if (url === '/api/likes/status?targetType=site') {
        return Promise.resolve(jsonResponse({ likeCount: 0, liked: false }));
      }

      return Promise.resolve(
        jsonResponse({
          aboutContent: '<p>About</p>',
          avatarUrl: '',
          faviconUrl: '',
          githubUrl: '',
          homeIntroduction: 'Home intro',
          publicName: 'Public name',
          siteName: 'Site name',
          theme: { primary: 'pink' },
        }),
      );
    });

    const wrapper = mount(App, {
      global: {
        plugins: [router],
      },
    });

    await flushPromises();

    expect(wrapper.find('a[href="/pages/garden"]').exists()).toBe(true);
  });

  it('reopens the home announcement from the header action', async () => {
    vi.mocked(fetch).mockImplementation((input: URL | RequestInfo) => {
      const url = requestUrl(input);

      if (url === '/api/site/announcement') {
        return Promise.resolve(
          jsonResponse({
            content: '<p>Announcement body</p>',
            isEnabled: true,
            publishedAt: '2026-06-03T00:00:00.000Z',
            title: 'Announcement',
          }),
        );
      }

      if (url === '/api/site/settings') {
        return Promise.resolve(
          jsonResponse({
            aboutContent: '<p>About</p>',
            avatarUrl: '',
            faviconUrl: '',
            githubUrl: '',
            homeIntroduction: 'Home intro',
            publicName: 'Public name',
            siteName: 'Site name',
            theme: { primary: 'pink' },
          }),
        );
      }

      if (url === '/api/likes/status?targetType=site') {
        return Promise.resolve(jsonResponse({ likeCount: 0, liked: false }));
      }

      return Promise.reject(new Error('navigation unavailable'));
    });

    const wrapper = mount(App, {
      global: {
        plugins: [router],
      },
    });

    await flushPromises();
    expect(wrapper.find('.notice-strip').exists()).toBe(true);

    await wrapper.get('.notice-strip-header button').trigger('click');
    await nextTick();
    expect(wrapper.find('.notice-strip').exists()).toBe(false);

    await wrapper.get('.announcement-toggle').trigger('click');
    await nextTick();
    expect(wrapper.find('.notice-strip').exists()).toBe(true);
  });

  it('renders and toggles mobile navigation', async () => {
    const wrapper = mount(App, {
      global: {
        plugins: [router],
      },
    });

    expect(wrapper.find('#mobile-navigation').exists()).toBe(false);

    await wrapper.get('.menu-toggle').trigger('click');
    await nextTick();

    const mobileNavigation = wrapper.get('#mobile-navigation');

    expect(mobileNavigation.text()).toContain('Notes');
    expect(mobileNavigation.text()).toContain('About');

    await mobileNavigation.get('a[href="/thoughts"]').trigger('click');
    await nextTick();

    expect(wrapper.find('#mobile-navigation').exists()).toBe(false);
  });
});
