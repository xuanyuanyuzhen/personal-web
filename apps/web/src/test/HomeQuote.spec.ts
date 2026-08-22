import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import HomeQuote from '../components/HomeQuote.vue';

describe('HomeQuote', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('shows the whole quote immediately, without typing it out', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const wrapper = mount(HomeQuote, {
      props: {
        quotes: [{ author: '史铁生', text: '且视他人之疑目如盏盏鬼火，大胆去走你的夜路。' }],
      },
    });

    expect(wrapper.get('.home-quote-text').text()).toContain('且视他人之疑目如盏盏鬼火');
    expect(wrapper.get('.home-quote-text').text()).toContain('大胆去走你的夜路。');
    expect(wrapper.get('.home-quote-author').text()).toContain('史铁生');

    wrapper.unmount();
  });

  it('splits a long comma quote into an upper and a lower segment', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const wrapper = mount(HomeQuote, {
      props: { quotes: [{ text: '一个人知道自己为什么而活，就可以忍受任何一种生活。' }] },
    });

    expect(wrapper.get('.home-quote-text span').text()).toBe('一个人知道自己为什么而活，');
    expect(wrapper.get('.home-quote-tail').text()).toBe('就可以忍受任何一种生活。');

    wrapper.unmount();
  });

  it('keeps a short quote on a single left-aligned line', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const wrapper = mount(HomeQuote, {
      props: { quotes: [{ text: '慢慢走，欣赏啊。' }] },
    });

    expect(wrapper.get('.home-quote-text').text()).toBe('慢慢走，欣赏啊。');
    expect(wrapper.find('.home-quote-tail').exists()).toBe(false);

    wrapper.unmount();
  });

  it('rotates to a different quote after the hold duration', async () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValue(0.9);

    const wrapper = mount(HomeQuote, {
      props: {
        holdDuration: 6000,
        quotes: [{ text: '第一句。' }, { text: '第二句。' }],
      },
    });

    expect(wrapper.get('.home-quote-text').text()).toBe('第一句。');

    vi.advanceTimersByTime(5900);
    await nextTick();
    expect(wrapper.get('.home-quote-text').text()).toBe('第一句。');

    vi.advanceTimersByTime(100);
    await nextTick();
    expect(wrapper.get('.home-quote-text').text()).toBe('第二句。');

    wrapper.unmount();
  });
});
