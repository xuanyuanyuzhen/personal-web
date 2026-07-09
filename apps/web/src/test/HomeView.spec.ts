import { flushPromises, mount } from '@vue/test-utils';
import HomeView from '../views/HomeView.vue';
import { setLocale } from '../composables/useI18n';

function jsonResponse(body: unknown) {
  return {
    ok: true,
    json: async () => body,
  } as Response;
}

describe('HomeView', () => {
  beforeEach(() => {
    window.localStorage.clear();
    setLocale('zh');
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url === '/api/site/settings') {
          return Promise.resolve(
            jsonResponse({
              aboutContent: '<p>关于我</p>',
              avatarUrl: '',
              faviconUrl: '',
              githubUrl: '',
              homeIntroduction: '接口首页介绍',
              publicName: '接口昵称',
              siteName: '接口站点',
              theme: { primary: 'pink' },
            }),
          );
        }

        if (url === '/api/likes/status?targetType=site') {
          return Promise.resolve(jsonResponse({ likeCount: 7, liked: false }));
        }

        if (url === '/api/likes/toggle') {
          return Promise.resolve(jsonResponse({ likeCount: 8, liked: true }));
        }

        return Promise.resolve(
          jsonResponse({
            content: '<p>接口公告内容</p>',
            isEnabled: true,
            publishedAt: '2026-06-03T00:00:00.000Z',
            title: '接口公告',
          }),
        );
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders site settings and announcement from the API', async () => {
    const wrapper = mount(HomeView);
    await flushPromises();

    expect(wrapper.get('h1').text()).toContain('接口站点');
    expect(wrapper.text()).toContain('接口首页介绍');
    expect(wrapper.text()).toContain('接口公告');
    expect(wrapper.html()).toContain('接口公告内容');
    expect(wrapper.text()).toContain('喜欢本站');
    expect(wrapper.text()).toContain('7');
  });

  it('stores announcement dismissal in localStorage', async () => {
    const wrapper = mount(HomeView);
    await flushPromises();

    await wrapper.get('.notice-strip-header button').trigger('click');

    expect(window.localStorage.getItem('yuer.home.announcement.dismissed')).toBe('1');
    expect(wrapper.find('.notice-strip').exists()).toBe(false);
  });

  it('toggles the site like state', async () => {
    const wrapper = mount(HomeView);
    await flushPromises();

    const button = wrapper.get('.heart-like-button');
    await button.trigger('click');
    await flushPromises();

    expect(button.text()).toContain('8');
    expect(button.attributes('aria-pressed')).toBe('true');
  });
});
