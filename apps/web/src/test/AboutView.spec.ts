import { flushPromises, mount } from '@vue/test-utils';
import { setLocale } from '../composables/useI18n';
import AboutView from '../views/AboutView.vue';

function jsonResponse(body: unknown) {
  return { ok: true, json: async () => body } as Response;
}

describe('AboutView', () => {
  beforeEach(() => {
    window.localStorage.clear();
    setLocale('zh');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows profile-shaped content while site settings are pending', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => undefined)),
    );

    const wrapper = mount(AboutView);

    expect(wrapper.get('.content-skeleton-profile').attributes('aria-label')).toBe(
      '正在整理个人资料…',
    );
    expect(wrapper.get('h1').text()).toBe('关于我');
  });

  it('replaces the profile skeleton with public settings', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          jsonResponse({
            aboutContent: '<p>关于内容</p>',
            avatarUrl: '',
            faviconUrl: '',
            githubUrl: 'https://github.com/example',
            homeIntroduction: '',
            publicName: '语尔',
            siteName: '语尔',
            theme: { primary: 'pink' },
          }),
        ),
      ),
    );

    const wrapper = mount(AboutView);
    await flushPromises();

    expect(wrapper.find('.content-skeleton-profile').exists()).toBe(false);
    expect(wrapper.get('h1').text()).toBe('语尔');
    expect(wrapper.html()).toContain('关于内容');
  });
});
