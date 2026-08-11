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

  it('skips immediately and emits done when already played this session', async () => {
    window.sessionStorage.setItem(SESSION_KEY, '1');

    const wrapper = mount(BootTerminal);

    await nextTick();

    expect(wrapper.find('.boot-terminal').exists()).toBe(false);
    expect(wrapper.emitted('done')).toHaveLength(1);
  });

  it('skips immediately under prefers-reduced-motion', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi
        .fn()
        .mockReturnValue({
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

  it('marks the session as played and starts fading out on Escape', async () => {
    const wrapper = mount(BootTerminal);

    await nextTick();
    expect(wrapper.find('.boot-terminal').exists()).toBe(true);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await nextTick();

    expect(window.sessionStorage.getItem(SESSION_KEY)).toBe('1');
    expect(wrapper.find('.boot-terminal').classes()).toContain('is-leaving');
  });

  it('skips on Enter as well', async () => {
    const wrapper = mount(BootTerminal);
    await nextTick();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await nextTick();

    expect(window.sessionStorage.getItem(SESSION_KEY)).toBe('1');
    expect(wrapper.find('.boot-terminal').classes()).toContain('is-leaving');
  });

  it('types out the full welcome script and emits done afterwards', async () => {
    vi.useFakeTimers();

    try {
      const wrapper = mount(BootTerminal);

      // 跑完整段动画 + 出场淡出兜底，总时长 ~5.5s。
      await vi.advanceTimersByTimeAsync(6500);

      expect(wrapper.emitted('done')).toHaveLength(1);
      expect(window.sessionStorage.getItem(SESSION_KEY)).toBe('1');
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
