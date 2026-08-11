import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import MascotWidget from '../components/MascotWidget.vue';
import { setLocale } from '../composables/useI18n';

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
    return input.pathname + input.search;
  }

  return input.url;
}

function mascotResponse(pageKey: string) {
  return {
    id: 1,
    imageUrl: '',
    name: '默认看板娘',
    pageKey,
    pageLine: {
      content: pageKey === 'thoughts' ? '碎碎念页面台词' : '首页台词',
      id: 1,
      isEnabled: true,
      isRandom: false,
      key: `${pageKey}-line`,
      pageKey,
      sortOrder: 0,
      weight: 1,
    },
    randomLines: [
      {
        content: '随机一',
        id: 2,
        isEnabled: true,
        isRandom: true,
        key: 'random-1',
        pageKey: '*',
        sortOrder: 0,
        weight: 1,
      },
      {
        content: '随机二',
        id: 3,
        isEnabled: true,
        isRandom: true,
        key: 'random-2',
        pageKey: '*',
        sortOrder: 0,
        weight: 3,
      },
    ],
  };
}

describe('MascotWidget', () => {
  beforeEach(() => {
    setLocale('zh');
    vi.spyOn(Math, 'random').mockReturnValue(0.95);
    vi.stubGlobal(
      'fetch',
      vi.fn((input: URL | RequestInfo) => {
        const url = new URL(requestUrl(input), 'http://localhost');
        const pageKey = url.searchParams.get('pageKey') ?? 'home';

        return Promise.resolve(jsonResponse(mascotResponse(pageKey)));
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('updates the page line after route changes and picks a weighted random line on click', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { component: { template: '<div />' }, name: 'home', path: '/' },
        { component: { template: '<div />' }, name: 'thoughts', path: '/thoughts' },
      ],
    });
    await router.push('/');
    await router.isReady();

    const wrapper = mount(MascotWidget, {
      global: {
        plugins: [router],
      },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('首页台词');

    await wrapper.get('button').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('随机二');

    await router.push('/thoughts');
    await flushPromises();
    expect(wrapper.text()).toContain('碎碎念页面台词');
  });

  it('ignores a stale mascot response after a fast route change', async () => {
    let resolveHome!: () => void;
    let resolveThoughts!: () => void;

    vi.stubGlobal(
      'fetch',
      vi.fn((input: URL | RequestInfo) => {
        const url = new URL(requestUrl(input), 'http://localhost');
        const pageKey = url.searchParams.get('pageKey') ?? 'home';

        return new Promise<Response>((resolve) => {
          const finish = () => resolve(jsonResponse(mascotResponse(pageKey)));
          if (pageKey === 'thoughts') {
            resolveThoughts = finish;
          } else {
            resolveHome = finish;
          }
        });
      }),
    );
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { component: { template: '<div />' }, name: 'home', path: '/' },
        { component: { template: '<div />' }, name: 'thoughts', path: '/thoughts' },
      ],
    });
    await router.push('/');
    await router.isReady();

    const wrapper = mount(MascotWidget, {
      global: { plugins: [router] },
    });
    await wrapper.vm.$nextTick();
    await router.push('/thoughts');
    await wrapper.vm.$nextTick();

    resolveThoughts();
    await flushPromises();
    expect(wrapper.text()).toContain('碎碎念页面台词');

    resolveHome();
    await flushPromises();
    expect(wrapper.text()).toContain('碎碎念页面台词');
    expect(wrapper.text()).not.toContain('首页台词');
  });
});
