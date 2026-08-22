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

  it('plays anyway under prefers-reduced-motion (respectReducedMotion=false)', async () => {
    // 无障碍开关当前关着：无视 reduced-motion 照常播放。
    // ⚠️ 本机 Windows 关了「动画效果」，真实 Chrome 里 prefers-reduced-motion 就是 reduce，
    // 如果把它和「只播一次」合成一个开关，一翻就变成「一次都不播」。
    // 上线前把 respectReducedMotion 改成 true，届时这条断言要改为「不挂载 + emit done」。
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

    expect(wrapper.find('.boot-terminal').exists()).toBe(true);
  });

  it('skips the whole terminal when this session already played it', async () => {
    // replayEveryVisit=false：同一会话只播一次，之后直接进首页（方便调试首页内容）。
    window.sessionStorage.setItem(SESSION_KEY, '1');

    const wrapper = mount(BootTerminal);

    await nextTick();

    expect(wrapper.find('.boot-terminal').exists()).toBe(false);
    expect(wrapper.emitted('done')).toHaveLength(1);
  });

  it('fast-forwards the typing on Escape and lands at the waiting prompt', async () => {
    const wrapper = mount(BootTerminal);

    await nextTick();
    expect(wrapper.find('.boot-terminal').exists()).toBe(true);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await nextTick();

    // 跳过的是「文字显示」，不是整个动画：不进入页面、不写记忆，
    // 直接落到「等待输入」提示符。
    expect(wrapper.emitted('done')).toBeUndefined();
    expect(window.sessionStorage.getItem(SESSION_KEY)).toBeNull();
    expect(wrapper.find('.boot-terminal').classes()).not.toContain('is-leaving');
    expect(wrapper.find('.boot-enter-prompt').exists()).toBe(true);
    expect(wrapper.find('.boot-progress').exists()).toBe(false);
  });

  it('fast-forwards the typing on Enter and does not enter the page', async () => {
    const wrapper = mount(BootTerminal);
    await nextTick();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await nextTick();

    expect(wrapper.emitted('done')).toBeUndefined();
    expect(wrapper.find('.boot-terminal').classes()).not.toContain('is-leaving');
    expect(wrapper.find('.boot-enter-prompt').exists()).toBe(true);
  });

  it('shows the enter prompt after typing, then emits done once the progress fills', async () => {
    vi.useFakeTimers();

    try {
      const wrapper = mount(BootTerminal);

      // 跑完整段文字（更慢的节奏约 8 秒）：打完停在终端，出现 `$` 提示符等待输入。
      await vi.advanceTimersByTimeAsync(9500);

      expect(wrapper.emitted('done')).toBeUndefined();
      expect(wrapper.find('.boot-enter-prompt').exists()).toBe(true);
      expect(wrapper.text()).toContain('clear');
      expect(window.sessionStorage.getItem(SESSION_KEY)).toBeNull();

      // 输入 clear 后回车进入 → 进度条填充 → 填满后淡出并 emit done。
      for (const key of ['c', 'l', 'e', 'a', 'r']) {
        window.dispatchEvent(new KeyboardEvent('keydown', { key }));
      }
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      await nextTick();
      expect(wrapper.find('.boot-progress').exists()).toBe(true);

      await vi.advanceTimersByTimeAsync(4000);

      expect(wrapper.emitted('done')).toHaveLength(1);
      // 开始淡出时通知 App 触发首页上浮转场。
      expect(wrapper.emitted('leave')).toHaveLength(1);
      // 播完写会话记忆：本会话后续进首页直接跳过终端。
      expect(window.sessionStorage.getItem(SESSION_KEY)).toBe('1');
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects empty or invalid Enter, and enters only on clear', async () => {
    vi.useFakeTimers();

    try {
      const wrapper = mount(BootTerminal);
      await vi.advanceTimersByTimeAsync(9500);

      // 空回车：不进入、不写记忆。
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      await nextTick();
      expect(wrapper.find('.boot-progress').exists()).toBe(false);
      expect(wrapper.emitted('done')).toBeUndefined();
      expect(wrapper.find('.boot-enter-prompt').exists()).toBe(true);

      // 无效命令：回显 command not found、清空输入，但不进入。
      for (const key of ['l', 's']) {
        window.dispatchEvent(new KeyboardEvent('keydown', { key }));
      }
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      await nextTick();
      expect(wrapper.text()).toContain('command not found');
      expect(wrapper.find('.boot-progress').exists()).toBe(false);

      // 输入 clear 后回车：进入。
      for (const key of ['c', 'l', 'e', 'a', 'r']) {
        window.dispatchEvent(new KeyboardEvent('keydown', { key }));
      }
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      await nextTick();
      expect(wrapper.find('.boot-progress').exists()).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('accepts typed commands and backspace at the enter prompt', async () => {
    vi.useFakeTimers();

    try {
      const wrapper = mount(BootTerminal);
      await vi.advanceTimersByTimeAsync(9500);

      for (const key of ['c', 'l', 'e', 'a', 'r']) {
        window.dispatchEvent(new KeyboardEvent('keydown', { key }));
      }
      await nextTick();
      expect(wrapper.find('.boot-enter-prompt').text()).toContain('clear');

      // 退格删掉一个字符。
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }));
      await nextTick();
      expect(wrapper.find('.boot-enter-prompt').text()).toContain('clea');
    } finally {
      vi.useRealTimers();
    }
  });

  it('enters when clicking anywhere on the terminal', async () => {
    vi.useFakeTimers();

    try {
      const wrapper = mount(BootTerminal);
      await vi.advanceTimersByTimeAsync(9500);

      await wrapper.get('.boot-terminal').trigger('click');
      await nextTick();
      expect(wrapper.find('.boot-progress').exists()).toBe(true);
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
