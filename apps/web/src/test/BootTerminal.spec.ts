import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import BootTerminal from '../components/BootTerminal.vue';
import { setLocale } from '../composables/useI18n';

const SESSION_KEY = 'yuer.boot.played';

describe('BootTerminal', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    setLocale('zh');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('skips immediately under prefers-reduced-motion', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    );

    const wrapper = mount(BootTerminal);

    await nextTick();

    expect(wrapper.find('.boot-terminal').exists()).toBe(false);
    expect(wrapper.emitted('done')).toHaveLength(1);
  });

  it('ignores the played flag while developing and plays anyway', async () => {
    // 开发阶段开关开着（playWhileDeveloping=true）：即使会话里播过也要再播。
    window.sessionStorage.setItem(SESSION_KEY, '1');

    const wrapper = mount(BootTerminal);

    await nextTick();

    expect(wrapper.find('.boot-terminal').exists()).toBe(true);
  });

  it('starts fading out on Escape and does not write the played flag yet', async () => {
    const wrapper = mount(BootTerminal);

    await nextTick();
    expect(wrapper.find('.boot-terminal').exists()).toBe(true);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await nextTick();

    // 开发阶段不写记忆，否则下一次进入首页会被跳过、没法反复看效果。
    expect(window.sessionStorage.getItem(SESSION_KEY)).toBeNull();
    expect(wrapper.find('.boot-terminal').classes()).toContain('is-leaving');
  });

  it('skips on Enter as well', async () => {
    const wrapper = mount(BootTerminal);
    await nextTick();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await nextTick();

    expect(wrapper.find('.boot-terminal').classes()).toContain('is-leaving');
  });

  it('types out the full welcome script and emits done afterwards', async () => {
    vi.useFakeTimers();

    try {
      const wrapper = mount(BootTerminal);

      // 跑完整段动画 + 出场淡出兜底，总时长约 5 秒。
      await vi.advanceTimersByTimeAsync(6500);

      expect(wrapper.emitted('done')).toHaveLength(1);
      expect(window.sessionStorage.getItem(SESSION_KEY)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('stops the animation when unmounted mid-run', async () => {
    const wrapper = mount(BootTerminal);
    await nextTick();

    wrapper.unmount();

    expect(window.sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });
});
