import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import MascotWidget from '../components/MascotWidget.vue';
import SpriteMascot from '../components/SpriteMascot.vue';
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

const SPRITE_CONFIG = {
  cols: 8,
  renderer: 'sprite',
  rows: 5,
  spriteUrl: '/mascot/pets/elysia/sprite.webp',
  states: {
    gestureA: { fps: 6, frames: 6, row: 0 },
    gestureB: { fps: 6, frames: 6, row: 1 },
    stand: { frames: 1, row: 0 },
    typing: { fps: 12, frames: 6, row: 4 },
  },
};

async function mountWithSprite() {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        jsonResponse({
          ...mascotResponse('home'),
          imageUrl: '/mascot.png',
          modelConfig: SPRITE_CONFIG,
        }),
      ),
    ),
  );
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ component: { template: '<div />' }, name: 'home', path: '/' }],
  });
  await router.push('/');
  await router.isReady();

  const wrapper = mount(MascotWidget, { global: { plugins: [router] } });
  await flushPromises();

  return wrapper;
}

function mascotResponse(pageKey: string) {
  return {
    id: 1,
    imageUrl: '',
    modelConfig: null,
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

  it('renders the sprite mascot for an enabled modelConfig and falls back to the image on load error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          jsonResponse({
            ...mascotResponse('home'),
            imageUrl: '/mascot.png',
            modelConfig: {
              cols: 8,
              renderer: 'sprite',
              rows: 4,
              spriteUrl: '/mascot/pets/elysia/sprite.webp',
              states: { idle: { fps: 8, frames: 8, row: 0 } },
            },
          }),
        ),
      ),
    );
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ component: { template: '<div />' }, name: 'home', path: '/' }],
    });
    await router.push('/');
    await router.isReady();

    const wrapper = mount(MascotWidget, {
      global: { plugins: [router] },
    });
    await flushPromises();

    expect(wrapper.find('.sprite-mascot').exists()).toBe(true);
    expect(wrapper.get('.sprite-mascot-sheet').attributes('src')).toBe(
      '/mascot/pets/elysia/sprite.webp',
    );

    await wrapper.getComponent(SpriteMascot).vm.$emit('error', new Error('sprite unavailable'));
    await flushPromises();

    expect(wrapper.find('.sprite-mascot').exists()).toBe(false);
    expect(wrapper.get('img').attributes('src')).toBe('/mascot.png');
  });

  it('switches the sprite to typing on focus alone and keeps it while focus stays', async () => {
    const wrapper = await mountWithSprite();
    const input = document.createElement('input');
    document.body.appendChild(input);

    // 光聚焦、一个字都没敲，就该坐到键盘前
    input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    await flushPromises();
    expect(wrapper.getComponent(SpriteMascot).props('state')).toBe('typing');

    // 焦点没走，鼠标动一下也不该把她拉回站立
    // （jsdom 没实现 PointerEvent，用普通 Event 触发同名监听即可）
    window.dispatchEvent(new Event('pointermove'));
    await flushPromises();
    expect(wrapper.getComponent(SpriteMascot).props('state')).toBe('typing');

    input.remove();
    wrapper.unmount();
  });

  it('returns to a standing idle state once the field loses focus', async () => {
    const wrapper = await mountWithSprite();
    const input = document.createElement('input');
    document.body.appendChild(input);

    input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    await flushPromises();
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    await flushPromises();

    expect(wrapper.getComponent(SpriteMascot).props('state')).toBe('stand');
    expect(wrapper.find('.mascot-keycap').exists()).toBe(false);

    input.remove();
    wrapper.unmount();
  });
  it('shows a keycap for keys typed into a focused field', async () => {
    const wrapper = await mountWithSprite();
    const input = document.createElement('input');
    document.body.appendChild(input);

    input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'a' }));
    await flushPromises();

    expect(wrapper.get('.mascot-keycap').text()).toBe('a');

    input.remove();
    wrapper.unmount();
  });

  it('never echoes keys typed into a password field', async () => {
    const wrapper = await mountWithSprite();
    const input = document.createElement('input');
    input.type = 'password';
    document.body.appendChild(input);

    input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 's' }));
    await flushPromises();

    // 状态照常切到打字（不泄露内容），但键位一个都不显示
    expect(wrapper.getComponent(SpriteMascot).props('state')).toBe('typing');
    expect(wrapper.find('.mascot-keycap').exists()).toBe(false);

    input.remove();
    wrapper.unmount();
  });

  it('ignores keystrokes while no field is focused', async () => {
    const wrapper = await mountWithSprite();

    // 用方向键滚页面不该让她坐到键盘前
    window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowDown' }));
    await flushPromises();

    expect(wrapper.getComponent(SpriteMascot).props('state')).toBe('stand');
    expect(wrapper.find('.mascot-keycap').exists()).toBe(false);

    wrapper.unmount();
  });

  it('keeps the plain image when modelConfig uses an unknown renderer', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          jsonResponse({
            ...mascotResponse('home'),
            imageUrl: '/mascot.png',
            // 旧的 mmd 配置在库里可能还留着，不能因此渲染成空白
            modelConfig: { modelUrl: '/mmd/hero.pmx', renderer: 'mmd' },
          }),
        ),
      ),
    );
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ component: { template: '<div />' }, name: 'home', path: '/' }],
    });
    await router.push('/');
    await router.isReady();

    const wrapper = mount(MascotWidget, {
      global: { plugins: [router] },
    });
    await flushPromises();

    expect(wrapper.find('.sprite-mascot').exists()).toBe(false);
    expect(wrapper.get('img').attributes('src')).toBe('/mascot.png');
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
