import { mount } from '@vue/test-utils';
import HomeClock from '../components/HomeClock.vue';
import { setLocale } from '../composables/useI18n';

describe('HomeClock', () => {
  beforeEach(() => {
    setLocale('zh');
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('points the hands at the current time, carrying the smaller unit', () => {
    // 本地时间 15:30:45 → 表盘上是 3 点 30 分 45 秒。
    vi.setSystemTime(new Date(2026, 7, 15, 15, 30, 45));

    const wrapper = mount(HomeClock);

    // 秒：45 × 6°
    expect(wrapper.get('.home-clock-hand-second').attributes('style')).toContain('rotate(270deg)');
    // 分：30 × 6° + 45 × 0.1°（带上秒的零头）
    expect(wrapper.get('.home-clock-hand-minute').attributes('style')).toContain(
      'rotate(184.5deg)',
    );
    // 时：3 × 30° + 30 × 0.5°（半小时时针要走到 3 和 4 中间，不能死指着 3）
    expect(wrapper.get('.home-clock-hand-hour').attributes('style')).toContain('rotate(105deg)');

    wrapper.unmount();
  });

  it('puts 12 o’clock at 0 degrees', () => {
    vi.setSystemTime(new Date(2026, 7, 15, 12, 0, 0));

    const wrapper = mount(HomeClock);

    for (const hand of ['hour', 'minute', 'second']) {
      expect(wrapper.get(`.home-clock-hand-${hand}`).attributes('style')).toContain('rotate(0deg)');
    }

    wrapper.unmount();
  });

  it('advances the digital readout and the hands every second', async () => {
    vi.setSystemTime(new Date(2026, 7, 15, 8, 5, 10));

    const wrapper = mount(HomeClock);
    expect(wrapper.get('.home-clock-time').text()).toBe('08:05:10');

    // advanceTimersByTime 本身就会把假时钟推进 1 秒，不要再额外 setSystemTime（会叠加）。
    await vi.advanceTimersByTimeAsync(1000);

    expect(wrapper.get('.home-clock-time').text()).toBe('08:05:11');
    expect(wrapper.get('.home-clock-hand-second').attributes('style')).toContain('rotate(66deg)');

    wrapper.unmount();
  });
});
