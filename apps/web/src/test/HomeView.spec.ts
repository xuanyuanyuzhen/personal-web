import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import HomeView from '../views/HomeView.vue';
import { setLocale } from '../composables/useI18n';

function jsonResponse(body: unknown) {
  return {
    ok: true,
    json: async () => body,
  } as Response;
}

function pageResponse(items: unknown[], total = items.length) {
  return jsonResponse({
    items,
    pagination: { page: 1, pageSize: items.length || 1, total },
  });
}

const essayFixture = {
  category: { id: 1, name: '札记', slug: 'notes' },
  categoryId: 1,
  content: '<p>正文</p>',
  coverUrl: '/uploads/cover.jpg',
  createdAt: '2026-06-03T00:00:00.000Z',
  id: 1,
  isPinned: false,
  likeCount: 2,
  liked: false,
  publishedAt: '2026-06-03T00:00:00.000Z',
  slug: 'first-essay',
  summary: '一篇随笔的摘要',
  tags: [],
  title: '轮播随笔',
  updatedAt: '2026-06-03T00:00:00.000Z',
};

const photoFixture = {
  album: null,
  albumId: null,
  createdAt: '2026-06-04T00:00:00.000Z',
  description: null,
  id: 11,
  largeUrl: null,
  likeCount: 0,
  liked: false,
  originalUrl: '/uploads/photo-full.jpg',
  sortOrder: 1,
  thumbUrl: '/uploads/photo-thumb.jpg',
  title: '照片一',
  updatedAt: '2026-06-04T00:00:00.000Z',
};

const messageFixture = {
  avatarUrl: null,
  content: '很喜欢这里的氛围',
  createdAt: '2026-06-05T00:00:00.000Z',
  id: 21,
  nickname: '小语',
  updatedAt: '2026-06-05T00:00:00.000Z',
};

function buildRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { component: { template: '<div />' }, name: 'home', path: '/' },
      { component: { template: '<div />' }, name: 'essay-detail', path: '/essays/:idOrSlug' },
      { component: { template: '<div />' }, name: 'photos', path: '/photos' },
      { component: { template: '<div />' }, name: 'messages', path: '/messages' },
    ],
  });
}

function mountHome() {
  return mount(HomeView, {
    global: { plugins: [buildRouter()] },
  });
}

describe('HomeView', () => {
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

        if (url.startsWith('/api/essays/public')) {
          return Promise.resolve(pageResponse([essayFixture], 3));
        }

        if (url.startsWith('/api/photos/public')) {
          return Promise.resolve(pageResponse([photoFixture], 5));
        }

        if (url.startsWith('/api/messages/public')) {
          return Promise.resolve(pageResponse([messageFixture], 9));
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

  it('renders meaningful local defaults without waiting for home APIs', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => undefined)),
    );

    const wrapper = mountHome();

    expect(wrapper.get('h1').text().trim()).not.toBe('');
    expect(wrapper.get('.summary').text().trim()).not.toBe('');
    expect(wrapper.find('.heart-like-button').exists()).toBe(true);
    expect(wrapper.find('.home-panel').exists()).toBe(true);
    expect(wrapper.get('.home-clock-time').text()).toMatch(/^\d{2}:\d{2}:\d{2}$/);

    wrapper.unmount();
  });

  it('renders site settings and announcement from the API', async () => {
    const wrapper = mountHome();
    await flushPromises();

    expect(wrapper.get('h1').text()).toContain('接口站点');
    expect(wrapper.text()).toContain('接口首页介绍');
    expect(wrapper.text()).toContain('接口公告');
    expect(wrapper.html()).toContain('接口公告内容');
    expect(wrapper.text()).toContain('喜欢本站');
    expect(wrapper.text()).toContain('7');

    wrapper.unmount();
  });

  it('renders carousel, latest essay, photo wall, messages, and status counts', async () => {
    const wrapper = mountHome();
    await flushPromises();

    // 轮播图与「最新随笔」卡都来自随笔列表。
    expect(wrapper.text()).toContain('轮播随笔');
    expect(wrapper.text()).toContain('一篇随笔的摘要');
    expect(wrapper.get('a.home-latest-card').attributes('href')).toBe('/essays/first-essay');

    // 照片墙轮播用缩略图作为背景。
    expect(wrapper.get('.home-photo-card .home-carousel-slide').attributes('style')).toContain(
      'photo-thumb.jpg',
    );

    // 最近过审留言。
    expect(wrapper.text()).toContain('小语');
    expect(wrapper.text()).toContain('很喜欢这里的氛围');

    // 站点状态条汇总各版块 total。
    expect(wrapper.text()).toContain('随笔 3');
    expect(wrapper.text()).toContain('照片 5');
    expect(wrapper.text()).toContain('留言 9');
    expect(wrapper.find('.home-status-online').exists()).toBe(true);

    wrapper.unmount();
  });

  it('falls back to empty blocks when list APIs return malformed payloads', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse({ nothing: true }))),
    );

    const wrapper = mountHome();
    await flushPromises();

    expect(wrapper.findAll('.home-empty-text').length).toBeGreaterThan(0);
    expect(wrapper.text()).toContain('随笔 0');

    wrapper.unmount();
  });

  it('keeps the welcome notice permanently, with no close button', async () => {
    const wrapper = mountHome();
    await flushPromises();

    // 欢迎语常驻：关闭按钮与「已关闭」记忆都已移除。
    expect(wrapper.get('.notice-strip').text()).toContain('接口公告');
    expect(wrapper.find('.notice-strip-header button').exists()).toBe(false);
    expect(window.localStorage.getItem('yuer.home.announcement.dismissed')).toBeNull();

    wrapper.unmount();
  });

  it('toggles the site like state', async () => {
    const wrapper = mountHome();
    await flushPromises();

    const button = wrapper.get('.heart-like-button');
    await button.trigger('click');
    await flushPromises();

    expect(button.text()).toContain('8');
    expect(button.attributes('aria-pressed')).toBe('true');

    wrapper.unmount();
  });
});
