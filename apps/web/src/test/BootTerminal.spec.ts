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

  it('plays anyway under prefers-reduced-motion while developing', async () => {
    // 开发阶段（playWhileDeveloping=true）：无视 reduced-motion，保证开发者
    // 能反复查看效果。⚠️ 曾因 Windows 关闭「动画效果」导致真实浏览器
    // prefers-reduced-motion 为 reduce，旧逻辑直接跳过、用户完全看不到动画。
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

    // 定稿后（playWhileDeveloping=false）应恢复为：跳过不播、
    // `.boot-terminal` 不存在、emit('done') 一次。
    expect(wrapper.find('.boot-terminal').exists()).toBe(true);
  });

  it('ignores the played flag while developing and plays anyway', async () => {
    // 开发阶段开关开着（playWhileDeveloping=true）：即使会话里播过也要再播。
    window.sessionStorage.setItem(SESSION_KEY, '1');

    const wrapper = mount(BootTerminal);

    await nextTick();

    expect(wrapper.find('.boot-terminal').exists()).toBe(true);
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
      expect(window.sessionStorage.getItem(SESSION_KEY)).toBeNull();
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
